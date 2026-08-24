"use client";

import { Loader2, CheckCircle2, XCircle } from "lucide-react";

// Affiche l'état "en train d'utiliser un outil" pendant une réponse --
// consomme les événements SSE {"type": "statut" | "statut_termine", ...}
// que core/main.py:chat() émet déjà (voir sa docstring) mais que
// ChatIA.tsx ignorait jusqu'ici ("pas encore affichés dans cette première
// version", Phase 4).
//
// Fluidité (demande explicite Bourama, 2026-07-20) : PAS un remplacement
// sec du texte "statut" -> "statut_termine". La transition de hauteur/
// opacité est gérée ici avec les classes dj-fade-in existantes ; côté
// ChatIA.tsx, l'ancien statut reste affiché ~600ms après le
// statut_termine avant de disparaître (voir délai dans le state), pour
// qu'on ait le temps de voir "effectuée" plutôt qu'un clignotement.
export type EtatStatut = "en_cours" | "termine" | "annule";

export function StatutOutil({ texte, etat }: { texte: string; etat: EtatStatut }) {
  return (
    <div className="my-1.5 flex animate-dj-fade-in items-center gap-2 text-[13px] text-dj-texte-muet transition-all duration-300">
      {etat === "en_cours" && <Loader2 size={14} className="animate-spin text-dj-texte-muet" />}
      {etat === "termine" && <CheckCircle2 size={14} className="text-dj-succes" />}
      {etat === "annule" && <XCircle size={14} className="text-dj-inactif" />}
      <span>{texte}</span>
    </div>
  );
}
