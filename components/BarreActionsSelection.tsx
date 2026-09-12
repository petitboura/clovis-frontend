"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

export type ActionSelection = {
  cle: string;
  label: string;
  icone: ReactNode;
  onClick: () => void;
  destructif?: boolean;
};

/**
 * Barre fixée en bas d'écran, affichée dès qu'au moins un élément est coché
 * en mode sélection multiple. `actions` doit déjà être la liste filtrée
 * (intersection fichier/dossier calculée par l'écran appelant) : ce
 * composant se contente de l'afficher.
 */
export function BarreActionsSelection({
  nombreSelectionne,
  toutEstSelectionne,
  onToutSelectionner,
  onToutDeselectionner,
  onFermer,
  actions,
}: {
  nombreSelectionne: number;
  toutEstSelectionne: boolean;
  onToutSelectionner: () => void;
  onToutDeselectionner: () => void;
  onFermer: () => void;
  actions: ActionSelection[];
}) {
  return (
    <div
      className="fixed inset-x-3 z-40 flex flex-col gap-2 rounded-xl border border-dj-bordure bg-dj-surface px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.35)] animate-dj-fade-in-rapide"
      style={{ bottom: "calc(1.25rem + var(--cap-native-navigation-bottom,0px) + var(--dj-barre-onglets-web,0px))" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm text-dj-texte">
          <button
            onClick={onFermer}
            aria-label="Annuler la sélection"
            className="flex-shrink-0 text-dj-texte-muet hover:text-dj-texte"
          >
            <X size={16} />
          </button>
          <span className="truncate font-medium">
            {nombreSelectionne} sélectionné{nombreSelectionne > 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={toutEstSelectionne ? onToutDeselectionner : onToutSelectionner}
          className="flex-shrink-0 text-xs font-medium text-dj-accent-1-texte hover:underline"
        >
          {toutEstSelectionne ? "Tout désélectionner" : "Tout sélectionner"}
        </button>
      </div>
      {actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-dj-bordure pt-2">
          {actions.map((a) => (
            <button
              key={a.cle}
              onClick={a.onClick}
              className={`flex items-center gap-1.5 rounded-cgpt-bouton px-3 py-1.5 text-xs font-medium transition-colors ${
                a.destructif
                  ? "text-[var(--dj-erreur)] hover:bg-[var(--dj-erreur)]/10"
                  : "text-dj-texte hover:bg-dj-surface-haute"
              }`}
            >
              {a.icone}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
