"use client";

// Chantier agent applicatif, chantier C, partie frontend. Canal SEPARE
// de lib/canalTempsReel.ts (decision 0.1). Meme cycle de vie
// (ouverture/fermeture liee a visibilitychange), mais aucune logique de
// dossier ici -- uniquement la reception d'une demande d'execution
// d'action et la reponse.
//
// Rappel important (decision Bourama) : la demande est DIFFUSEE a
// TOUTES les connexions actives du compte cote backend (voir
// core/canal_agent_applicatif.py) -- si l'action `action_id` n'est pas
// montee ICI, on repond {"ignore": true} pour laisser une chance a une
// AUTRE connexion du meme compte (autre onglet/appareil) de repondre
// reellement, plutot que de faire echouer la demande a tort.
//
// Ajout chantier D (16/09/2026) : poussee continue de l'etat des
// actions disponibles, dans l'autre sens (frontend -> backend), sur ce
// meme canal separe. Envoyee une fois a l'ouverture du canal, puis a
// chaque changement detecte du DOM -- un court debounce evite une
// rafale de messages quand plusieurs elements se (dé)montent dans le
// meme cycle de rendu.
//
// Revision (17/09/2026, voir plan-scan-generique-agent-applicatif.md) :
// l'ancien systeme de declaration manuelle (chantiers A/D d'origine,
// lib/actionsApplicatives.ts + lib/useDeclarerAction.ts) est remplace
// par un scan generique et automatique du DOM
// (lib/scanElementsInteractifs.ts) -- plus aucune description ecrite a
// la main dans un composant. Le declenchement du rescan, auparavant lie
// a un evenement emis par une declaration manuelle, est desormais un
// MutationObserver generique sur le document -- coherent avec le
// principe "rien a decrire, rien a cabler a la main".
//
// Ajout chantier F (16/09/2026), fusionne ici le 17/09/2026 : meme
// canal, mode "clic par identifiant genere" -- l'element cible est
// resolu par son attribut data-agent-id (pose par le scan), jamais
// invente ni devine par le modele. Aucune metadonnee de sensibilite
// n'existe sur un element detecte automatiquement : la confirmation est
// TOUJOURS demandee, sans exception. Deplace aussi le curseur virtuel
// (chantier B) avant le clic reel, via le pont
// lib/contexteCurseurVirtuel.tsx.
//
// Ajout chantier G (16/09/2026, demande Bourama) : mode guidage --
// troisieme forme de message recue, {"id", "montrer_action_id"} :
// deplace uniquement le curseur vers l'element cible, sans jamais
// l'executer.

import { supabase } from "./supabase";
import { scannerElementsInteractifs, decrireElement } from "./scanElementsInteractifs";
import { demanderConfirmationDepuisAgent } from "./contexteConfirmationAction";
import { deplacerCurseurDepuisAgent } from "./contexteCurseurVirtuel";
import { estVisibleEtActif, resoudreElementCliquable } from "./clicGenerique";

const ATTRIBUT_AGENT_ID = "data-agent-id";

// Désactivation temporaire (18/09/2026, demande Bourama : "elle gâte
// absolument tout", le temps de tester le reste sans être interrompu à
// chaque action) -- décision explicitement PAS définitive, à revoir
// (voir la discussion sur une confirmation seulement pour les actions
// destructrices/irréversibles). Remettre à `false` restaure la
// confirmation systématique partout, sans autre changement de code.
const CONFIRMATION_DESACTIVEE_TEMPORAIREMENT = true;

async function confirmerOuPasserOutre(description: string): Promise<boolean> {
  if (CONFIRMATION_DESACTIVEE_TEMPORAIREMENT) return true;
  return demanderConfirmationDepuisAgent(description);
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

let socket: WebSocket | null = null;
let tentativeReconnexion: ReturnType<typeof setTimeout> | null = null;
let fermetureVoulue = false;
let dejaInitialise = false;
let observateurDom: MutationObserver | null = null;

function resoudreElementParAgentId(agentId: string): HTMLElement | null {
  let element: Element | null;
  try {
    element = document.querySelector(`[${ATTRIBUT_AGENT_ID}="${CSS.escape(agentId)}"]`);
  } catch {
    return null;
  }
  if (!(element instanceof HTMLElement)) return null;
  if (!estVisibleEtActif(element)) return null;
  return element;
}

function urlWebSocket(token: string): string | null {
  if (!API_URL) return null;
  const base = API_URL.replace(/^http/, "ws");
  // appareil_id volontairement absent (pas de cible a identifier, voir
  // core/canal_agent_applicatif.py) -- le backend n'utilise cette
  // connexion que pour diffuser, jamais pour cibler.
  return `${base}/api/canal-agent-applicatif/ws?token=${encodeURIComponent(token)}`;
}

function envoyerReponse(id: string, resultat: unknown) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ id, resultat }));
}

