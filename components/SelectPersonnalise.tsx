"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useFermetureAnimee } from "@/lib/useFermetureAnimee";

// Remplace le <select> natif partout dans le dépôt (20/08/2026, demande
// Bourama : "tes sélecteurs ou les sélecteurs dans le dépôt ne sont pas
// du tout traités" -- constat après capture d'écran montrant le menu
// natif du navigateur, non stylé, texte non tronqué débordant sur le
// reste de la page). Le popup natif d'un <select> n'est de toute façon
// pas stylable en CSS (rendu par l'OS/le navigateur, pas par le DOM) --
// ce composant en est le remplacement direct, entièrement dans notre
// contrôle visuel.

export type OptionMenu = { id: string; label: string; sousLabel?: string };

export function SelectPersonnalise({
  options,
  valeur,
  onChange,
  placeholder = "Choisir…",
  maxLongueurLabel = 50,
}: {
  options: OptionMenu[];
  valeur: string;
  onChange: (id: string) => void;
  placeholder?: string;
  maxLongueurLabel?: number;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [ouvrirVersHaut, setOuvrirVersHaut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Hauteur maximale du menu déroulant (voir la classe max-h-56 plus bas)
  // plus une petite marge, utilisée pour savoir s'il reste assez de
  // place en dessous du bouton avant de l'ouvrir vers le bas.
  const HAUTEUR_MENU_ESTIMEE = 224 + 8;
  // 01/09/2026 (Bourama : "plein de boutons qui se ferment et s'ouvrent
  // brut") : ce menu n'avait aucune animation, ni entrée ni sortie --
  // aligné ici sur le même mécanisme que le reste de l'app (voir
  // lib/useFermetureAnimee.ts).
  const { enSortie, demarrerFermeture } = useFermetureAnimee();
  const fermer = () => demarrerFermeture(() => setOuvert(false));

  // 04/09/2026, bug signalé par Bourama (bibliothèque publique, panneau
  // de filtre) : ce listener tournait en continu même quand le select
  // était déjà fermé, donc n'importe quel clic ailleurs dans le
  // panneau (un autre bouton, un autre select) rouvrait puis refermait
  // ce select-ci pour rien, avec son animation de sortie. Résultat :
  // plusieurs listes réapparaissaient brièvement en même temps et
  // pouvaient recouvrir celle sur laquelle on cliquait vraiment. On
  // utilise un ref (plutôt que "ouvert" dans les deps) pour garder un
  // seul enregistrement du listener tout en lisant l'état à jour.
  const ouvertRef = useRef(ouvert);
  useEffect(() => {
    ouvertRef.current = ouvert;
  }, [ouvert]);

  useEffect(() => {
    function surClicExterieur(e: MouseEvent) {
      if (!ouvertRef.current) return;
      if (ref.current && !ref.current.contains(e.target as Node)) fermer();
    }
    document.addEventListener("mousedown", surClicExterieur);
    return () => document.removeEventListener("mousedown", surClicExterieur);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fermer recrée une fonction stable via demarrerFermeture (useCallback), l'état ouvert est lu via ouvertRef
  }, []);

  function tronquer(texte: string) {
    return texte.length > maxLongueurLabel ? texte.slice(0, maxLongueurLabel).trimEnd() + "…" : texte;
  }

  // 04/09/2026, bug signalé par Bourama (bibliothèque publique, panneau
  // de filtre, champ Catégorie) : le menu s'ouvrait toujours vers le
  // bas avec une hauteur fixe, sans jamais vérifier s'il restait assez
  // de place à l'écran. Pour un champ situé bas dans le panneau (le
  // dernier, Catégorie), avec beaucoup d'options, les derniers
  // éléments finissaient hors de l'écran et impossibles à cliquer. On
  // mesure maintenant la place réelle en dessous du bouton au moment de
  // l'ouverture, et on ouvre vers le haut si le bas manque de place et
  // que le haut en a davantage.
  function ouvrirMenu() {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const placeEnDessous = window.innerHeight - rect.bottom;
      const placeAuDessus = rect.top;
      setOuvrirVersHaut(placeEnDessous < HAUTEUR_MENU_ESTIMEE && placeAuDessus > placeEnDessous);
    }
    setOuvert(true);
  }

  const choisi = options.find((o) => o.id === valeur);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => (ouvert ? fermer() : ouvrirMenu())}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-dj-bordure bg-dj-surface px-3 py-2 text-left text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
      >
        <span className="min-w-0 truncate">{choisi ? tronquer(choisi.label) : placeholder}</span>
        <ChevronDown size={14} className="flex-shrink-0 text-dj-texte-muet" />
      </button>

      {(ouvert || enSortie) && (
        <div
          className={`absolute left-0 right-0 z-20 max-h-56 overflow-y-auto rounded-lg border border-dj-bordure bg-dj-surface-haute p-1 shadow-lg ${
            ouvrirVersHaut ? "bottom-full mb-1" : "top-full mt-1"
          } ${enSortie ? "animate-cgpt-sortie-modal" : "animate-cgpt-entree-modal"}`}
        >
          {options.length === 0 && <p className="px-2.5 py-1.5 text-xs text-dj-texte-muet">Aucune option.</p>}
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                onChange(o.id);
                fermer();
              }}
              className={`flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-dj-surface ${
                o.id === valeur ? "text-dj-accent-1-texte" : "text-dj-texte"
              }`}
            >
              <span className="min-w-0 truncate">{tronquer(o.label)}</span>
              {o.sousLabel && <span className="flex-shrink-0 text-[10px] text-dj-texte-muet">{o.sousLabel}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
