"use client";

import { useState, type MouseEvent, type ReactNode } from "react";

/**
 * 07/09/2026, demande Bourama : les tooltips natifs du navigateur
 * (attribut title= sur un texte tronqué) ne suivent pas notre thème --
 * fond blanc, police système, hors de notre contrôle. Motif déjà
 * présent ailleurs pour les badges d'état (voir BibliothequePublique.tsx
 * / EspaceBibliotheque.tsx, "badgeInfoId") : une bulle absolue dans nos
 * couleurs (bg-dj-surface, border-dj-bordure), affichée au survol ET au
 * clic (le clic est indispensable sur mobile natif/tactile, qui n'a pas
 * de survol). Ce composant généralise ce motif pour être réutilisé
 * partout où un texte tronqué (truncate/line-clamp) doit révéler sa
 * version complète, au lieu de dupliquer la bulle à chaque endroit.
 */
export function BulleSurvol({
  texte,
  className,
  align = "gauche",
  revelerAuClic = true,
  children,
}: {
  /** Texte complet affiché dans la bulle. */
  texte: string;
  /** Classes appliquées à l'élément tronqué (ex: "truncate", "line-clamp-2"). */
  className?: string;
  /** Côté sur lequel la bulle s'aligne (utile près d'un bord d'écran). */
  align?: "gauche" | "droite";
  /** false quand l'élément tronqué a déjà sa propre action au clic (ex:
   * un bouton qui ouvre autre chose) -- la bulle reste alors accessible
   * au survol seulement, pour ne pas voler ce clic. */
  revelerAuClic?: boolean;
  children: ReactNode;
}) {
  const [ouvert, setOuvert] = useState(false);

  function basculer(e: MouseEvent) {
    e.stopPropagation();
    setOuvert((o) => !o);
  }

  return (
    <span
      className="relative inline-block min-w-0 max-w-full align-top"
      onMouseEnter={() => setOuvert(true)}
      onMouseLeave={() => setOuvert(false)}
    >
      <span className={className} onClick={revelerAuClic ? basculer : undefined}>
        {children}
      </span>
      {ouvert && (
        <span
          onClick={(e) => e.stopPropagation()}
          className={`absolute top-full z-50 mt-1 w-64 max-w-[80vw] rounded-cgpt-bouton border border-dj-bordure bg-dj-surface p-2 text-[11px] font-normal text-dj-texte shadow-xl animate-dj-fade-in-rapide ${
            align === "droite" ? "right-0" : "left-0"
          }`}
        >
          {texte}
        </span>
      )}
    </span>
  );
}
