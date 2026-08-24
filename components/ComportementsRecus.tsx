"use client";

import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { listerMesRattachementsCodes, type RattachementCode } from "@/lib/api";

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
 */
export function ComportementsRecus() {
  const [rattachements, setRattachements] = useState<RattachementCode[] | undefined>(undefined);

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
            <p className="mt-0.5 text-sm leading-relaxed text-dj-texte">
              {r.comportements.map((cmp) => cmp.nom).filter(Boolean).join(", ")}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
