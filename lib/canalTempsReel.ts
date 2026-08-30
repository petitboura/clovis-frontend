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
// "dossier_nom": ...}, brancherPlugin ci-dessous decide quoi faire selon
// sa forme. Reutilise le plugin Capacitor Dossiers deja existant
// (android/.../dossiers/DossiersPlugin.kt, meme type PluginDossiers que
// components/EspaceDossiers.tsx) plutot que d'en reconstruire un.

type DossierDesigne = { uri: string; nom: string };
type ElementDossier = { uri: string; nom: string; estDossier: boolean; tailleOctets: number };

type PluginDossiers = {
  listerDossiersDesignes(): Promise<{ dossiers: DossierDesigne[] }>;
  listerContenu(options: { uri: string }): Promise<{ elements: ElementDossier[] }>;
};

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
    envoyerReponse(id, {
      elements: elements.map((e) => ({
        nom: e.nom,
        estDossier: e.estDossier,
        tailleOctets: e.estDossier ? null : e.tailleOctets,
      })),
    });
  } catch (e) {
    envoyerReponse(id, { erreur: e instanceof Error ? e.message : "Erreur inconnue." });
  }
}

function traiterQuestion(id: string, question: unknown) {
  // Lot 1 : question texte simple ("es-tu là ?"), aucun vrai traitement.
  if (typeof question === "string") {
    envoyerReponse(id, "oui");
    return;
  }
  // Lot 2 : question structurée.
  if (question && typeof question === "object") {
    const { action, dossier_nom: dossierNom } = question as { action?: string; dossier_nom?: string };
    if (action === "lister_contenu" && dossierNom) {
      repondreListerContenu(id, dossierNom);
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
