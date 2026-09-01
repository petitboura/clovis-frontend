"use client";

import { createContext, useCallback, useContext, useState } from "react";

export type EtatChat = "fermee" | "mini" | "plein_ecran";

type ContexteChatValeur = {
  etat: EtatChat;
  setEtat: (etat: EtatChat) => void;
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

  const fermerAvecFondu = useCallback(() => {
    setEnFermeture(true);
    window.setTimeout(() => {
      setEtat("fermee");
      setEnFermeture(false);
    }, DUREE_FERMETURE_MS);
  }, []);

  return { etat, setEtat, enFermeture, fermerAvecFondu };
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
// page de destination, déjà chargée derrière lui par router.push. Fermer
// directement (setEtat("fermee"), sans fondu) supprime ce délai : la
// page cible redevient visible dès que possible, plutôt que de dépendre
// d'une animation qui se termine après coup.
export function useFermerChat() {
  const ctx = useContext(ContexteChat);
  return () => ctx?.setEtat("fermee");
}
