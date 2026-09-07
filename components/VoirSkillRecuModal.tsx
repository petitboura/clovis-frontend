"use client";

import { useEffect, useState } from "react";
import { X, Loader2, ScrollText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { voirSkillRecu } from "@/lib/api";
import { messageErreur } from "@/lib/erreurs";
import { useFermetureAnimee } from "@/lib/useFermetureAnimee";

/**
 * 07/09/2026, demande Bourama (bug remonté : un skill reçu via un code
 * n'était consultable QUE par le LLM via consulter_comportement, jamais
 * par l'utilisateur lui-même). Popup en lecture seule -- contrairement à
 * MesComportements.tsx (le sien, éditable), on ne modifie jamais un skill
 * reçu, seul son propriétaire le peut depuis "Mes comportements". Même
 * langage visuel que les autres popups (voir SignalerContenuModal.tsx),
 * même extraction du corps (sans le frontmatter) que
 * MesComportements.tsx::extraireCorpsSkill.
 */
function extraireCorpsSkill(skillMd: string): string {
  const correspondance = skillMd.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
  return correspondance ? correspondance[1].trim() : skillMd;
}

export function VoirSkillRecuModal({
  comportementId,
  nom,
  proprietaireNom,
  onFermer,
}: {
  comportementId: string;
  nom: string;
  proprietaireNom: string;
  onFermer: () => void;
}) {
  const [skillMd, setSkillMd] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const { enSortie, demarrerFermeture } = useFermetureAnimee();
  const fermer = () => demarrerFermeture(onFermer);

  useEffect(() => {
    voirSkillRecu(comportementId)
      .then((res) => setSkillMd(res.skill_md))
      .catch((e) => setErreur(messageErreur(e)))
      .finally(() => setChargement(false));
  }, [comportementId]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6 ${
        enSortie ? "opacity-0 transition-opacity duration-150 ease-in" : "animate-dj-fade-in-rapide"
      }`}
      onClick={fermer}
    >
      <div
        className={`flex max-h-[85vh] w-full flex-col gap-3 overflow-y-auto rounded-t-2xl border border-dj-bordure bg-dj-surface p-5 shadow-[0_8px_40px_rgba(0,0,0,0.45)] sm:max-w-lg sm:rounded-cgpt-carte ${
          enSortie ? "animate-cgpt-sortie-modal" : "animate-cgpt-entree-modal"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h4 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-dj-texte">
            <ScrollText size={15} className="flex-shrink-0" />
            <span className="truncate">{nom}</span>
          </h4>
          <button onClick={fermer} className="flex-shrink-0 text-dj-texte-muet hover:text-dj-texte">
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-dj-texte-muet">
          Reçu de {proprietaireNom} · lecture seule
        </p>

        {chargement ? (
          <div className="flex flex-1 items-center justify-center py-8 text-dj-texte-muet">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : erreur ? (
          <p className="text-sm text-[var(--dj-erreur)]">{erreur}</p>
        ) : (
          <div className="w-full flex-1 overflow-y-auto rounded-xl border border-dj-bordure bg-dj-surface-haute px-5 py-4">
            <div className="dj-markdown [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 last:[&_p]:mb-0 [&_hr]:my-4 [&_hr]:border-dj-bordure [&_strong]:text-dj-texte [&_h1]:font-lecture [&_h1]:font-semibold [&_h1]:tracking-[-0.01em] [&_h1]:text-dj-texte [&_h1]:text-xl [&_h1]:mb-2 [&_h1]:mt-3 [&_h2]:font-lecture [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:text-dj-texte [&_h2]:text-lg [&_h2]:mb-2 [&_h2]:mt-3 [&_h3]:font-lecture [&_h3]:font-semibold [&_h3]:tracking-[-0.01em] [&_h3]:text-dj-texte [&_h3]:text-base [&_h3]:mb-1.5 [&_h3]:mt-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeSanitize, defaultSchema]]}>
                {extraireCorpsSkill(skillMd || "")}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
