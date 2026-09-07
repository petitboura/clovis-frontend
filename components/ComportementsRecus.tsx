"use client";

import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { listerMesRattachementsCodes, type RattachementCode } from "@/lib/api";
import { VoirSkillRecuModal } from "@/components/VoirSkillRecuModal";

/**
 * Comportements reçus via un code (14/08/2026, voir
 * core/codes_partage.py) -- affichés SÉPARÉMENT des comportements
 * propres de MesComportements.tsx, lecture seule (on ne modifie pas ce
 * qu'on a reçu, seul le propriétaire du code le peut, depuis "Mes
 * codes"). Fusionnés côté chat avec les comportements propres avant le
 * petit routeur "à la skill" -- ici, purement pour affichage humain.
 *
 * Restylé le 16/08/2026 en même temps que MesComportements.tsx, même
 * langage visuel (carte bordée, texte en taille normale) au lieu du
 * mini-panneau compact hérité de l'ancienne sidebar de chat.
 *
 * 18/08/2026 : un code peut désormais porter PLUSIEURS comportements
 * (sélection dans "Mes comportements" côté propriétaire, référence
 * vivante) -- on affiche leur nom (r.comportements[].nom), plus le texte
 * brut qui n'existe plus à ce niveau (le texte complet reste lu à la
 * demande via consulter_comportement, jamais affiché d'office, même
 * principe que pour les comportements propres).
 *
 * 07/09/2026, demande Bourama (bug remonté : ces skills n'étaient
 * ouvrables nulle part, ni ici ni dans Bureau) : chaque nom est
 * maintenant cliquable, ouvre VoirSkillRecuModal en lecture seule.
 */
export function ComportementsRecus() {
  const [rattachements, setRattachements] = useState<RattachementCode[] | undefined>(undefined);
  const [skillOuvert, setSkillOuvert] = useState<{ id: string; nom: string; proprietaireNom: string } | null>(null);

  useEffect(() => {
    listerMesRattachementsCodes()
      .then(setRattachements)
      .catch(() => setRattachements([]));
  }, []);

  const recus = (rattachements || []).filter((r) => r.a_comportement);
  if (!rattachements || recus.length === 0) return null;

  return (
    <div className="flex animate-dj-fade-in-rapide flex-col gap-2 border-t border-dj-bordure pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-dj-texte-muet">Reçus via un code</p>
      {recus.map((r) => (
        <div
          key={r.rattachement_id}
          className="flex items-start gap-3 rounded-xl border border-dj-bordure bg-dj-surface px-4 py-3"
        >
          <ScrollText size={16} className="mt-0.5 flex-shrink-0 text-dj-texte-muet" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-dj-texte-muet">Reçu de {r.proprietaire_nom}</p>
            <p className="mt-0.5 flex flex-wrap gap-x-1.5 gap-y-1 text-sm leading-relaxed text-dj-texte">
              {r.comportements
                .filter((cmp) => cmp.nom)
                .map((cmp, i) => (
                  <span key={cmp.id}>
                    <button
                      onClick={() => setSkillOuvert({ id: cmp.id, nom: cmp.nom, proprietaireNom: r.proprietaire_nom })}
                      className="underline decoration-dj-bordure-forte underline-offset-2 transition-colors hover:text-dj-accent-1"
                    >
                      {cmp.nom}
                    </button>
                    {i < r.comportements.filter((c) => c.nom).length - 1 ? "," : ""}
                  </span>
                ))}
            </p>
          </div>
        </div>
      ))}

      {skillOuvert && (
        <VoirSkillRecuModal
          comportementId={skillOuvert.id}
          nom={skillOuvert.nom}
          proprietaireNom={skillOuvert.proprietaireNom}
          onFermer={() => setSkillOuvert(null)}
        />
      )}
    </div>
  );
}
