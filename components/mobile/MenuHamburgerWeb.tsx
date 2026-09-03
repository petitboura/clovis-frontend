"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PanneauFlottant } from "@/components/PanneauFlottant";
import { BlocsMenuPlus, SECTIONS_BASE } from "@/components/EspacePlus";
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
//
// 03/09/2026, test Bourama (diagnostic : window.history.pushState/
// replaceState est réécrit en interne par Next depuis la 14.1+, ce qui
// rend le marquage brut de contexteRetour.tsx non fiable) -- ce panneau
// est le premier cas de test d'une approche différente : piloté par un
// paramètre d'URL (?panneau=plus), posé/retiré uniquement via le
// routeur Next (router.push/back), qui gère alors lui même sa vraie
// entrée d'historique, jamais écrasée. Côté web, Next écoute déjà
// popstate en interne (bouton retour navigateur) et remet
// useSearchParams à jour tout seul -- plus besoin de s'enregistrer dans
// la pile de calques de contexteRetour.tsx pour ce menu précis, qui
// n'est donc plus du tout impliqué ici côté web (contrairement au
// natif, voir MenuHamburgerNatif.tsx, où le bouton retour matériel
// Android ne passe ni par popstate ni par Next). Test limité à ce seul
// menu avant généralisation éventuelle aux autres calques (popups,
// tiroir, chat plein écran, modales), inchangés pour l'instant.
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
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fermerChat = useFermerChat();

  // Seule source de vérité pour l'ouverture : le paramètre d'URL, jamais
  // un state local -- c'est tout l'intérêt du test (voir commentaire
  // plus haut).
  const ouvert = searchParams.get("panneau") === "plus";

  // `monte` reste vrai un court instant après que `ouvert` soit
  // redevenu faux, le temps que l'animation de sortie joue (même
  // principe que l'ancien state local, mais maintenant dérivé du
  // paramètre d'URL au lieu de le remplacer).
  const [monte, setMonte] = useState(ouvert);
  const { enSortie, demarrerFermeture } = useFermetureAnimee();

  useEffect(() => {
    if (ouvert) {
      setMonte(true);
    } else if (monte) {
      demarrerFermeture(() => setMonte(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne doit réagir qu'au paramètre d'URL, pas à monte/demarrerFermeture (référence stable de toute façon)
  }, [ouvert]);

  function ouvrirMenu() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("panneau", "plus");
    router.push(`${pathname}?${params.toString()}`);
  }

  // Fermeture explicite (bouton X, clic à côté) : symétrique de
  // l'ouverture, on retire la même entrée d'historique que router.push
  // a posée -- le bouton retour navigateur fait exactement la même
  // chose de son côté, Next relit alors seul la nouvelle valeur de
  // useSearchParams, ce qui déclenche l'animation de sortie ci-dessus.
  function fermerMenu() {
    router.back();
  }

  // 03/09/2026, demande Bourama : tous les liens de SECTIONS_BASE
  // (Accueil, Paramètres, Rappels, Connecter Claude) doivent fermer le
  // chat plein écran avant de naviguer (monté globalement dans
  // AppShell.tsx indépendamment de la route, sinon la page cible se
  // charge derrière lui et reste invisible -- voir historique complet
  // dans clovis.md). `router.replace` plutôt que `router.push` : on
  // remplace l'entrée `?panneau=plus` par la nouvelle page directement,
  // sans entrée intermédiaire à traverser en plus au retour arrière.
  function naviguerDepuisPlus(href: string) {
    fermerChat();
    router.replace(href);
  }

  return (
    <>
      <button
        onClick={ouvrirMenu}
        aria-label="Ouvrir le menu"
        className="group fixed left-2 top-[calc(0.5rem+var(--safe-top,0px))] z-40 flex h-8 w-8 items-center justify-center text-dj-texte md:hidden"
      >
        <IconeMenu />
      </button>

      {monte && (
        <PanneauFlottant
          onFerme={fermerMenu}
          entete={<span className="text-sm font-medium text-dj-texte">Plus</span>}
          enSortie={enSortie}
        >
          <BlocsMenuPlus sectionsNavigation={SECTIONS_BASE} onNaviguer={naviguerDepuisPlus} />
        </PanneauFlottant>
      )}
    </>
  );
}
