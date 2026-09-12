"use client";

import { Table2 } from "lucide-react";
import type { FicheTableauComparatifData } from "./FicheRevision";

// Sous-composant de FicheRevision.tsx (voir ce fichier pour le contexte
// général, le schéma JSON complet et ce qui est hors scope). Affiche un
// tableau comparatif : { colonnes: string[], lignes: [{ label, valeurs }] }.
//
// Volontairement plus simple que TableauMessage.tsx (pas de tri de
// colonnes) : ce tableau est un contenu pédagogique figé généré pour une
// fiche de révision, pas des données tabulaires à explorer -- inutile
// d'ajouter une interaction qui ne sert à rien ici.
export function FicheTableauComparatif({ fiche }: { fiche: FicheTableauComparatifData }) {
  return (
    <div className="my-3 animate-dj-fade-in rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-dj-accent-1-conteneur text-dj-accent-1-texte">
          <Table2 size={14} />
        </span>
        <p className="text-sm font-semibold text-dj-texte">{fiche.titre || "Tableau comparatif"}</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-dj-bordure">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-dj-bordure bg-dj-surface-haute px-2.5 py-1.5 text-left text-dj-texte-muet" />
              {fiche.colonnes.map((colonne, index) => (
                <th
                  key={index}
                  className="border border-dj-bordure bg-dj-surface-haute px-2.5 py-1.5 text-left font-semibold text-dj-texte"
                >
                  {colonne}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fiche.lignes.map((ligne, index) => (
              <tr key={index} className="[&:nth-child(even)]:bg-dj-surface-haute/40 hover:bg-dj-surface-haute">
                <td className="border border-dj-bordure px-2.5 py-1.5 font-medium text-dj-texte">{ligne.label}</td>
                {ligne.valeurs.map((valeur, i) => (
                  <td key={i} className="border border-dj-bordure px-2.5 py-1.5 text-dj-texte-muet">
                    {valeur}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
