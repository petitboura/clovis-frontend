import { supabase } from "./supabase";
import type { NotificationClovis } from "./api";

// Ajoute le 30/08/2026, Bourama : Lot 1 Partie 3 (app mobile), chantier
// "Exploration de dossier en temps reel" (voir 00-commun-exploration-dossier.md
// et 01-canal-temps-reel.md a la racine du depot clovis-backend). Canal
// WebSocket bidirectionnel, distinct du SSE utilise par le chat
// (lib/api.ts) qui ne permet pas au backend de poser une question au
// frontend en cours de route.
//
// Ce fichier est charge UNIQUEMENT cote natif (Capacitor.isNativePlatform())
// -- voir l'appel dans lib/supabase.ts, meme garde que le pont
// PontNatif deja en place. Sur le web (Vercel), il n'y a pas de
// telephone a explorer : rien de tout ceci ne s'execute.
//
// Lot 1 : aucun traitement reel, on repondait "oui" a n'importe quelle
// question ("es-tu la ?") pour valider le tuyau de bout en bout.
//
// Lot 2 (30/08/2026, voir 02-outil-exploration.md) : premier vrai
// routage. La "question" recue n'est plus forcement une simple chaine :
// elle peut etre un objet structure {"action": "lister_contenu",
// "dossier_nom": ...}, traiterQuestion ci-dessous decide quoi faire selon
// sa forme. Reutilise le plugin Capacitor Dossiers deja existant
// (android/.../dossiers/DossiersPlugin.kt, meme type PluginDossiers que
// components/EspaceDossiers.tsx) plutot que d'en reconstruire un.
//
// Lot 3 (30/08/2026, voir 03-navigation-recherche-nom.md) : descendre de
// plusieurs niveaux ("ouvrir_sous_dossier") et chercher par nom dans
// toute l'arborescence ("chercher_par_nom"), toujours en enchainant
// listerContenu plusieurs fois -- aucune nouvelle methode native requise.
// Signale une popup non bloquante (voir signalerExploration /
// components/PopupExplorationDossier.tsx) pendant que l'une de ces deux
// actions tourne.

type DossierDesigne = { uri: string; nom: string };
type ElementDossier = { uri: string; nom: string; estDossier: boolean; tailleOctets: number };
type ElementFormatte = { nom: string; estDossier: boolean; tailleOctets: number | null };
type ResultatRecherche = ElementFormatte & { chemin: string[] };

type ContenuFichierNatif = { contenuBase64: string; typeMime: string; nomFichier: string; tailleOctets: number };

type PluginDossiers = {
  listerDossiersDesignes(): Promise<{ dossiers: DossierDesigne[] }>;
  listerContenu(options: { uri: string }): Promise<{ elements: ElementDossier[] }>;
  lireFichier(options: { uri: string }): Promise<ContenuFichierNatif>;
};

// Meme principe que PROFONDEUR_MAX cote accessibilite
// (ExecuteurActions.kt) : borne la recherche recursive pour ne jamais
// tourner indefiniment sur une arborescence tres profonde.
const PROFONDEUR_MAX_RECHERCHE = 20;

const API_URL = process.env.NEXT_PUBLIC_API_URL;

let socket: WebSocket | null = null;
let tentativeReconnexion: ReturnType<typeof setTimeout> | null = null;
let fermetureVoulue = false;
let dejaInitialise = false;
let pluginDossiers: PluginDossiers | null = null;

// Ajoute le 02/09/2026, Bourama : centre de notifications (bouton
// cloche), doit fonctionner web ET mobile -- contrairement au plugin
// Dossiers (natif uniquement, pas de dossier a explorer sur le
// telephone depuis un onglet web), le canal WebSocket lui-meme est du
// JS standard (voir `new WebSocket` plus bas), rien n'empeche de
// l'ouvrir aussi sur le web. Voir lib/supabase.ts pour l'appel.
export function enregistrerPluginDossiers(registerPlugin: <T>(name: string) => T) {
  pluginDossiers = registerPlugin<PluginDossiers>("Dossiers");
}

// Meme principe que ecouterExploration plus bas : simple pub/sub, ce
// module n'est pas un composant React.
const ecouteursNotifications = new Set<(n: NotificationClovis) => void>();

export function ecouterNotifications(cb: (n: NotificationClovis) => void): () => void {
  ecouteursNotifications.add(cb);
  return () => ecouteursNotifications.delete(cb);
}