let debounceEtatActions: ReturnType<typeof setTimeout> | null = null;

function envoyerEtatActionsMaintenant() {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ etat_actions: scannerElementsInteractifs() }));
}

/**
 * Poussee chantier D : un court debounce (200ms) evite d'envoyer un
 * message par action quand plusieurs se (dé)montent dans le meme cycle
 * de rendu (ex: changement de page qui démonte 5 boutons d'un coup),
 * sans introduire de latence perceptible pour Clovis.
 */
function envoyerEtatActions() {
  if (debounceEtatActions) clearTimeout(debounceEtatActions);
  debounceEtatActions = setTimeout(() => {
    debounceEtatActions = null;
    envoyerEtatActionsMaintenant();
  }, 200);
}

/**
 * Chantier C, revise (17/09/2026) pour le scan generique : `actionId`
 * est un identifiant genere par le scan (attribut data-agent-id), pas
 * un identifiant declare a la main. Tout element issu du scan est
 * TOUJOURS sensible (aucun jugement de sensibilite possible sur un
 * element dont on ne sait rien d'autre que sa presence a l'ecran) :
 * la confirmation est donc systematique, sans exception -- meme
 * principe que traiterDemandeClicGenerique ci-dessous, dont ce mode
 * se rapproche desormais beaucoup (difference : l'identifiant est
 * genere par le scan plutot que devine par le modele).
 */
async function traiterDemandeAction(id: string, actionId: string) {
  const element = resoudreElementParAgentId(actionId);

  // Pas montee ICI (autre onglet/appareil, ou element deja disparu) :
  // "ignore", jamais une erreur -- laisse la vraie connexion repondre.
  if (!element) {
    envoyerReponse(id, { ignore: true });
    return;
  }

  // La description est derivee de l'element REEL au moment de la
  // confirmation (pas transmise par le backend, qui ne connait
  // l'element que par son id genere) -- toujours a jour, jamais perimee
  // meme si le texte visible a change depuis le dernier scan.
  const accepte = await confirmerOuPasserOutre(decrireElement(element));
  if (!accepte) {
    envoyerReponse(id, { refuse: true });
    return;
  }

  // Revalidation juste avant execution (l'ecran a pu changer pendant
  // que l'etudiant repondait a la fenetre de confirmation).
  const elementRevalide = resoudreElementParAgentId(actionId);
  if (!elementRevalide) {
    envoyerReponse(id, { erreur: "L'action n'est plus disponible à l'écran (l'écran a changé)." });
    return;
  }

  try {
    elementRevalide.scrollIntoView({ block: "center", inline: "center", behavior: "auto" });
    await deplacerCurseurDepuisAgent(elementRevalide, { cliquer: true, forme: "main" });

    // Toute derniere verification, juste avant le clic physique.
    if (!document.body.contains(elementRevalide) || !estVisibleEtActif(elementRevalide)) {
      envoyerReponse(id, { erreur: "L'élément a disparu juste avant le clic." });
      return;
    }

    elementRevalide.click();
    envoyerReponse(id, { succes: true });
  } catch (e) {
    envoyerReponse(id, { erreur: e instanceof Error ? e.message : "Erreur inconnue lors de l'exécution." });
  }
}

/**
 * Chantier F : mode générique de secours. Contrairement à
 * traiterDemandeAction, aucune métadonnée de sensibilité n'existe ici
 * -- la confirmation est donc TOUJOURS demandée, sans exception (défaut
 * prudent, décision Bourama).
 */
