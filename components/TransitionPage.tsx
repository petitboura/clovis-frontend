"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";

// 01/09/2026, demande Bourama ("j'aime pas du tout les brut", chantier
// suite au correctif des popups qui se fermaient d'un coup) : jusqu'ici
// SectionPage.tsx (et EcranAccueil.tsx) animaient l'ENTRÉE de chaque
// section (animate-dj-fade-in), mais rien n'animait la SORTIE -- Next.js
// App Router démonte l'ancienne page d'un coup dès que la route change,
// avant même que la nouvelle ait fini son fondu d'entrée. Comme pour les
// popups (lib/useFermetureAnimee.ts), il faut garder l'ancienne page
// montée le temps qu'elle joue sa propre sortie.
//
// Approche choisie (demande Bourama : "plus robuste et rentable sur le
// long terme") : framer-motion plutôt qu'un mécanisme fait main. C'est
// la librairie de référence pour ce genre de transition avec React/Next
// (gère nativement les cas limites qu'un hook maison devrait
// réimplémenter à la main -- changement de route interrompu en plein
// milieu d'une transition, montages/démontages qui se chevauchent) :
// AnimatePresence garde l'ancien enfant monté jusqu'à la fin de son
// animation "exit" avant de le retirer du DOM, puis monte le nouveau.
//
// Durée alignée sur "dj-fade-in-rapide" (tailwind.config.ts, 0.18s) et
// non sur "dj-fade-in" (0.8s) : ce dernier a été pensé pour un vrai
// chargement de page (voir son commentaire dans tailwind.config.ts), pas
// pour un changement de section -- SectionPage.tsx qualifie lui-même la
// navigation entre sections de "changement d'onglet" dans son propre
// commentaire sur dj-fade-in-rapide, donc c'est ce rythme-là qui
// s'applique ici, pas le plus lent.
//
// `mode="wait"` plutôt que la superposition par défaut : les deux pages
// se chevaucheraient sinon (l'ancienne encore visible pendant que la
// nouvelle apparaît par-dessus), ce qui recrée visuellement le genre de
// bug d'accumulation qu'on corrige -- ici on veut un vrai fondu enchaîné
// séquentiel (sortie puis entrée), pas un cross-fade superposé.
//
// key={pathname} est ce qui déclenche AnimatePresence : sans lui, React
// verrait toujours "la même" instance de <motion.div> d'une route à
// l'autre (même position dans l'arbre) et ne jouerait jamais exit/enter.
export function TransitionPage({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: "easeInOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
