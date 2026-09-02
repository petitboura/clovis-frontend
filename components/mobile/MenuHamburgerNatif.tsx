"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PanneauFlottant } from "@/components/PanneauFlottant";
import { BlocsMenuPlus, SECTIONS_BASE } from "@/components/EspacePlus";
import { useFermetureAuRetour } from "@/lib/contexteRetour";
import { useFermetureAnimee } from "@/lib/useFermetureAnimee";

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
// gauche, de longueur décroissante, empilées comme un escalier.
//
// N'est rendu que côté natif (voir AppShell.tsx, condition `natif`) :
// sur le web/PWA mobile, BarreOngletsWeb.tsx a déjà son propre onglet
// Plus qui mène à la page /plus, jamais touché par ce chantier natif.
// 30/08/2026, nouvelle demande de Bourama après référence visuelle de
// l'appli ChatGPT (aperçus validés avant code) : barres passées de
// traits fins à des barres pleines en capsule (rx arrondi), rendues
// plus grandes (24px) et plus espacées (écart vertical 5 sur 24) pour
// ne plus paraître floues/petites. Badge de fond noir arrondi retiré
// (pas la norme demandée) : l'icône flotte seule au dessus du contenu,
// donc sa couleur suit désormais le thème (text-dj-texte) au lieu d'un
// blanc fixe, sinon invisible sur le fond clair de l'app (#faf8f5).
function IconeEscalier() {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} aria-hidden="true" className="transition-transform duration-200 group-hover:scale-95">
      <rect x="3" y="6" width="18" height="3" rx="1.5" fill="currentColor" />
      <rect x="3" y="11" width="12" height="3" rx="1.5" fill="currentColor" />
      <rect x="3" y="16" width="6" height="3" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function MenuHamburgerNatif() {
  const [ouvert, setOuvert] = useState(false);
  const pathname = usePathname();

  // 01/09/2026 (Bourama : "plein de boutons qui se ferment et s'ouvrent
  // brut, surtout le hamburger") : meme trou que MenuHamburgerWeb.tsx --
  // enSortie jamais passe a PanneauFlottant, donc ouverture animee mais
  // fermeture instantanee. Voir lib/useFermetureAnimee.ts.
  const { enSortie, demarrerFermeture } = useFermetureAnimee();

  // Correctif (30/08/2026) : meme bug que MenuHamburgerWeb.tsx (voir son
  // commentaire) -- BlocsMenuPlus navigue via router.push, qui ne
  // refermait jamais ce panneau plein ecran (PanneauFlottant, z-50),
  // cachant la nouvelle page pourtant bien chargee derriere. 01/09/2026 :
  // passe desormais par demarrerFermeture, pour ne pas reintroduire une
  // fermeture brute sur ce seul chemin.
  useEffect(() => {
    if (ouvert) demarrerFermeture(() => setOuvert(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne doit réagir qu'à un changement de pathname, pas à ouvert/demarrerFermeture
  }, [pathname]);

  // Correctif (01/09/2026) : ce panneau ne s'enregistrait jamais comme
  // calque dans lib/contexteRetour.tsx (voir son commentaire -- pile de
  // calques introduite le 31/08 pour le bouton retour, chat plein ecran/
  // popups de section/tiroir/modales deja cables). Restait un trou :
  // bouton retour materiel (ou popstate sur web mobile) avec ce menu
  // ouvert ne le fermait pas, minimisait l'appli / naviguait en arriere
  // a la place, menu reste ouvert derriere.
  useFermetureAuRetour(ouvert, () => demarrerFermeture(() => setOuvert(false)));

  return (
    <>
      <button
        onClick={() => setOuvert(true)}
        aria-label="Ouvrir le menu"
        className="group fixed left-2 top-[calc(0.5rem+var(--cap-native-navigation-top,var(--safe-top)))] z-40 flex h-8 w-8 items-center justify-center text-dj-texte"
      >
        <IconeEscalier />
      </button>

      {ouvert && (
        <PanneauFlottant
          onFerme={() => demarrerFermeture(() => setOuvert(false))}
          entete={<span className="text-sm font-medium text-dj-texte">Plus</span>}
          enSortie={enSortie}
        >
          <BlocsMenuPlus sectionsNavigation={SECTIONS_BASE} />
        </PanneauFlottant>
      )}
    </>
  );
}
