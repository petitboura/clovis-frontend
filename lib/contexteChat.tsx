"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MessageAffiche } from "@/components/chat/BulleMessage";
import { appelerApi, lireOutilsChatAgent } from "@/lib/api";
import { messageErreur } from "@/lib/erreurs";

// "plein_ecran" retiré du type le 07/09/2026 (chantier "chat plein écran
// = vraie section", étape 5) : /chat est désormais une route comme les
// autres, plus un état de ce contexte -- ChatFlottant.tsx ne gère plus
// que la bulle fermée et le popup mini.
export type EtatChat = "fermee" | "mini";

const AGENT_INVITE_ID = "clovis";

// Étape 1 (07/09/2026, chantier "chat plein écran = vraie section") :
// types + état de la conversation (agent, messages, historique...)
// déplacés ici depuis ChatFlottant.tsx, où ils vivaient en state local.
// Comportement inchangé -- ChatFlottant.tsx reste le seul composant qui
// les lit/écrit pour l'instant, seule leur adresse mémoire change, pour
// qu'une future route /chat (étape 2) puisse un jour lire exactement la
// même conversation sans que ChatFlottant.tsx reste monté en permanence.
export type AgentDetail = {
  id: string;
  nom: string;
  icone_url: string | null;
  titre_accueil: string;
  sous_titre_accueil: string;
  modeles_disponibles?: { modele_id: string; label: string; distributeur: string; palier: string }[];
  modele_choisi?: string | null;
  bouton_sans_enseignant?: boolean;
  section_mes_comportements?: boolean;
};

export type FilConversation = {
  conversation_id: string | null;
  titre: string;
  derniere_activite: string;
};

type ContexteChatValeur = {
  etat: EtatChat;
  setEtat: (etat: EtatChat) => void;
  // Étape 1 -- état de la conversation, avant local à ChatFlottant.tsx.
  chargement: "chargement" | "pret" | "erreur";
  setChargement: (v: "chargement" | "pret" | "erreur") => void;
  erreur: string | null;
  setErreur: (v: string | null) => void;
  agent: AgentDetail | null;
  setAgent: (v: AgentDetail | null) => void;
  cle: string;
  setCle: (v: string) => void;
  messagesInitiaux: MessageAffiche[];
  setMessagesInitiaux: (v: MessageAffiche[]) => void;
  nbMessages: number;
  setNbMessages: (v: number) => void;
  chargementFilConversation: boolean;
  setChargementFilConversation: (v: boolean) => void;
  outilsActifsAgent: { outils: string[]; actions_locales: string[] } | null;
  setOutilsActifsAgent: (v: { outils: string[]; actions_locales: string[] } | null) => void;
  historique: FilConversation[];
  setHistorique: (v: FilConversation[]) => void;
  texteInitialConversation: string | null;
  setTexteInitialConversation: (v: string | null) => void;
  // Fondu de fermeture (18/08/2026, demande Bourama : "le popup disparaît
  // ... brut, j'aime pas"). Remonté ici depuis ChatFlottant.tsx le
  // 30/08/2026 (audit "fermeture brutale du chat depuis le tiroir mobile")
  // -- AVANT, cette logique vivait uniquement en local dans ChatFlottant
  // (son propre bouton Fermer), et useFermerChat ci-dessous appelait
  // directement setEtat("fermee") sans fondu : deux comportements
  // différents pour fermer le même chat selon le déclencheur. Maintenant
  // partagée ici, les deux (bouton Fermer du chat ET useFermerChat)
  // passent par exactement le même mécanisme.
  enFermeture: boolean;
  fermerAvecFondu: () => void;
  // Préremplissage d'une NOUVELLE conversation (Partie 5, chantier
  // "confiance pédagogique", 06/09/2026) : un texte à déposer dans la
  // barre de saisie dès l'ouverture, sans l'envoyer -- utilisé par le
  // flux "corriger un signalement" (voir ListeCorrectionsProf.tsx et
  // useOuvrirChatAvecTexte plus bas), qui prépare le contexte pour que
  // le prof n'ait plus qu'à taper ou dicter sa correction. Consommé une
  // seule fois par ChatFlottant.tsx (setDemandePrefill(null) juste
  // après l'avoir lu), jamais réappliqué à une conversation suivante.
  demandePrefill: string | null;
  setDemandePrefill: (texte: string | null) => void;
};

