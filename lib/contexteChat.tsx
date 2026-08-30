"use client";

import { createContext, useContext } from "react";

export type EtatChat = "fermee" | "mini" | "plein_ecran";

type ContexteChatValeur = {
  etat: EtatChat;
  setEtat: (etat: EtatChat) => void;
};

// L'état du chat flottant (fermee/mini/plein_ecran) vivait auparavant
// dans ChatFlottant.tsx lui-même. Remonté ici dans AppShell.tsx pour
// pouvoir être piloté depuis d'autres écrans (ex: bouton "Ouvrir le
// chat" sur l'écran d'accueil, 16/08/2026) -- ChatFlottant devient un
// composant contrôlé (etat + setEtat reçus en props).
export const ContexteChat = createContext<ContexteChatValeur | null>(null);

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
