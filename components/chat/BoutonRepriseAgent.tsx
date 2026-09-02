"use client";

import { ArrowRight, RotateCw } from "lucide-react";

// Ajouté 02/09/2026 (demande Bourama, gestion du plafond d'appels
// d'outils, voir core/main.py:_agent_groq) : bouton attaché SOUS le
// message précis qui s'est terminé sur "limite_outils_atteinte" ou
// "repetition_detectee" -- pas une popup à part comme ConfirmationOutil,
// le message a déjà expliqué lui-même la situation dans son texte, ce
// bouton sert juste à reprendre exactement où tout s'est arrêté (voir
// ChatIA.tsx:reprendreAgent). Contrairement à ConfirmationOutil (qui
// bloque tant que non répondu), ignorer ce bouton est un choix valide :
// taper un autre message rend simplement cet état obsolète.
export function BoutonRepriseAgent({
  type,
  enAttente,
  onReprendre,
}: {
  type: "limite" | "repetition";
  enAttente: boolean;
  onReprendre: () => void;
}) {
  const estRepetition = type === "repetition";

  return (
    <div className="mt-2">
      <button
        onClick={onReprendre}
        disabled={enAttente}
        className="flex items-center gap-1.5 rounded-lg border border-dj-bordure px-3 py-1.5 text-xs font-semibold text-dj-texte hover:bg-dj-surface disabled:opacity-50"
      >
        {estRepetition ? <RotateCw size={13} /> : <ArrowRight size={13} />}
        {estRepetition ? "Réessayer" : "Continuer"}
      </button>
    </div>
  );
}
