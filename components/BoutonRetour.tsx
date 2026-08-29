"use client";

import Link from "next/link";
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
//
// Deux modes (29/08, correctif après audit plus large du dépôt) :
// - `onClick` : retour local, un état en mémoire (pile/vue) redescend
//   d'un niveau sans changer d'URL (ex: Paramètres, Dossiers du téléphone).
// - `href` : vraie navigation de route (ex: SectionPage.tsx, fil d'Ariane
//   "Personnaliser Clovis -> Mes skills") -- rendu en <Link>, même style,
//   pour que le retour reste identique visuellement que ce soit un vrai
//   changement de page ou juste un état local.
type PropsBase = {
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
};

export function BoutonRetour(
  props: PropsBase & ({ onClick: () => void; href?: undefined } | { href: string; onClick?: undefined })
) {
  const { taille = 16, avecTexte = false, padding = "p-1.5", className = "" } = props;
  const classes = `flex flex-shrink-0 items-center gap-1 rounded-lg ${padding} text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte ${className}`;
  const contenu = (
    <>
      <ChevronLeft size={taille} />
      {avecTexte && <span className="text-xs font-medium">Retour</span>}
    </>
  );

  if (props.href) {
    return (
      <Link href={props.href} aria-label="Retour" className={classes}>
        {contenu}
      </Link>
    );
  }

  return (
    <button onClick={props.onClick} aria-label="Retour" className={classes}>
      {contenu}
    </button>
  );
}