function urlWebSocket(token: string): string | null {
  if (!API_URL) return null;
  const base = API_URL.replace(/^http/, "ws");
  return `${base}/api/canal-temps-reel/ws?token=${encodeURIComponent(token)}`;
}

function envoyerReponse(id: string, reponse: unknown) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ id, reponse }));
}

function formatterElement(e: ElementDossier): ElementFormatte {
  return { nom: e.nom, estDossier: e.estDossier, tailleOctets: e.estDossier ? null : e.tailleOctets };
}

// Correctif 05/09/2026 (Bourama) : filet de securite si le modele laisse
// malgre tout trainer un suffixe de plateforme du type " (android)"/" (ios)"
// dans dossier_nom (ne devrait plus arriver depuis le nouveau format de
// lister_dossiers cote backend, mais on ne fait jamais confiance aveuglement
// a un texte genere par le modele). Egalite stricte d'abord, retente sans
// le suffixe seulement si ca echoue. Utilise pour resoudre dossier_nom (le
// dossier designe RACINE), jamais pour un segment de "chemin" en dessous
// (ceux-la sont des noms reels d'elements, jamais annotes par lister_dossiers).
const SUFFIXES_PLATEFORME = [" (android)", " (ios)"];

function trouverDossierDesigne(dossiers: DossierDesigne[], dossierNom: string): DossierDesigne | undefined {
  const exact = dossiers.find((d) => d.nom === dossierNom);
  if (exact) return exact;
  const suffixe = SUFFIXES_PLATEFORME.find((s) => dossierNom.toLowerCase().endsWith(s));
  if (!suffixe) return undefined;
  const nomSansSuffixe = dossierNom.slice(0, dossierNom.length - suffixe.length);
  return dossiers.find((d) => d.nom === nomSansSuffixe);
}

// Popup non bloquante (décidée avec Bourama le 29/08, voir
// components/PopupExplorationDossier.tsx) : simple pub/sub, ce module
// n'est pas un composant React et ne peut pas gérer d'état lui-même.
type EvenementExploration = { enCours: boolean; dossierNom?: string };
const ecouteursExploration = new Set<(e: EvenementExploration) => void>();

export function ecouterExploration(cb: (e: EvenementExploration) => void): () => void {
  ecouteursExploration.add(cb);
  return () => ecouteursExploration.delete(cb);
}

function signalerExploration(e: EvenementExploration) {
  ecouteursExploration.forEach((cb) => cb(e));
}

/**
 * Lot 2 : traite une question "lister_contenu" -- retrouve l'uri du
 * dossier désigné correspondant à `dossier_nom` (le backend ne connaît
 * et ne manipule jamais d'uri, voir core/dossiers_designes_mobile.py côté
 * clovis-backend), liste son contenu via le plugin natif Dossiers déjà
 * existant, puis répond avec les éléments (nom, type, taille -- jamais
 * l'uri, qui n'a aucun sens côté serveur).
 */
async function repondreListerContenu(id: string, dossierNom: string) {
  if (!pluginDossiers) {
    envoyerReponse(id, { erreur: "Plugin Dossiers indisponible sur cet appareil." });
    return;
  }
  try {
    const { dossiers } = await pluginDossiers.listerDossiersDesignes();
    const dossier = trouverDossierDesigne(dossiers, dossierNom);
    if (!dossier) {
      envoyerReponse(id, { erreur: `Dossier désigné "${dossierNom}" introuvable sur cet appareil.` });
      return;
    }
    const { elements } = await pluginDossiers.listerContenu({ uri: dossier.uri });
    envoyerReponse(id, { elements: elements.map(formatterElement) });
  } catch (e) {
    envoyerReponse(id, { erreur: e instanceof Error ? e.message : "Erreur inconnue." });
  }
}

/**
 * Résout `dossier_nom` + `chemin` (liste de noms de sous-dossiers) vers
 * l'uri du sous-dossier atteint, en enchaînant listerContenu niveau par
 * niveau. Renvoie une erreur explicite dès qu'un segment du chemin est
 * introuvable (pas de tentative à l'aveugle, même principe que le reste
 * du projet).
 */