async function traiterDemandeClicGenerique(id: string, selecteur: string, description: string) {
  const element = resoudreElementCliquable(selecteur);

  // Introuvable OU trouvé mais indisponible ICI : "ignore" dans les
  // deux cas -- laisse une chance à une autre connexion du même compte
  // (même principe que traiterDemandeAction), plutôt que de conclure à
  // tort que l'élément n'existe nulle part.
  if (!element) {
    envoyerReponse(id, { ignore: true });
    return;
  }

  const accepte = await confirmerOuPasserOutre(description);
  if (!accepte) {
    envoyerReponse(id, { refuse: true });
    return;
  }

  // Revalidation juste avant le clic reel : l'ecran a pu changer
  // pendant que l'etudiant repondait a la fenetre de confirmation.
  const elementRevalide = resoudreElementCliquable(selecteur);
  if (!elementRevalide) {
    envoyerReponse(id, { erreur: "L'élément n'est plus disponible à l'écran (l'écran a changé)." });
    return;
  }

  elementRevalide.scrollIntoView({ block: "center", inline: "center", behavior: "auto" });
  await deplacerCurseurDepuisAgent(elementRevalide, { cliquer: true, forme: "main" });

  // Toute dernière vérification, juste avant le clic physique -- le
  // défilement ou l'animation du curseur pourrait, en théorie, avoir
  // fait disparaître l'élément entre temps.
  if (!document.body.contains(elementRevalide) || !estVisibleEtActif(elementRevalide)) {
    envoyerReponse(id, { erreur: "L'élément a disparu juste avant le clic." });
    return;
  }

  try {
    elementRevalide.click();
    envoyerReponse(id, { succes: true });
  } catch (e) {
    envoyerReponse(id, { erreur: e instanceof Error ? e.message : "Erreur inconnue lors du clic." });
  }
}

/**
 * Chantier G (mode guidage, 16/09/2026, demande Bourama). Deplace
 * simplement le curseur virtuel vers l'element cible, SANS l'executer.
 * Jamais de confirmation ici : un simple pointage visuel n'a aucun
 * effet sur les donnees de l'etudiant.
 */
async function traiterDemandeMontrer(id: string, actionId: string) {
  const element = resoudreElementParAgentId(actionId);
  if (!element) {
    envoyerReponse(id, { ignore: true });
    return;
  }

  element.scrollIntoView({ block: "center", inline: "center", behavior: "auto" });
  await deplacerCurseurDepuisAgent(element, { cliquer: false, forme: "main" });
  envoyerReponse(id, { succes: true });
}

function traiterMessage(message: unknown) {
  if (!message || typeof message !== "object") return;
  const m = message as {
    id?: string;
    action_id?: string;
    selecteur_generique?: string;
    description?: string;
    montrer_action_id?: string;
  };
  if (m.id && m.action_id) {
    traiterDemandeAction(m.id, m.action_id);
  } else if (m.id && m.selecteur_generique) {
    traiterDemandeClicGenerique(m.id, m.selecteur_generique, m.description ?? "une action dans l'application");
  } else if (m.id && m.montrer_action_id) {
    traiterDemandeMontrer(m.id, m.montrer_action_id);
  }
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

  ws.onopen = () => {
    // Etat initial des actions disponibles pour CETTE connexion, sans
    // attendre un changement (chantier D) -- sinon le backend n'a rien
    // tant qu'aucune action ne se (dé)monte apres l'ouverture.
    envoyerEtatActionsMaintenant();
    demarrerObservationDom();
  };

  ws.onmessage = (evenement) => {
    try {
      traiterMessage(JSON.parse(evenement.data));
    } catch {
      // Message mal forme : ignore, meme principe que canalTempsReel.ts.
    }
  };

  ws.onclose = () => {
    if (socket === ws) socket = null;
    arreterObservationDom();
    planifierReconnexion();
  };

  ws.onerror = () => {
    ws.close();
  };

  socket = ws;
}

/**
 * Remplace l'ancien evenement "clovis:actions_modifiees" (declaration
 * manuelle) par une observation generique du DOM : tout changement de
 * structure (montage/demontage) ou d'etat (disabled, aria-disabled,
 * hidden) declenche un rescan debounce -- coherent avec le principe
 * "rien a decrire, rien a cabler a la main" du scan generique. Actif
 * uniquement pendant qu'une connexion est ouverte, pour eviter du
 * travail inutile quand personne n'ecoute cote backend.
 */
function demarrerObservationDom() {
  if (observateurDom || typeof document === "undefined") return;
  observateurDom = new MutationObserver(() => {
    envoyerEtatActions();
  });
  observateurDom.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["disabled", "aria-disabled", "hidden", "aria-hidden"],
  });
}

function arreterObservationDom() {
  observateurDom?.disconnect();
  observateurDom = null;
}

function fermerCanal() {
  fermetureVoulue = true;
  if (tentativeReconnexion) {
    clearTimeout(tentativeReconnexion);
    tentativeReconnexion = null;
  }
  arreterObservationDom();
  socket?.close();
  socket = null;
}

/** À appeler une seule fois, même schéma que initialiserCanalTempsReel. */
export function initialiserCanalAgentApplicatif() {
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
