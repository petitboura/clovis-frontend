"use client";

import { createContext, useContext } from "react";

// Créé le 28/08/2026, Bourama : suite du chantier "web mobile façon
// appli" -- "Pourquoi Clovis ?" (CatalogueClovis) était piloté par un
// state local à AppShell.tsx (catalogueOuvert/setCatalogueOuvert), donc
// impossible à ouvrir depuis un écran de route classique comme
// EspacePlus.tsx (voir le point signalé le 28/08). Même schéma que
// ContexteChat (lib/contexteChat.tsx) : juste un ouvrir/fermer exposé,
// AppShell reste seul propriétaire du booléen.
type ContexteCatalogueValeur = {
  ouvrir: () => void;
};

export const ContexteCatalogue = createContext<ContexteCatalogueValeur | null>(null);

export function useOuvrirCatalogue() {
  const ctx = useContext(ContexteCatalogue);
  return () => ctx?.ouvrir();
}
