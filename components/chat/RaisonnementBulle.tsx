"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, BrainCog } from "lucide-react";

// Affiche le raisonnement interne du modèle -- consomme les événements SSE
// {"type": "raisonnement", "texte": "..."} que core/main.py:_agent_groq
// émet désormais (voir kwargs_reasoning/reasoning_format="parsed"), pour
// les modèles de la cascade qui font réellement du raisonnement (voir
// MODELES_AVEC_REASONING_EFFORT côté backend). Avant ce fix (24/07), ce
// raisonnement existait déjà côté modèle mais n'était ni capturé ni
// affiché.
//
// Demande Bourama (24/07) : reprendre le principe de Claude.ai -- nom de
// l'agent affiché pendant la réflexion ("{nomAgent} réfléchit..."), bulle
// qui se replie automatiquement (mais reste consultable) une fois la
// réponse commencée, plutôt que d'être jetée.
export function RaisonnementBulle({
  nomAgent,
  texte,
  enCours,
}: {
  nomAgent: string;
  texte: string;
  enCours: boolean;
}) {
  const [ouvertManuel, setOuvertManuel] = useState<boolean | null>(null);
  // Se replie tout seul dès que la réflexion est terminée (enCours passe à
  // false, càd la réponse a commencé à arriver) -- sauf si la personne a
  // déjà manuellement changé l'état, auquel cas on respecte son choix.
  const ouvert = ouvertManuel ?? enCours;

  useEffect(() => {
    if (!enCours) return;
    setOuvertManuel(null);
  }, [enCours]);

  if (!texte) return null;

  return (
    <div className="my-1.5 max-w-[80%] animate-dj-fade-in">
      <button
        onClick={() => setOuvertManuel(!ouvert)}
        className="flex items-center gap-1.5 text-[13px] text-dj-texte-muet transition-colors hover:text-dj-texte"
      >
        <BrainCog size={13} className={enCours ? "animate-pulse text-dj-texte-muet" : ""} />
        <span
          className={
            enCours
              ? "animate-dj-shimmer bg-dj-shimmer-texte bg-[length:200%_100%] bg-clip-text text-transparent"
              : ""
          }
        >
          {enCours ? `${nomAgent} réfléchit...` : `Raisonnement de ${nomAgent}`}
        </span>
        {ouvert ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>
      {/* Glissement fluide (26/07, retour Bourama : le repliement était
          "brut", sans transition) -- astuce grid-template-rows 0fr/1fr :
          anime la hauteur sans connaître le contenu à l'avance
          (contrairement à max-height, qui doit deviner une valeur). */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          ouvert ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="mt-1.5 whitespace-pre-wrap border-l-2 border-dj-bordure pl-3 text-[13px] italic leading-relaxed text-dj-texte-muet">
            {texte}
          </div>
        </div>
      </div>
    </div>
  );
}
