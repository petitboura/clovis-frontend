"use client";

import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { listerMesRattachementsCodes, type RattachementCode } from "@/lib/api";

/**
 * Programmes reçus via un code (14/08/2026, voir core/codes_partage.py)
 * -- affichés SÉPARÉMENT de mes propres programmes (EspaceProgramme.tsx),
 * lecture seule : la structure (matières/chapitres) reste gérée par son
 * propriétaire, je ne fais que la consulter. Pas d'édition ici --
 * l'ouverture de la structure complète se fait via consulter_programme
 * dans le chat, pas dans cet espace (contrairement à mes propres
 * programmes qui ont leur écran d'édition dédié).
 */
export function ProgrammesRecus() {
  const [rattachements, setRattachements] = useState<RattachementCode[] | undefined>(undefined);

  useEffect(() => {
    listerMesRattachementsCodes()
      .then(setRattachements)
      .catch(() => setRattachements([]));
  }, []);

  const recus = (rattachements || []).filter((r) => r.a_programme);
  if (!rattachements || recus.length === 0) return null;

  return (
    <div className="mb-4 animate-dj-fade-in-rapide space-y-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
      <p className="text-xs font-semibold text-dj-texte-muet">Programmes reçus (via un code)</p>
      {recus.map((r) => (
        <div key={r.rattachement_id} className="flex items-center gap-2 rounded-lg border border-dj-bordure/60 bg-dj-surface-haute px-3 py-2 text-sm">
          <BookOpen size={14} className="flex-shrink-0 text-dj-texte-muet" />
          <span className="text-dj-texte">{r.programme_nom || "Programme"}</span>
          <span className="text-dj-texte-muet"> · reçu de {r.proprietaire_nom}</span>
        </div>
      ))}
    </div>
  );
}
