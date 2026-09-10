"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { obtenirSignalementPedagogique, confirmerVisibiliteSignalement, type SignalementPedagogique } from "@/lib/api";
import { messageErreur } from "@/lib/erreurs";
import { Skeleton } from "./Skeleton";

const CHAMPS: { id: "question" | "reponse" | "conversation"; label: string }[] = [
  { id: "question", label: "Ta question" },
  { id: "reponse", label: "La réponse de l'IA" },
  { id: "conversation", label: "Le fil de la conversation" },
];

/**
 * Ton prof a demandé à voir un ou plusieurs éléments d'un signalement
 * que tu n'avais pas partagés au départ (refonte du 10/09/2026, voir
 * core/signalements.py::demander_visibilite). Tu coches oui/non par
 * élément, sans rien ressaisir -- un refus n'efface que la demande, ce
 * que tu ne veux pas partager ne devient jamais visible.
 */
export function ConfirmerVisibiliteSignalement({ signalementId }: { signalementId: string }) {
  const [signalement, setSignalement] = useState<SignalementPedagogique | undefined | null>(undefined);
  const [reponses, setReponses] = useState<Record<string, boolean>>({});
  const [enEnvoi, setEnEnvoi] = useState(false);
  const [confirme, setConfirme] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    obtenirSignalementPedagogique(signalementId)
      .then(setSignalement)
      .catch(() => setSignalement(null));
  }, [signalementId]);

  const champsDemandes = signalement ? CHAMPS.filter((c) => (signalement as any)[`demande_prof_${c.id}`]) : [];

  async function confirmer() {
    if (!signalement) return;
    setEnEnvoi(true);
    setErreur(null);
    try {
      await confirmerVisibiliteSignalement(signalement.id, reponses);
      setConfirme(true);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnEnvoi(false);
    }
  }

  if (signalement === undefined) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-2/3 rounded" />
        <Skeleton className="h-4 w-1/2 rounded" />
      </div>
    );
  }

  if (signalement === null) {
    return <p className="text-sm text-dj-texte-muet">Ce signalement est introuvable.</p>;
  }

  if (confirme || champsDemandes.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-dj-texte-muet">
        <Check size={16} className="text-dj-accent-1-texte" />
        {confirme ? "Ta réponse a été envoyée à ton prof." : "Ton prof n'a rien de plus à te demander pour l'instant."}
      </p>
    );
  }

  return (
    <div className="rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-5">
      <p className="text-sm text-dj-texte">
        Ton prof aimerait voir ce qui manque pour mieux comprendre ton signalement. Choisis ce que tu veux bien partager :
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {champsDemandes.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-dj-bordure bg-dj-surface-haute p-2.5">
            <span className="text-sm text-dj-texte">{c.label}</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setReponses((p) => ({ ...p, [c.id]: true }))}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  reponses[c.id] === true ? "bg-dj-accent-1 text-[#1A0D02]" : "border border-dj-bordure text-dj-texte-muet"
                }`}
              >
                Oui
              </button>
              <button
                onClick={() => setReponses((p) => ({ ...p, [c.id]: false }))}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  reponses[c.id] === false ? "bg-dj-surface border border-dj-bordure text-dj-texte" : "border border-dj-bordure text-dj-texte-muet"
                }`}
              >
                Non
              </button>
            </div>
          </div>
        ))}
      </div>
      {erreur && <p className="mt-2 text-sm text-[var(--dj-erreur)]">{erreur}</p>}
      <button
        onClick={confirmer}
        disabled={enEnvoi || Object.keys(reponses).length < champsDemandes.length}
        className="mt-3 rounded-cgpt-bouton bg-dj-accent-1 px-3 py-1.5 text-sm font-medium text-[#1A0D02] disabled:opacity-50"
      >
        Confirmer
      </button>
    </div>
  );
}
