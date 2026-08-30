"use client";

import { useEffect, useState } from "react";
import { appelerApi } from "@/lib/api";
import { messageErreur, ErreurApi } from "@/lib/erreurs";
import { CompteRequisModal } from "@/components/CompteRequisModal";
import { Skeleton } from "./Skeleton";

// Commentaires sur l'IA (porté de
// djiguigne-frontend/components/CommentairesAgent.tsx). Contrat
// backend (api/agents.py) : GET .../comments public, POST exige un
// token.
//
// Ouvert aux visiteurs sans compte depuis le 09/08 (décision Bourama :
// toute la barre latérale est désormais visible sans compte) : la
// lecture reste publique, mais publier un commentaire exige un compte
// -- géré ici via CompteRequisModal plutôt qu'un message d'erreur brut.

type Commentaire = {
  id: string;
  agent_id: string;
  user_id: string;
  nom_affiche: string | null;
  contenu: string;
  created_at?: string | null;
};

export function CommentairesAgent({ agentId }: { agentId: string }) {
  const [commentaires, setCommentaires] = useState<Commentaire[] | null>(null);
  const [brouillon, setBrouillon] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [compteRequis, setCompteRequis] = useState(false);

  function charger() {
    appelerApi(`/api/agents/${agentId}/comments`)
      .then((r: Commentaire[]) => setCommentaires(r))
      .catch(() => setCommentaires([]));
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    const contenu = brouillon.trim();
    if (!contenu) return;

    setEnvoi(true);
    setErreur(null);
    try {
      await appelerApi(`/api/agents/${agentId}/comments`, {
        method: "POST",
        body: JSON.stringify({ contenu }),
      });
      setBrouillon("");
      charger();
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

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={envoyer} className="flex flex-col gap-2">
        <textarea
          value={brouillon}
          onChange={(e) => setBrouillon(e.target.value)}
          placeholder="Écrire un commentaire..."
          rows={2}
          className="rounded-xl border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-sm text-dj-texte placeholder:text-dj-inactif focus:border-dj-bordure-forte focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={envoi || !brouillon.trim()}
            className="self-start rounded-cgpt-bouton bg-dj-accent-1 px-4 py-2 text-xs font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Publier
          </button>
          {erreur && <p className="text-xs text-[var(--dj-erreur)]">{erreur}</p>}
        </div>
      </form>

      <div className="flex flex-col gap-3">
        {commentaires === null && (
          <div className="flex flex-col gap-3" aria-hidden>
            {["w-4/5", "w-2/3", "w-full", "w-1/2"].map((largeur, i) => (
              <div key={i} className="rounded-xl border border-dj-bordure bg-dj-surface px-4 py-3">
                <Skeleton className="h-3 w-24 rounded" style={{ animationDelay: `${i * 100}ms` }} />
                <Skeleton
                  className={`mt-1 h-3.5 ${largeur} rounded`}
                  style={{ animationDelay: `${i * 100 + 60}ms` }}
                />
              </div>
            ))}
          </div>
        )}
        {commentaires?.length === 0 && (
          <p className="text-sm text-dj-texte-muet">Aucun commentaire pour l&apos;instant.</p>
        )}
        {commentaires?.map((c) => (
          <div key={c.id} className="rounded-xl border border-dj-bordure bg-dj-surface px-4 py-3">
            <p className="text-xs text-dj-texte-muet">{c.nom_affiche || `Utilisateur ${c.user_id.slice(0, 8)}`}</p>
            <p className="mt-1 text-sm text-dj-texte">{c.contenu}</p>
          </div>
        ))}
      </div>

      {compteRequis && (
        <CompteRequisModal
          texte="Crée un compte pour commenter Clovis."
          onFerme={() => setCompteRequis(false)}
        />
      )}
    </div>
  );
}
