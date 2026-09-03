"use client";

import { Suspense, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PanneauFlottant } from "@/components/PanneauFlottant";
import { BlocsMenuPlus, SECTIONS_BASE } from "@/components/EspacePlus";
import { ContexteRetour } from "@/lib/contexteRetour";
import { useFermetureAnimee } from "@/lib/useFermetureAnimee";
import { useFermerChat } from "@/lib/contexteChat";

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
//
// 03/09/2026, test Bourama (même diagnostic et même principe que
// MenuHamburgerWeb.tsx : ce panneau ne pose plus lui-même une marque
// brute dans window.history, il est piloté par un paramètre d'URL
// posé/retiré via le routeur Next). Différence avec la version web :
// le bouton retour MATÉRIEL Android (événement `backButton` de
// Capacitor) ne passe ni par popstate ni par le routeur Next, donc rien
// ne fermerait ce panneau tout seul en le pressant. On s'enregistre
// donc quand même dans la pile de calques de contexteRetour.tsx, mais
// UNIQUEMENT pour que le gestionnaire déjà existant de ce bouton
// matériel (dans contexteRetour.tsx) trouve ce menu et l'appelle,
// plutôt que de tomber sur une pile vide et minimiser l'appli. On
// utilise volontairement `remonterAuSommet` (pas `empiler`) : cette
// fonction se contente de mettre à jour la pile côté JS, sans jamais
// poser sa propre entrée brute dans window.history -- l'entrée
// d'historique réelle reste uniquement celle posée par router.push,
// jamais dupliquée. `depiler(id, false)` au nettoyage : jamais de
// history.back() automatique déclenché par ce nettoyage, seul un vrai
// router.back() (explicite, ou via le fermer() passé au dessus) change
// l'URL.
function IconeEscalier() {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} aria-hidden="true" className="transition-transform duration-200 group-hover:scale-95">
      <rect x="3" y="6" width="18" height="3" rx="1.5" fill="currentColor" />
      <rect x="3" y="11" width="12" height="3" rx="1.5" fill="currentColor" />
      <rect x="3" y="16" width="6" height="3" rx="1.5" fill="currentColor" />
    </svg>
  );
}

// Corrige l'échec de build Vercel du 03/09/2026 : `useSearchParams` (voir
// plus bas) exige d'être entouré d'un `<Suspense>` dès que le composant
// est monté sur toute l'appli sans page dédiée -- sinon Next ne peut
// pas produire les pages statiques (export utilisé pour le build
// Capacitor). Wrapper sans logique propre, juste pour isoler ce
// pré-requis technique ; toute la logique reste dans la fonction
// interne ci-dessous.
export function MenuHamburgerNatif() {
  return (
    <Suspense fallback={null}>
      <MenuHamburgerNatifInterne />
    </Suspense>
  );
}

function MenuHamburgerNatifInterne() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fermerChat = useFermerChat();
  const ctx = useContext(ContexteRetour);
  const id = useRef(`hamburger-natif-${Math.random().toString(36).slice(2)}`).current;

  const ouvert = searchParams.get("panneau") === "plus";

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

  function fermerMenu() {
    router.back();
  }

  // Voir commentaire d'en-tête : simple "réservation de place" dans la
  // pile pour que le bouton retour matériel Android sache que ce menu
  // est ouvert, sans poser d'entrée d'historique en plus de celle du
  // routeur Next.
  useEffect(() => {
    if (!ctx) return;
    if (ouvert) {
      ctx.remonterAuSommet(id, fermerMenu);
    }
    return () => ctx.depiler(id, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fermerMenu a une référence stable (router.back() seul), pas besoin de le lister
  }, [ctx, id, ouvert]);

  function ouvrirMenu() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("panneau", "plus");
    router.push(`${pathname}?${params.toString()}`);
  }

  // 03/09/2026, demande Bourama : depuis le chat plein écran, les liens
  // Accueil, Paramètres et Rappels (SECTIONS_BASE) doivent fermer le
  // chat avant de naviguer (monté globalement dans AppShell.tsx
  // indépendamment de la route, voir historique complet dans
  // clovis.md). `router.replace` plutôt que `router.push` : remplace
  // directement l'entrée `?panneau=plus` par la nouvelle page, sans
  // entrée intermédiaire en plus à traverser au retour arrière.
  function naviguerDepuisPlus(href: string) {
    fermerChat();
    router.replace(href);
  }

  return (
    <>
      <button
        onClick={ouvrirMenu}
        aria-label="Ouvrir le menu"
        className="group fixed left-2 top-[calc(0.5rem+var(--cap-native-navigation-top,var(--safe-top)))] z-40 flex h-8 w-8 items-center justify-center text-dj-texte"
      >
        <IconeEscalier />
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
