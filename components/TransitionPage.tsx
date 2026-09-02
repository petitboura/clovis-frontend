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
// 02/09/2026, demande Bourama ("ça s'éteint puis ça se rallume", "comme
// Claude et ChatGPT") : `mode="wait"` ci-dessus faisait un fondu
// SÉQUENTIEL (l'ancienne section tombe à opacity 0 en entier, PUIS la
// nouvelle remonte de 0 à 1) -- d'où cet instant où l'écran est
// totalement vide entre les deux, perçu comme "éteint puis rallumé" au
// lieu d'un vrai fondu enchaîné.
//
// Le `mode="wait"` avait été choisi pour éviter un vrai bug
// d'accumulation : SANS lui (superposition par défaut d'AnimatePresence),
// les deux <motion.div> restent dans le flux normal du document pendant
// qu'elles coexistent, donc elles s'empilent VERTICALEMENT (l'ancienne
// section, suivie en dessous de la nouvelle) au lieu de se superposer au
// même endroit -- ça double temporairement la hauteur du conteneur
// scrollable (<main> dans AppShell.tsx), pas un vrai chevauchement
// visuel.
//
// Solution (comme Claude/ChatGPT, qui superposent réellement l'ancienne
// et la nouvelle page au même endroit pendant le crossfade) : garder la
// superposition par défaut (donc retirer mode="wait"), mais sortir
// l'élément SORTANT du flux normal (position: absolute) dès qu'il
// commence son animation "exit", pendant que l'élément ENTRANT reste en
// position normale (relative) et prend sa propre place tout de suite.
// Les deux se retrouvent alors au même endroit (grâce au wrapper
// position:relative ci-dessous, qui sert de référence à cet absolute) et
// se fondent l'un dans l'autre au lieu de s'empiler -- plus de bug de
// hauteur doublée, plus de blanc entre les deux.
//
// `position` n'est pas une propriété numérique animable par
// framer-motion, mais elle est appliquée instantanément au début de
// l'animation correspondante (initial/animate/exit), ce qui suffit ici :
// seule l'opacité a besoin d'être progressive, le changement de position
// peut être immédiat.
//
// key={pathname} est ce qui déclenche AnimatePresence : sans lui, React
// verrait toujours "la même" instance de <motion.div> d'une route à
// l'autre (même position dans l'arbre) et ne jouerait jamais exit/enter.
export function TransitionPage({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ position: "relative" }}>
      <AnimatePresence initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, position: "relative" }}
          animate={{ opacity: 1, position: "relative" }}
          exit={{ opacity: 0, position: "absolute", top: 0, left: 0, right: 0 }}
          transition={{ duration: 0.18, ease: "easeInOut" }}
          style={{ width: "100%" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
