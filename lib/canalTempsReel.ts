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
// Pour ce lot, aucun traitement reel des questions recues : on repond
// juste "oui" a n'importe quelle question, pour valider le tuyau de
// bout en bout. Le vrai routage (lister un dossier, lire un fichier...)
// arrive aux lots 2 a 5.

const API_URL = process.env.NEXT_PUBLIC_API_URL;

let socket: WebSocket | null = null;
let tentativeReconnexion: ReturnType<typeof setTimeout> | null = null;
let fermetureVoulue = false;
let dejaInitialise = false;

function urlWebSocket(token: string): string | null {
  if (!API_URL) return null;
  const base = API_URL.replace(/^http/, "ws");
  return `${base}/api/canal-temps-reel/ws?token=${encodeURIComponent(token)}`;
}

function repondreTest(id: string) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ id, reponse: "oui" }));
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
      if (message?.id && message?.question) {
        repondreTest(message.id);
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
 * A appeler une seule fois, uniquement cote natif (voir lib/supabase.ts).
 * Ouvre le canal a l'ouverture/reprise de l'app (visibilitychange +
 * retour reseau) et le ferme quand l'app passe en arriere-plan, avec
 * reconnexion automatique en cas de coupure.
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
