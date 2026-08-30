"use client";

import { useEffect, useState } from "react";
import { appelerApi } from "@/lib/api";
import { messageErreur, ErreurApi } from "@/lib/erreurs";
import { CompteRequisModal } from "@/components/CompteRequisModal";

// Note 1-5 sur l'IA (porté de djiguigne-frontend/components/NoteAgent.tsx).
// Contrat backend (api/agents.py) : GET .../rating public (moyenne +
// total), POST .../rating exige un token et fait un upsert (une note
// par user, jamais cumulée) -- pas besoin de gérer un état "déjà noté"
// séparément, un second clic modifie simplement la note existante.
//
// Ouvert aux visiteurs sans compte depuis le 09/08 (décision Bourama :
// toute la barre latérale est désormais visible sans compte) : la
// lecture (moyenne + total) reste publique, mais noter exige un compte
// -- géré ici via CompteRequisModal plutôt qu'un message d'erreur brut.

type Agrege = { moyenne: number | null; total: number };

export function NoteAgent({ agentId }: { agentId: string }) {
  const [agrege, setAgrege] = useState<Agrege | null>(null);
  const [maNote, setMaNote] = useState<number | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [compteRequis, setCompteRequis] = useState(false);

  useEffect(() => {
    appelerApi(`/api/agents/${agentId}/rating`)
      .then((r: Agrege) => setAgrege(r))
      .catch(() => setAgrege(null));
  }, [agentId]);

  async function noter(note: number) {
    setEnvoi(true);
    setErreur(null);
    try {
      await appelerApi(`/api/agents/${agentId}/rating`, {
        method: "POST",
        body: JSON.stringify({ note }),
      });
      setMaNote(note);
      const r = await appelerApi(`/api/agents/${agentId}/rating`);
      setAgrege(r);
    } catch (e) {
      if (e instanceof ErreurApi && e.statusCode === 401) {
        setCompteRequis(true);
      } else {
        setErreur(messageErreur(e));
      }
    } finally {
      setEnvoi(false);
    }
  }

  const noteAffichee = maNote ?? 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            disabled={envoi}
            onClick={() => noter(n)}
            aria-label={`Noter ${n} étoile${n > 1 ? "s" : ""}`}
            className={`text-2xl leading-none transition-transform hover:scale-110 disabled:cursor-not-allowed ${
              n <= noteAffichee ? "text-dj-accent-1-texte" : "text-dj-inactif"
            }`}
          >
            ★
          </button>
        ))}
        <span className="ml-2 text-sm text-dj-texte-muet">
          {agrege?.moyenne != null ? `${agrege.moyenne} / 5 (${agrege.total} avis)` : "Pas encore noté"}
        </span>
      </div>
      {erreur && <p className="text-xs text-[var(--dj-erreur)]">{erreur}</p>}
      {compteRequis && (
        <CompteRequisModal
          texte="Crée un compte pour noter Clovis."
          onFerme={() => setCompteRequis(false)}
        />
      )}
    </div>
  );
}
