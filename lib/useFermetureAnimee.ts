import { useCallback, useEffect, useRef, useState } from "react";

// 18/08/2026, demande Bourama ("ton truc là s'affiche et se ferme
// brutement j'aime pas") : PanneauFlottant.tsx n'avait qu'une animation
// d'ENTRÉE (cgpt-entree-modal) -- à la fermeture, le composant qui le
// rend arrêtait de le monter instantanément (`{condition && <PanneauFlottant>}`),
// donc React le retirait du DOM sans transition, quelle que soit
// l'animation CSS déclarée dessus.
//
// Ce hook centralise la seule façon correcte de faire ça en React sans
// librairie d'animation : GARDER le composant monté un peu plus
// longtemps que sa condition d'affichage réelle, le temps qu'une classe
// de sortie (cgpt-sortie-modal, voir tailwind.config.ts) joue, puis
// démonter réellement (appeler la fonction de fermeture "vraie" -- en
// général `() => setXxx(null)`) une fois l'animation terminée.
//
// DUREE_FERMETURE_MS doit rester synchronisée avec la durée de
// l'animation "cgpt-sortie-modal" dans tailwind.config.ts.
const DUREE_FERMETURE_MS = 180;

export function useFermetureAnimee() {
  const [enSortie, setEnSortie] = useState(false);
  // Évite un double déclenchement (ex. clic rapide sur le fond ET sur le
  // bouton Fermer avant la fin du minuteur) qui appellerait deux fois la
  // fermeture réelle.
  const dejaDeclenche = useRef(false);
  // 04/09/2026, bug signalé par Bourama : si le composant qui utilise ce
  // hook se démonte pendant les 180ms de l'animation de sortie (ex. le
  // panneau parent qui se ferme d'un coup), le minuteur ci-dessous
  // s'exécutait quand même et appelait setEnSortie/setOuvert sur un
  // composant déjà démonté (avertissement React, travail inutile).
  const minuteurRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (minuteurRef.current) clearTimeout(minuteurRef.current);
    };
  }, []);

  const demarrerFermeture = useCallback((fermerReel: () => void) => {
    if (dejaDeclenche.current) return;
    dejaDeclenche.current = true;
    setEnSortie(true);
    minuteurRef.current = setTimeout(() => {
      fermerReel();
      // Réinitialisé pour la prochaine ouverture de ce même panneau (le
      // composant appelant reste monté au-delà d'une fermeture, seul
      // PanneauFlottant se démonte -- ce state, lui, doit repartir à
      // zéro pour la prochaine fois).
      dejaDeclenche.current = false;
      setEnSortie(false);
      minuteurRef.current = null;
    }, DUREE_FERMETURE_MS);
  }, []);

  return { enSortie, demarrerFermeture };
}