// L'état du chat flottant (fermee/mini/plein_ecran) vivait auparavant
// dans ChatFlottant.tsx lui-même. Remonté ici dans AppShell.tsx pour
// pouvoir être piloté depuis d'autres écrans (ex: bouton "Ouvrir le
// chat" sur l'écran d'accueil, 16/08/2026) -- ChatFlottant devient un
// composant contrôlé (etat + setEtat reçus en props).
export const ContexteChat = createContext<ContexteChatValeur | null>(null);

// Durée du fondu de fermeture -- doit rester synchronisée avec la
// transition CSS (duration-200) appliquée dans ChatFlottant.tsx sur les
// classes de sortie (opacity-0 scale-95).
const DUREE_FERMETURE_MS = 200;

// Fournisseur de la valeur de contexte, monté une seule fois dans
// AppShell.tsx (même esprit que useFournirFenetres dans
// contexteFenetres.tsx) -- centralise l'état ET le mécanisme de fondu de
// fermeture, pour que tout composant sous ContexteChat.Provider (chat
// lui-même, tiroir mobile, popups de sections) ferme le chat exactement
// de la même façon.
export function useFournirContexteChat(): ContexteChatValeur {
  const [etat, setEtat] = useState<EtatChat>("fermee");
  const [enFermeture, setEnFermeture] = useState(false);
  const [demandePrefill, setDemandePrefill] = useState<string | null>(null);

  // Étape 1 -- état de la conversation, avant local à ChatFlottant.tsx.
  const [chargement, setChargement] = useState<"chargement" | "pret" | "erreur">("chargement");
  const [erreur, setErreur] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [cle, setCle] = useState(() => crypto.randomUUID());
  const [messagesInitiaux, setMessagesInitiaux] = useState<MessageAffiche[]>([]);
  const [nbMessages, setNbMessages] = useState(0);
  const [chargementFilConversation, setChargementFilConversation] = useState(false);
  const [outilsActifsAgent, setOutilsActifsAgent] = useState<{
    outils: string[];
    actions_locales: string[];
  } | null>(null);
  const [historique, setHistorique] = useState<FilConversation[]>([]);
  const [texteInitialConversation, setTexteInitialConversation] = useState<string | null>(null);

  // Étape 2 (07/09/2026, chantier "chat plein écran = vraie section") :
  // ce chargement initial (détail agent + outils + historique) vivait
  // avant dans ChatFlottant.tsx, monté une seule fois au niveau du
  // layout. Déplacé ici, dans le fournisseur de contexte lui-même
  // (également monté une seule fois dans AppShell.tsx), pour qu'il ne
  // se déclenche qu'UNE FOIS quel que soit le nombre de composants qui
  // liront ce contexte ensuite (ChatFlottant.tsx aujourd'hui, la future
  // route /chat demain) -- sans ce déplacement, une future page /chat
  // montée EN PLUS de ChatFlottant (toujours présent au niveau du
  // layout) aurait redéclenché son propre fetch en double.
  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const detail: AgentDetail = await appelerApi(`/api/agents/${AGENT_INVITE_ID}`);
        const [outils, fils] = await Promise.all([
          lireOutilsChatAgent(AGENT_INVITE_ID).catch(() => ({ outils: [], actions_locales: [] })),
          appelerApi(`/api/historique/${AGENT_INVITE_ID}/conversations`).catch((e) => {
            console.error("Erreur chargement historique conversations:", e);
            return [] as FilConversation[];
          }),
        ]);
        if (!annule) {
          setAgent(detail);
          setOutilsActifsAgent(outils);
          setHistorique(fils as FilConversation[]);
          setChargement("pret");
        }
      } catch (e) {
        if (!annule) {
          setErreur(messageErreur(e));
          setChargement("erreur");
        }
      }
    })();
    return () => {
      annule = true;
    };
  }, []);

  const fermerAvecFondu = useCallback(() => {
    setEnFermeture(true);
    window.setTimeout(() => {
      setEtat("fermee");
      setEnFermeture(false);
    }, DUREE_FERMETURE_MS);
  }, []);

  return {
    etat,
    setEtat,
    enFermeture,
    fermerAvecFondu,
    demandePrefill,
    setDemandePrefill,
    chargement,
    setChargement,
    erreur,
    setErreur,
    agent,
    setAgent,
    cle,
    setCle,
    messagesInitiaux,
    setMessagesInitiaux,
    nbMessages,
    setNbMessages,
    chargementFilConversation,
    setChargementFilConversation,
    outilsActifsAgent,
    setOutilsActifsAgent,
    historique,
    setHistorique,
    texteInitialConversation,
    setTexteInitialConversation,
  };
}