async function resoudreCheminUri(
  dossierNom: string,
  chemin: string[]
): Promise<{ uri: string } | { erreur: string }> {
  if (!pluginDossiers) return { erreur: "Plugin Dossiers indisponible sur cet appareil." };

  const { dossiers } = await pluginDossiers.listerDossiersDesignes();
  const racine = trouverDossierDesigne(dossiers, dossierNom);
  if (!racine) return { erreur: `Dossier désigné "${dossierNom}" introuvable sur cet appareil.` };

  let uriCourant = racine.uri;
  for (const segment of chemin) {
    const { elements } = await pluginDossiers.listerContenu({ uri: uriCourant });
    const enfant = elements.find((e) => e.estDossier && e.nom === segment);
    if (!enfant) return { erreur: `Sous-dossier "${segment}" introuvable dans ce chemin.` };
    uriCourant = enfant.uri;
  }
  return { uri: uriCourant };
}

/** Lot 3 : descend jusqu'au sous-dossier désigné par `chemin` et renvoie son contenu. */
async function repondreOuvrirSousDossier(id: string, dossierNom: string, chemin: string[]) {
  signalerExploration({ enCours: true, dossierNom });
  try {
    const resolu = await resoudreCheminUri(dossierNom, chemin);
    if ("erreur" in resolu) {
      envoyerReponse(id, resolu);
      return;
    }
    const { elements } = await pluginDossiers!.listerContenu({ uri: resolu.uri });
    envoyerReponse(id, { elements: elements.map(formatterElement) });
  } catch (e) {
    envoyerReponse(id, { erreur: e instanceof Error ? e.message : "Erreur inconnue." });
  } finally {
    signalerExploration({ enCours: false });
  }
}

/** Parcours récursif profondeur-plafonnée, même esprit que chercherNoeud (ExecuteurActions.kt). */
async function chercherRecursif(
  uri: string,
  chemin: string[],
  termeMinuscule: string,
  profondeur: number,
  resultats: ResultatRecherche[]
): Promise<void> {
  if (profondeur > PROFONDEUR_MAX_RECHERCHE || !pluginDossiers) return;

  const { elements } = await pluginDossiers.listerContenu({ uri });
  for (const element of elements) {
    const cheminElement = [...chemin, element.nom];
    if (element.nom.toLowerCase().includes(termeMinuscule)) {
      resultats.push({ ...formatterElement(element), chemin: cheminElement });
    }
    if (element.estDossier) {
      await chercherRecursif(element.uri, cheminElement, termeMinuscule, profondeur + 1, resultats);
    }
  }
}

/** Lot 3 : cherche `termeRecherche` (partiel, insensible à la casse) dans toute l'arborescence. */
async function repondreChercherParNom(id: string, dossierNom: string, termeRecherche: string) {
  if (!pluginDossiers) {
    envoyerReponse(id, { erreur: "Plugin Dossiers indisponible sur cet appareil." });
    return;
  }
  signalerExploration({ enCours: true, dossierNom });
  try {
    const { dossiers } = await pluginDossiers.listerDossiersDesignes();
    const racine = trouverDossierDesigne(dossiers, dossierNom);
    if (!racine) {
      envoyerReponse(id, { erreur: `Dossier désigné "${dossierNom}" introuvable sur cet appareil.` });
      return;
    }
    const resultats: ResultatRecherche[] = [];
    await chercherRecursif(racine.uri, [], termeRecherche.toLowerCase(), 0, resultats);
    envoyerReponse(id, { elements: resultats });
  } catch (e) {
    envoyerReponse(id, { erreur: e instanceof Error ? e.message : "Erreur inconnue." });
  } finally {
    signalerExploration({ enCours: false });
  }
}

/**
 * Ajoute le 30/08/2026 (correctif Claude chat) : resout dossier_nom +
 * chemin vers l'uri de l'ELEMENT FINAL (fichier ou dossier), contrairement
 * a resoudreCheminUri ci-dessus qui exige que chaque segment soit un
 * dossier (utile pour ouvrir_sous_dossier, pas pour lire un fichier situe
 * au bout du chemin).
 */
