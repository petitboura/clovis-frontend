"use client";

import { createContext, useCallback, useContext, useEffect, useRef } from "react";

// Créé le 31/08/2026, Bourama : "bien sûr qu'il ferme d'abord ce que
// l'utilisateur voit ou retourne en arrière" (suite du correctif bouton
// retour, voir components/mobile/GestionRetourNatif.tsx).
//
// Pile de fermeture (dernier entré, premier sorti) : tout élément qui
// s'affiche par-dessus le contenu normal de l'app (panneau, popup,
// fenêtre flottante, mode plein écran) s'enregistre ici PENDANT qu'il
// est visible, via useEmpilerRetour ci-dessous. GestionRetourNatif.tsx
// interroge cette pile en tout premier : si quelque chose y est empilé,
// c'est CE quelque chose qui se ferme au bouton retour, jamais la page
// en dessous. Pile plutôt qu'un simple booléen "un truc est ouvert" :
// gère le cas de plusieurs panneaux ouverts en même temps (ex: une
// fenêtre flottante de section ouverte par-dessus le chat plein écran,
// voir lib/contexteFenetres.tsx) -- un seul retour ferme le plus
// récemment ouvert, pas les deux d'un coup.
//
// Ordre d'empilement (pas de z-index) : reflète l'ordre réel d'ouverture,
// donc en pratique quasi toujours ce que l'utilisateur voit au premier
// plan -- pas besoin de recalculer un ordre de z-index séparé.
type ContexteRetourValeur = {
  empiler: (fermer: () => void) => () => void;
  intercepter: () => boolean;
};

export const ContexteRetour = createContext<ContexteRetourValeur | null>(null);

export function useFournirRetour(): ContexteRetourValeur {
  const pile = useRef<Array<() => void>>([]);

  const empiler = useCallback((fermer: () => void) => {
    pile.current.push(fermer);
    return () => {
      pile.current = pile.current.filter((f) => f !== fermer);
    };
  }, []);

  const intercepter = useCallback(() => {
    const dernier = pile.current[pile.current.length - 1];
    if (!dernier) return false;
    dernier();
    return true;
  }, []);

  return { empiler, intercepter };
}

/**
 * Hook pratique pour un composant qui s'affiche/se cache selon un
 * booléen : s'empile tant que `ouvert` est vrai, se désempile
 * automatiquement dès que `ouvert` repasse à faux ou au démontage.
 * `fermer` peut changer de référence à chaque rendu sans re-empiler
 * inutilement (lu via ref, même pattern que gestionnaireRef dans
 * BarreOngletsNative.tsx).
 */
export function useEmpilerRetour(ouvert: boolean, fermer: () => void) {
  const ctx = useContext(ContexteRetour);
  const fermerRef = useRef(fermer);
  fermerRef.current = fermer;

  useEffect(() => {
    if (!ouvert || !ctx) return;
    return ctx.empiler(() => fermerRef.current());
  }, [ouvert, ctx]);
}
