import { supabase } from "./supabase";

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

type PluginDossiers = {
  listerDossiersDesignes(): Promise<{ dossiers: DossierDesigne[] }>;
  listerContenu(options: { uri: string }): Promise<{ elements: ElementDossier[] }>;
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
    const dossier = dossiers.find((d) => d.nom === dossierNom);
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
  const racine = dossiers.find((d) => d.nom === dossierNom);
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
    const racine = dossiers.find((d) => d.nom === dossierNom);
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
 * A appeler une seule fois, uniquement cote natif (voir lib/supabase.ts,
 * qui fournit `registerPlugin` -- deja resolu la-bas via l'import
 * dynamique de @capacitor/core, pas la peine de le reimporter ici).
 * Ouvre le canal a l'ouverture/reprise de l'app (visibilitychange +
 * retour reseau) et le ferme quand l'app passe en arriere-plan, avec
 * reconnexion automatique en cas de coupure.
 */
export function initialiserCanalTempsReel(registerPlugin: <T>(name: string) => T) {
  if (dejaInitialise || typeof window === "undefined") return;
  dejaInitialise = true;

  pluginDossiers = registerPlugin<PluginDossiers>("Dossiers");

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