async function resoudreCheminUriElement(
  dossierNom: string,
  chemin: string[]
): Promise<{ uri: string } | { erreur: string }> {
  if (!pluginDossiers) return { erreur: "Plugin Dossiers indisponible sur cet appareil." };
  if (chemin.length === 0) return { erreur: "Chemin vide." };

  const { dossiers } = await pluginDossiers.listerDossiersDesignes();
  const racine = trouverDossierDesigne(dossiers, dossierNom);
  if (!racine) return { erreur: `Dossier désigné "${dossierNom}" introuvable sur cet appareil.` };

  let uriCourant = racine.uri;
  for (let i = 0; i < chemin.length - 1; i++) {
    const { elements } = await pluginDossiers.listerContenu({ uri: uriCourant });
    const enfant = elements.find((e) => e.estDossier && e.nom === chemin[i]);
    if (!enfant) return { erreur: `Sous-dossier "${chemin[i]}" introuvable dans ce chemin.` };
    uriCourant = enfant.uri;
  }
  const { elements } = await pluginDossiers.listerContenu({ uri: uriCourant });
  const dernierSegment = chemin[chemin.length - 1];
  const cible = elements.find((e) => e.nom === dernierSegment);
  if (!cible) return { erreur: `Élément "${dernierSegment}" introuvable dans ce chemin.` };
  return { uri: cible.uri };
}

/**
 * Lot 4 (30/08/2026, voir 04-lecture-contenu.md) : lit le contenu brut
 * d'un fichier deja repere via un listing/une recherche precedente.
 */
async function repondreLireFichier(id: string, dossierNom: string, chemin: string[]) {
  if (!pluginDossiers) {
    envoyerReponse(id, { erreur: "Plugin Dossiers indisponible sur cet appareil." });
    return;
  }
  try {
    const resolu = await resoudreCheminUriElement(dossierNom, chemin);
    if ("erreur" in resolu) {
      envoyerReponse(id, resolu);
      return;
    }
    const lecture = await pluginDossiers.lireFichier({ uri: resolu.uri });
    envoyerReponse(id, {
      contenu_base64: lecture.contenuBase64,
      type_mime: lecture.typeMime,
      nom_fichier: lecture.nomFichier,
      tailleOctets: lecture.tailleOctets,
    });
  } catch (e) {
    envoyerReponse(id, { erreur: e instanceof Error ? e.message : "Erreur inconnue." });
  }
}

/** Parcours recursif profondeur-plafonnee, collecte TOUS les fichiers (jamais les dossiers). */
async function collecterTousFichiers(
  uri: string,
  chemin: string[],
  profondeur: number,
  resultats: ResultatRecherche[]
): Promise<void> {
  if (profondeur > PROFONDEUR_MAX_RECHERCHE || !pluginDossiers) return;

  const { elements } = await pluginDossiers.listerContenu({ uri });
  for (const element of elements) {
    const cheminElement = [...chemin, element.nom];
    if (element.estDossier) {
      await collecterTousFichiers(element.uri, cheminElement, profondeur + 1, resultats);
    } else {
      resultats.push({ ...formatterElement(element), chemin: cheminElement });
    }
  }
}

/**
 * Lot 5 (30/08/2026, voir 05-recherche-contenu-app-fermee.md) : liste
 * tous les fichiers de l'arborescence, usage interne cote backend
 * (chercher_par_contenu), jamais expose directement comme action agent.
 */
async function repondreListerTousFichiers(id: string, dossierNom: string) {
  if (!pluginDossiers) {
    envoyerReponse(id, { erreur: "Plugin Dossiers indisponible sur cet appareil." });
    return;
  }
  signalerExploration({ enCours: true, dossierNom });
  try {
    const { dossiers } = await pluginDossiers.listerDossiersDesignes();
    const racine = trouverDossierDesigne(dossiers, dossierNom);
    if (!racine) {
      envoyerReponse(id, { erreur: `Dossier désigné "${dossierNom}" introuvable sur cet appareil.` });
      return;
    }
    const resultats: ResultatRecherche[] = [];
    await collecterTousFichiers(racine.uri, [], 0, resultats);
    envoyerReponse(id, { elements: resultats });
  } catch (e) {
    envoyerReponse(id, { erreur: e instanceof Error ? e.message : "Erreur inconnue." });
  } finally {
    signalerExploration({ enCours: false });
  }
}

