"use client";

import { AlertTriangle, Check, X } from "lucide-react";

export function ConfirmationOutil({
  nomLisible,
  agentNom,
  arguments: args,
  enAttente,
  onConfirmer,
  onAnnuler,
}: {
  nomLisible: string;
  agentNom?: string | null;
  arguments: Record<string, unknown>;
  enAttente: boolean;
  onConfirmer: () => void;
  onAnnuler: () => void;
}) {
  const entrees = Object.entries(args);

  return (
    <div className="my-2 max-w-[80%] animate-dj-fade-in rounded-xl border border-dj-bordure-forte bg-dj-surface p-3.5">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-dj-accent-1-texte" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-dj-texte">
            {/* Sujet = l'AGENT, pas l'outil (2026-07-23, demande de
                Bourama) : "Nucleos veut faire ceci : Modification d'un
                fichier GitHub", valable pour n'importe quelle action
                sensible, pas seulement GitHub. */}
            <span className="font-semibold">{agentNom || "Clovis"}</span> veut faire ceci :{" "}
            <span className="font-semibold">{nomLisible}</span>. Confirmer ?
          </p>
          {entrees.length > 0 && (
            <div className="mt-2 space-y-0.5 rounded-lg bg-dj-fond/60 p-2 text-[12px] text-dj-texte-muet">
              {entrees.map(([cle, valeur]) => (
                <div key={cle} className="truncate">
                  <span className="text-dj-texte-muet">{cle} :</span>{" "}
                  <span className="text-dj-texte">{String(valeur)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={onConfirmer}
              disabled={enAttente}
              className="flex items-center gap-1.5 rounded-lg bg-dj-accent-1 px-3 py-1.5 text-xs font-semibold text-[#1A0D02] disabled:opacity-50"
            >
              <Check size={13} /> Confirmer
            </button>
            <button
              onClick={onAnnuler}
              disabled={enAttente}
              className="flex items-center gap-1.5 rounded-lg border border-dj-bordure px-3 py-1.5 text-xs text-dj-texte-muet hover:text-dj-texte disabled:opacity-50"
            >
              <X size={13} /> Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
