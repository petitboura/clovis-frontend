"use client";

import { CalendarDays } from "lucide-react";
import type { FicheDatesData } from "./FicheRevision";

// Sous-composant de FicheRevision.tsx (voir ce fichier pour le contexte
// général, le schéma JSON complet et ce qui est hors scope). Affiche une
// fiche de dates sous forme de chronologie : une liste de
// { date, texte, description? }, reliée par une ligne verticale.
export function FicheDates({ fiche }: { fiche: FicheDatesData }) {
  return (
    <div className="my-3 animate-dj-fade-in rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-dj-accent-1-conteneur text-dj-accent-1-texte">
          <CalendarDays size={14} />
        </span>
        <p className="text-sm font-semibold text-dj-texte">{fiche.titre || "Fiche de dates"}</p>
      </div>
      <div className="flex flex-col">
        {fiche.evenements.map((evt, index) => (
          <div key={index} className="relative flex gap-3 pb-4 last:pb-0">
            {index < fiche.evenements.length - 1 && (
              <span className="absolute left-[6px] top-4 h-full w-px bg-dj-bordure" />
            )}
            <span className="relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-dj-accent-1 bg-dj-surface" />
            <div>
              <p className="text-xs font-semibold text-dj-accent-1-texte">{evt.date}</p>
              <p className="mt-0.5 text-sm text-dj-texte">{evt.texte}</p>
              {evt.description && <p className="mt-1 text-xs text-dj-texte-muet">{evt.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
