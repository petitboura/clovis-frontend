"use client";

import { useEffect, useState } from "react";
import { FolderSearch } from "lucide-react";
import { ecouterExploration } from "@/lib/canalTempsReel";

// Créé le 30/08/2026, Bourama : Lot 3 Partie 3 mobile, chantier
// "Exploration de dossier en temps réel" (voir 03-navigation-recherche-nom.md).
// Popup NON bloquante décidée avec Bourama le 29/08 : petit indicateur
// flottant pendant "ouvrir_sous_dossier"/"chercher_par_nom" (voir
// lib/canalTempsReel.ts, signalerExploration), sans fond assombri ni
// verrouillage du reste de l'app -- même langage visuel que
// BoutonFlottantTelecharger.tsx (pastille flottante, pas de modal).
// Monté une fois globalement dans app/layout.tsx.

export function PopupExplorationDossier() {
  const [dossierNom, setDossierNom] = useState<string | null>(null);

  useEffect(() => {
    return ecouterExploration((evenement) => {
      setDossierNom(evenement.enCours ? evenement.dossierNom ?? null : null);
    });
  }, []);

  if (!dossierNom) return null;

  return (
    <div
      role="status"
      className="fixed bottom-[calc(1.25rem+var(--dj-barre-onglets-web,0px))] left-1/2 z-40 flex -translate-x-1/2 animate-dj-fade-in-rapide items-center gap-2 rounded-cgpt-bouton border border-dj-bordure bg-dj-surface px-3 py-2 text-sm text-dj-texte shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
    >
      <FolderSearch size={16} className="flex-shrink-0 animate-pulse text-dj-accent-1" />
      Clovis explore {dossierNom}…
    </div>
  );
}
