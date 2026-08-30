"use client";

import { useState } from "react";
import { PanneauFlottant } from "@/components/PanneauFlottant";
import { BlocsMenuPlus, SECTIONS_BASE } from "@/components/EspacePlus";

// Créé le 30/08/2026, tâche 2 (menu hamburger natif), Bourama.
//
// Remplace, pour l'appli native, ce que l'onglet Plus de la barre du bas
// portait avant la tâche 1 (voir BarreOngletsNative.tsx) : Connecter
// Claude, Bureau, Paramètres, Partager, Avis sur Clovis, Pourquoi Clovis.
// Personnaliser Clovis n'est PAS repris ici, il est resté dans la barre
// du bas (tâche 1) -- exigence explicite du document de tâche.
//
// Contenu et comportement 100% repris de BlocsMenuPlus (voir
// components/EspacePlus.tsx), pas dupliqué : seule la porte d'entrée
// change (bouton hamburger + panneau flottant, plutôt qu'une page /plus).
//
// Forme de l'icône, exigence précise de Bourama (pas les 3 barres
// classiques de même longueur) : 3 barres horizontales alignées à
// gauche, de longueur décroissante, empilées comme un escalier --
// aperçu visuel montré le 30/08/2026, retour de Bourama pris en compte
// (voir dimensions resserrées dans IconeEscalier ci-dessous).
//
// N'est rendu que côté natif (voir AppShell.tsx, condition `natif`) :
// sur le web/PWA mobile, BarreOngletsWeb.tsx a déjà son propre onglet
// Plus qui mène à la page /plus, jamais touché par ce chantier natif.
// 30/08/2026, retour de Bourama après aperçu visuel : barres trop
// longues et trop espacées dans la première version -- resserrées
// (ecart vertical reduit de 6 a 3 unites sur 24) et raccourcies (14/10/6
// au lieu de 18/12/6), rendu aussi a une taille plus petite (16px au
// lieu de 18px) sur le bouton.
function IconeEscalier() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true" className="transition-transform duration-200 group-hover:scale-95">
      <g stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <line x1="4" y1="9" x2="18" y2="9" />
        <line x1="4" y1="12" x2="14" y2="12" />
        <line x1="4" y1="15" x2="10" y2="15" />
      </g>
    </svg>
  );
}

export function MenuHamburgerNatif() {
  const [ouvert, setOuvert] = useState(false);

  return (
    <>
      <button
        onClick={() => setOuvert(true)}
        aria-label="Ouvrir le menu"
        className="group fixed left-2 top-[calc(0.5rem+var(--cap-native-navigation-top,0px))] z-40 flex h-8 w-8 items-center justify-center rounded-md bg-black/35 text-white hover:bg-black/50"
      >
        <IconeEscalier />
      </button>

      {ouvert && (
        <PanneauFlottant onFerme={() => setOuvert(false)} entete={<span className="text-sm font-medium text-dj-texte">Plus</span>}>
          <BlocsMenuPlus sectionsNavigation={SECTIONS_BASE} />
        </PanneauFlottant>
      )}
    </>
  );
}
