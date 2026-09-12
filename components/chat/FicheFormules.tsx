"use client";

import { Sigma } from "lucide-react";
import type { FicheFormulesData } from "./FicheRevision";

// Sous-composant de FicheRevision.tsx (voir ce fichier pour le contexte
// général, le schéma JSON complet et ce qui est hors scope). Affiche une
// fiche de formules : une liste de { nom, expression, description? }.
export function FicheFormules({ fiche }: { fiche: FicheFormulesData }) {
  return (
    <div className="my-3 animate-dj-fade-in rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-dj-accent-1-conteneur text-dj-accent-1-texte">
          <Sigma size={14} />
        </span>
        <p className="text-sm font-semibold text-dj-texte">{fiche.titre || "Fiche de formules"}</p>
      </div>
      <div className="flex flex-col gap-2">
        {fiche.items.map((item, index) => (
          <div key={index} className="rounded-cgpt-carte border border-dj-bordure bg-dj-surface-haute p-3">
            <p className="text-xs font-medium text-dj-texte-muet">{item.nom}</p>
            <p className="mt-1 font-mono text-sm text-dj-texte">{item.expression}</p>
            {item.description && <p className="mt-1.5 text-xs text-dj-texte-muet">{item.description}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
