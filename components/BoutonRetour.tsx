"use client";

import { ChevronLeft } from "lucide-react";

// Bouton retour partagé (29/08/2026, demande Bourama : uniformiser les
// boutons retour de toute l'app). Avant ce composant, deux
// implémentations différentes coexistaient : ArrowLeft dans
// EspaceParametres.tsx, ChevronLeft dans EspaceDossiers.tsx. Chevron
// retenu (déjà majoritaire dans le code, norme iOS pour ce type de
// retour, plus léger visuellement qu'une flèche pleine) -- un seul
// composant réutilisé partout plutôt que du code dupliqué, pour que
// toute future évolution de ce bouton (taille, couleur, animation) se
// fasse à un seul endroit.
//
// Toujours en haut à gauche de l'écran/panneau où il est monté (norme
// desktop ET mobile), jamais dans la barre d'onglets du bas -- ce sont
// deux registres différents (onglets = navigation entre sections,
// retour = remonter d'un niveau dans une pile d'écrans).
export function BoutonRetour({
  onClick,
  taille = 16,
  avecTexte = false,
  padding = "p-1.5",
  className = "",
}: {
  onClick: () => void;
  /** Taille de l'icône en px. 16 par défaut (en-tête de page), 14 pour
   * un contexte plus compact (ex: à l'intérieur d'un panneau flottant). */
  taille?: number;
  /** Ajoute le mot "Retour" à côté du chevron -- réservé aux contextes où
   * aucun titre de page ne suit déjà le bouton (ex: dans un panneau). */
  avecTexte?: boolean;
  /** Padding du bouton -- prop dédiée plutôt que de la faire passer par
   * className, pour éviter qu'une classe Tailwind de padding passée en
   * className entre en conflit avec celle-ci (deux classes de padding
   * dans la même chaîne = ordre de la feuille de style généré, pas de
   * l'appelant, qui décide -- résultat imprévisible). */
  padding?: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label="Retour"
      className={`flex flex-shrink-0 items-center gap-1 rounded-lg ${padding} text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte ${className}`}
    >
      <ChevronLeft size={taille} />
      {avecTexte && <span className="text-xs font-medium">Retour</span>}
    </button>
  );
}