function traiterQuestion(id: string, question: unknown) {
  // Lot 1 : question texte simple ("es-tu là ?"), aucun vrai traitement.
  if (typeof question === "string") {
    envoyerReponse(id, "oui");
    return;
  }
  // Lot 2/3 : question structurée.
  if (question && typeof question === "object") {
    const q = question as {
      action?: string;
      dossier_nom?: string;
      chemin?: string[];
      terme_recherche?: string;
    };
    if (q.action === "lister_contenu" && q.dossier_nom) {
      repondreListerContenu(id, q.dossier_nom);
      return;
    }
    if (q.action === "ouvrir_sous_dossier" && q.dossier_nom && Array.isArray(q.chemin)) {
      repondreOuvrirSousDossier(id, q.dossier_nom, q.chemin);
      return;
    }
    if (q.action === "chercher_par_nom" && q.dossier_nom && q.terme_recherche) {
      repondreChercherParNom(id, q.dossier_nom, q.terme_recherche);
      return;
    }
    // Ajoute le 30/08/2026 (correctif Claude chat) : Lot 4/5, jusque-la
    // codes cote backend (core/exploration_dossier_mobile.py) mais sans
    // reponse possible cote app -- lire_fichier et chercher_par_contenu
    // echouaient silencieusement (repondaient "Question non reconnue").
    if (q.action === "lire_fichier" && q.dossier_nom && Array.isArray(q.chemin)) {
      repondreLireFichier(id, q.dossier_nom, q.chemin);
      return;
    }
    if (q.action === "lister_tous_fichiers" && q.dossier_nom) {
      repondreListerTousFichiers(id, q.dossier_nom);
      return;
    }
  }
  envoyerReponse(id, { erreur: "Question non reconnue par l'app." });
}

function planifierReconnexion() {
  if (fermetureVoulue || tentativeReconnexion) return;
  tentativeReconnexion = setTimeout(() => {
    tentativeReconnexion = null;
    ouvrirCanal();
  }, 3000);
}

async function ouvrirCanal() {
  if (document.visibilityState !== "visible") return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return;

  const url = urlWebSocket(session.access_token);
  if (!url) return;

  fermetureVoulue = false;
  const ws = new WebSocket(url);

  ws.onmessage = (evenement) => {
    try {
      const message = JSON.parse(evenement.data);
      // Ajoute le 02/09/2026 : deux formes de message possibles sur ce
      // meme canal desormais -- {"type": "notification_nouvelle", ...}
      // (serveur->client, fire-and-forget, voir
      // core/canal_temps_reel.py::notifier_utilisateur) distingue de
      // {"id":..., "question":...} (question->reponse existant).
      if (message?.type === "notification_nouvelle" && message?.notification) {
        ecouteursNotifications.forEach((cb) => cb(message.notification));
        return;
      }
      if (message?.id && message?.question !== undefined) {
        traiterQuestion(message.id, message.question);
      }
    } catch {
      // Message mal forme : ignore, pas de traitement a l'aveugle
      // (meme principe qu'ailleurs dans le projet : echec clair plutot
      // que deviner).
    }
  };

  ws.onclose = () => {
    if (socket === ws) socket = null;
    planifierReconnexion();
  };

  ws.onerror = () => {
    ws.close();
  };

  socket = ws;
}

function fermerCanal() {
  fermetureVoulue = true;
  if (tentativeReconnexion) {
    clearTimeout(tentativeReconnexion);
    tentativeReconnexion = null;
  }
  socket?.close();
  socket = null;
}

/**
 * A appeler une seule fois. Ouvre le canal a l'ouverture/reprise de
 * l'app (visibilitychange + retour reseau) et le ferme quand l'app
 * passe en arriere-plan, avec reconnexion automatique en cas de
 * coupure.
 *
 * Modifie le 02/09/2026 (Bourama, centre de notifications) : appele
 * desormais web ET natif (voir lib/supabase.ts) -- avant cette date,
 * uniquement natif car seule l'exploration de dossier en avait besoin.
 * L'enregistrement du plugin Dossiers (natif uniquement) est sorti
 * d'ici, voir enregistrerPluginDossiers ci-dessus : sur le web,
 * pluginDossiers reste simplement null, et repondreListerContenu (etc.)
 * repond deja proprement une erreur explicite dans ce cas -- le serveur
 * ne pose de toute facon jamais de question d'exploration a une session
 * web.
 */
export function initialiserCanalTempsReel() {
  if (dejaInitialise || typeof window === "undefined") return;
  dejaInitialise = true;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      ouvrirCanal();
    } else {
      fermerCanal();
    }
  });

  window.addEventListener("online", () => {
    ouvrirCanal();
  });

  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.access_token) {
      ouvrirCanal();
    } else if (event === "SIGNED_OUT") {
      fermerCanal();
    }
  });

  ouvrirCanal();
}
