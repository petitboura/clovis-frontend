"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PanneauFlottant } from "@/components/PanneauFlottant";
import { BlocsMenuPlus, SECTIONS_BASE } from "@/components/EspacePlus";
import { useFermetureAuRetour } from "@/lib/contexteRetour";
import { useFermetureAnimee } from "@/lib/useFermetureAnimee";
import { useFermerChat } from "@/lib/contexteChat";

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
  const router = useRouter();
  const fermerChat = useFermerChat();

  // 03/09/2026, demande Bourama : même correctif que MenuHamburgerNatif.tsx
  // (voir son commentaire) -- Accueil, Paramètres et Rappels (SECTIONS_BASE)
  // naviguaient via router.push sans fermer le chat plein écran, monté
  // globalement dans AppShell.tsx indépendamment de la route, donc la page
  // cible se chargeait derrière lui et restait invisible. D'abord limité à
  // Accueil seul, étendu à Paramètres et Rappels le même jour sur
  // confirmation explicite de Bourama. Connecter Claude n'a pas été
  // signalé ni confirmé, pas touché ici.
  function naviguerDepuisPlus(href: string) {
    if (href === "/" || href === "/parametres" || href === "/rappels") fermerChat();
    router.push(href);
  }

  // 01/09/2026 (Bourama : "plein de boutons qui se ferment et s'ouvrent
  // brut, surtout le hamburger") : ce panneau passait déjà par
  // PanneauFlottant, mais sans jamais lui passer `enSortie` -- il
  // s'ouvrait donc avec animation (cgpt-entree-modal) mais se fermait
  // d'un coup, comme les 8 popups qui utilisaient ce même composant
  // avant le correctif du 18/08 (voir lib/useFermetureAnimee.ts).
  // Branché ici sur le même mécanisme.
  const { enSortie, demarrerFermeture } = useFermetureAnimee();

  // Correctif (30/08/2026, Bourama : "tu clique sur une section ça
  // change mais tu ne vois pas") : les liens de BlocsMenuPlus naviguent
  // via router.push (voir EspacePlus.tsx), qui ne referme jamais ce
  // panneau -- PanneauFlottant est un fond noir plein écran (z-50), donc
  // la nouvelle page se chargeait bien derrière mais restait invisible,
  // cachée par le panneau resté ouvert. Fermeture automatique dès que le
  // chemin change (couvre aussi bien un lien direct qu'un retour
  // arrière/avant navigateur), sans toucher Partager/Avis (Deplie via
  // state local dans BlocsMenuPlus, jamais une navigation, donc jamais
  // concernés par ce changement de pathname). 01/09/2026 : passe
  // désormais par demarrerFermeture comme toute autre fermeture, pour ne
  // pas réintroduire une fermeture brute sur ce seul chemin.
  useEffect(() => {
    if (ouvert) demarrerFermeture(() => setOuvert(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne doit réagir qu'à un changement de pathname, pas à ouvert/demarrerFermeture
  }, [pathname]);

  // Correctif (01/09/2026) : meme trou que MenuHamburgerNatif.tsx (voir
  // son commentaire) -- ce panneau ne s'enregistrait jamais comme calque
  // dans lib/contexteRetour.tsx. Le fallback popstate du 31/08 couvre
  // aussi le web mobile Android (pas seulement le natif), donc ce menu
  // devait s'y empiler comme les autres calques deja cables.
  useFermetureAuRetour(ouvert, () => demarrerFermeture(() => setOuvert(false)));

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
        <PanneauFlottant
          onFerme={() => demarrerFermeture(() => setOuvert(false))}
          entete={<span className="text-sm font-medium text-dj-texte">Plus</span>}
          enSortie={enSortie}
        >
          <BlocsMenuPlus sectionsNavigation={SECTIONS_BASE} onNaviguer={naviguerDepuisPlus} />
        </PanneauFlottant>
      )}
    </>
  );
}
