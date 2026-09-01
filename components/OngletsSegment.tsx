"use client";

import type { LucideIcon } from "lucide-react";

// Créé le 31/08/2026, demande Bourama : les groupes d'onglets à
// soulignement (border-b-2, hérités du web) faisaient "site dans une
// appli" sur natif. Remplacé par un seul composant partagé, repris
// partout où ce pattern existait (EspaceBibliotheque, EspaceConcentration,
// MesComportements x2), au lieu d'un correctif isolé sur un seul écran.
//
// Style validé par Bourama : pas de vrai plugin natif segmented control
// disponible côté Capacitor (vérifié), donc un fond en pilule (rounded-full)
// qui apparaît derrière l'onglet actif, sans bordure ni soulignement,
// inspiré de NotebookLM. Web et natif partagent exactement le même
// composant (demande explicite : partout, pas seulement natif).
//
// Couleurs reprises des tokens déjà en place (globals.css) : --dj-accent-1-conteneur
// (fond translucide) et --dj-accent-1-texte (texte accessible sur ce fond),
// déjà utilisés ailleurs dans l'app (EspacePlus.tsx, EspaceBibliotheque.tsx),
// pas de nouvelle couleur inventée.

export interface OngletSegment {
  valeur: string;
  libelle: string;
  icone?: LucideIcon;
}

interface OngletsSegmentProps {
  onglets: OngletSegment[];
  valeur: string;
  onChange: (valeur: string) => void;
  ariaLabel: string;
  taille?: "normal" | "compact";
}

export function OngletsSegment({ onglets, valeur, onChange, ariaLabel, taille = "normal" }: OngletsSegmentProps) {
  const paddingBouton = taille === "compact" ? "px-3 py-1.5 text-xs" : "px-3.5 py-2 text-sm";

  return (
    <div role="tablist" aria-label={ariaLabel} className="flex w-full gap-1 overflow-x-auto">
      {onglets.map(({ valeur: v, libelle, icone: Icone }) => {
        const actif = v === valeur;
        return (
          <button
            key={v}
            role="tab"
            aria-selected={actif}
            onClick={() => onChange(v)}
            className={`flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-medium transition-colors duration-200 ${paddingBouton} ${
              actif ? "bg-dj-accent-1-conteneur text-dj-accent-1-texte" : "text-dj-texte-muet hover:text-dj-texte"
            }`}
          >
            {Icone && <Icone size={taille === "compact" ? 12 : 14} />}
            {libelle}
          </button>
        );
      })}
    </div>
  );
}