// Partie 5 (06/09/2026) : ouvre le chat plein écran sur une NOUVELLE
// conversation préremplie avec `texte` -- seul point d'entrée de ce
// mécanisme, pour que tout futur appelant (pas seulement
// ListeCorrectionsProf.tsx) passe par le même chemin plutôt que de
// manipuler etat/demandePrefill séparément et risquer de les désynchroniser.
export function useOuvrirChatAvecTexte() {
  const ctx = useContext(ContexteChat);
  const router = useRouter();
  // 07/09/2026 (chantier "chat plein écran = vraie section", étape 5,
  // demande Bourama : "tout va vers /chat tout") : navigue vers la
  // vraie route /chat au lieu de passer etat sur "plein_ecran" (état
  // retiré, voir EtatChat ci-dessus). fermerAvecFondu d'abord : si un
  // popup mini était déjà ouvert, il ne doit pas rester affiché
  // par-dessus la page /chat, même mécanique que fermerMiniAvantNavigation
  // (ChatFlottant.tsx) et l'action Cmd+K (PaletteCommandes.tsx).
  return (texte: string) => {
    ctx?.setDemandePrefill(texte);
    ctx?.fermerAvecFondu();
    router.push("/chat");
  };
}

export function useOuvrirChat() {
  const ctx = useContext(ContexteChat);
  // 30/08/2026, demande Bourama : sur mobile (natif et web), l'onglet
  // "Chat" de la barre du bas doit ouvrir directement le plein écran,
  // plus de petit popup "mini" intermédiaire, ce format n'a plus de sens
  // maintenant que les deux plateformes ont leur propre onglet dédié
  // (voir BarreOngletsNative.tsx/BarreOngletsWeb.tsx). Reste "mini" par
  // défaut pour les autres déclencheurs (bulle flottante desktop,
  // bouton "Ouvrir le chat" de EcranAccueil.tsx), non concernés par
  // cette demande.
  return (etat: EtatChat = "mini") => ctx?.setEtat(etat);
}

// 30/08/2026, tiroir mobile du chat plein écran (AppSidebar.tsx,
// contexteChat=true) : les liens du "Plus" repris de BlocsMenuPlus qui
// n'ont pas d'id de section (Accueil, Paramètres, Rappels -- pas
// d'équivalent OngletId, donc pas de fenêtre flottante possible via
// ouvrirFenetre) doivent fermer le chat avant de naviguer, sinon la
// page cible se charge derrière le chat toujours ouvert (fixed inset-0
// z-[110]) et reste invisible.
//
// Correctif (01/09/2026, signalé Bourama : "la section s'ouvre mais le
// chat est par dessus, rien ne bouge") : le fondu de fermerAvecFondu
// prend 200ms avant de basculer etat sur "fermee", pendant lesquelles le
// chat plein écran (fixed inset-0 z-[110]) reste affiché par dessus la
// page de destination, déjà chargée derrière lui par router.push.
//
// Correctif (05/09/2026, demande Bourama : "faut qu'il ne se ferme pas
// brutement") : le choix ci-dessus (fermeture instantanée, sans fondu)
// est abandonné pour fermerChatEtNaviguer (voir AppSidebar.tsx) au
// profit de useFermerChatAvecFondu juste en dessous -- pendant les 200ms
// de fondu, le chat plein écran reste affiché (opacité décroissante)
// PAR-DESSUS la page de destination déjà chargée derrière lui, ce qui
// est maintenant le comportement recherché plutôt qu'un défaut à éviter.
// useFermerChat (fermeture instantanée) reste utilisé ailleurs (ex:
// démontage sans navigation associée) là où aucun fondu n'est nécessaire.
export function useFermerChat() {
  const ctx = useContext(ContexteChat);
  return () => ctx?.setEtat("fermee");
}

// 05/09/2026, demande Bourama (voir commentaire ci-dessus) : variante
// avec fondu de useFermerChat, pour tout appelant qui ferme le chat en
// réaction à une vraie navigation déjà déclenchée (fermerChatEtNaviguer)
// -- même mécanisme que le bouton "Fermer" du chat plein écran
// (ChatFlottant.tsx), qui utilise déjà directement ctx.fermerAvecFondu.
export function useFermerChatAvecFondu() {
  const ctx = useContext(ContexteChat);
  return () => ctx?.fermerAvecFondu();
}
