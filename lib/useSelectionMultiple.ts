import { useCallback, useMemo, useRef, useState } from "react";

/**
 * Sélection multiple générique pour une liste affichée à l'écran (fichiers
 * et/ou dossiers). Gère l'activation/désactivation du mode sélection, le
 * clic simple, le clic + Ctrl/Cmd (ajoute ou retire un seul élément sans
 * toucher au reste, comportement PC classique) et le clic + Shift
 * (sélectionne toute la plage entre le dernier élément touché et celui-ci).
 *
 * `idsAffiches` doit toujours refléter l'ordre et le contenu réellement
 * visibles à l'écran (après filtre/recherche) : "Tout sélectionner" et la
 * sélection par plage (Shift) s'appuient dessus.
 */
export function useSelectionMultiple(idsAffiches: string[]) {
  const [actif, setActif] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const dernierIndexRef = useRef<number | null>(null);

  const activer = useCallback(() => {
    setActif(true);
    setSelection(new Set());
    dernierIndexRef.current = null;
  }, []);

  const desactiver = useCallback(() => {
    setActif(false);
    setSelection(new Set());
    dernierIndexRef.current = null;
  }, []);

  const basculer = useCallback(
    (id: string, evenement?: { shiftKey?: boolean }) => {
      const index = idsAffiches.indexOf(id);
      setSelection((precedent) => {
        const suivant = new Set(precedent);
        if (evenement?.shiftKey && dernierIndexRef.current !== null && index !== -1) {
          const debut = Math.min(dernierIndexRef.current, index);
          const fin = Math.max(dernierIndexRef.current, index);
          for (let i = debut; i <= fin; i++) {
            suivant.add(idsAffiches[i]);
          }
        } else {
          if (suivant.has(id)) {
            suivant.delete(id);
          } else {
            suivant.add(id);
          }
          if (index !== -1) dernierIndexRef.current = index;
        }
        return suivant;
      });
    },
    [idsAffiches]
  );

  const toutSelectionner = useCallback(() => {
    setSelection(new Set(idsAffiches));
  }, [idsAffiches]);

  const toutDeselectionner = useCallback(() => {
    setSelection(new Set());
    dernierIndexRef.current = null;
  }, []);

  const estSelectionne = useCallback((id: string) => selection.has(id), [selection]);

  const nombreSelectionne = selection.size;
  const toutEstSelectionne = useMemo(
    () => idsAffiches.length > 0 && idsAffiches.every((id) => selection.has(id)),
    [idsAffiches, selection]
  );

  return {
    actif,
    activer,
    desactiver,
    selection,
    basculer,
    toutSelectionner,
    toutDeselectionner,
    estSelectionne,
    nombreSelectionne,
    toutEstSelectionne,
  };
}
