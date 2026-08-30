"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PanneauFlottant } from "@/components/PanneauFlottant";
import { BlocsMenuPlus, SECTIONS_BASE } from "@/components/EspacePlus";

// Créé le 30/08/2026, audit navigation web mobile vs natif, étape 1.
//
// Remplace, pour le web mobile, l'ancien onglet "Plus" de
// BarreOngletsWeb.tsx (page /plus séparée, désormais une redirection).
// Même mécanique que le natif (voir MenuHamburgerNatif.tsx) : bouton
// flottant qui ouvre un panneau par-dessus l'écran plutôt qu'une
// navigation vers une nouvelle page. Contenu et comportement 100% repris
// de BlocsMenuPlus (voir components/EspacePlus.tsx), jamais dupliqué :
// un seul endroit qui définit ce que fait chaque lien, pour web et natif
// à la fois.
//
// N'est rendu que côté web mobile (voir AppShell.tsx, condition !natif)
// et caché au-delà du point de rupture md (768px, sidebar desktop garde
// son propre accès direct à Paramètres/Connecter Claude/Partager/Avis,
// voir AppSidebar.tsx), même limite que BarreOngletsWeb.tsx.
//
// Icône reprise à l'identique de celle du natif (IconeEscalier dans
// MenuHamburgerNatif.tsx), même mise à jour appliquée en même temps
// (30/08/2026, référence visuelle ChatGPT, voir commentaire détaillé
// dans MenuHamburgerNatif.tsx) : barres pleines en capsule, plus
// grandes et plus espacées, badge de fond retiré, couleur suit le
// thème (text-dj-texte) plutôt qu'un blanc fixe.
function IconeMenu() {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} aria-hidden="true" className="transition-transform duration-200 group-hover:scale-95">
      <rect x="3" y="6" width="18" height="3" rx="1.5" fill="currentColor" />
      <rect x="3" y="11" width="12" height="3" rx="1.5" fill="currentColor" />
      <rect x="3" y="16" width="6" height="3" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function MenuHamburgerWeb() {
  const [ouvert, setOuvert] = useState(false);
  const pathname = usePathname();

  // Correctif (30/08/2026, Bourama : "tu clique sur une section ça
  // change mais tu ne vois pas") : les liens de BlocsMenuPlus naviguent
  // via router.push (voir EspacePlus.tsx), qui ne referme jamais ce
  // panneau -- PanneauFlottant est un fond noir plein écran (z-50), donc
  // la nouvelle page se chargeait bien derrière mais restait invisible,
  // cachée par le panneau resté ouvert. Fermeture automatique dès que le
  // chemin change (couvre aussi bien un lien direct qu'un retour
  // arrière/avant navigateur), sans toucher Partager/Avis (Deplie via
  // state local dans BlocsMenuPlus, jamais une navigation, donc jamais
  // concernés par ce changement de pathname).
  useEffect(() => {
    setOuvert(false);
  }, [pathname]);

  return (
    <>
      <button
        onClick={() => setOuvert(true)}
        aria-label="Ouvrir le menu"
        className="group fixed left-2 top-[calc(0.5rem+var(--safe-top,0px))] z-40 flex h-8 w-8 items-center justify-center text-dj-texte md:hidden"
      >
        <IconeMenu />
      </button>

      {ouvert && (
        <PanneauFlottant onFerme={() => setOuvert(false)} entete={<span className="text-sm font-medium text-dj-texte">Plus</span>}>
          <BlocsMenuPlus sectionsNavigation={SECTIONS_BASE} />
        </PanneauFlottant>
      )}
    </>
  );
}
