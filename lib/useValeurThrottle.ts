import { useEffect, useRef, useState } from "react";

// Limite la fréquence à laquelle une valeur qui change souvent (ex : le
// texte d'un bloc de code qui grandit à chaque caractère reçu en
// streaming) déclenche un recalcul coûteux en aval (ex : coloration
// syntaxique complète du bloc à chaque caractère).
//
// `actif=false` (génération terminée, ou pas de streaming) : la valeur
// throttlée est TOUJOURS synchronisée immédiatement sur la valeur réelle,
// jamais de décalage une fois le résultat final connu.
// `actif=true` : la valeur ne se met à jour au maximum qu'une fois toutes
// les `delaiMs` millisecondes -- le dernier changement en attente est
// toujours appliqué via un timeout, jamais perdu.
export function useValeurThrottle<T>(valeur: T, delaiMs: number, actif: boolean): T {
  const [valeurThrottlee, setValeurThrottlee] = useState(valeur);
  const dernierMajRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!actif) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setValeurThrottlee(valeur);
      return;
    }

    const maintenant = Date.now();
    const ecoule = maintenant - dernierMajRef.current;

    if (ecoule >= delaiMs) {
      dernierMajRef.current = maintenant;
      setValeurThrottlee(valeur);
      return;
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      dernierMajRef.current = Date.now();
      setValeurThrottlee(valeur);
    }, delaiMs - ecoule);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [valeur, delaiMs, actif]);

  return valeurThrottlee;
}
