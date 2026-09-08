"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { obtenirCascadesSupervisionEtablissement, type CascadeSupervision } from "@/lib/api";
import { dateRelative } from "@/lib/dateRelative";

/**
 * Cascade de supervision, volet établissement (Partie 10, 07/09/2026).
 * L'endpoint /api/cascades-supervision/etablissement renvoie les
 * cascades de L'ÉTABLISSEMENT GÉRÉ PAR L'UTILISATEUR COURANT, pas
 * nécessairement celui affiché sur cette fiche (fiche accessible par
 * n'importe qui, pas seulement le propriétaire) - filtrage par
 * etablissementId fait ici, côté client, avant tout affichage, pour ne
 * jamais montrer les cascades d'un autre établissement que celui géré
 * par le propriétaire ET affiché sur cette page précise. 401/403/404
 * (pas propriétaire, pas connecté, aucun établissement géré) : rien
 * n'est affiché, silencieusement - ce n'est pas une erreur pour un
 * visiteur ordinaire de la fiche.
 */
export function CascadesEtablissement({ etablissementId }: { etablissementId: string }) {
  const [cascades, setCascades] = useState<CascadeSupervision[]>([]);

  useEffect(() => {
    obtenirCascadesSupervisionEtablissement()
      .then((liste) => setCascades(liste.filter((c) => c.etablissement_id === etablissementId && c.statut !== "resolu")))
      .catch(() => setCascades([]));
  }, [etablissementId]);

  if (cascades.length === 0) return null;

  return (
    <section className="rounded-cgpt-carte border border-dj-accent-1/40 bg-dj-surface p-5">
      <div className="flex items-center gap-2">
        <ShieldAlert size={18} className="text-dj-accent-1" />
        <h3 className="text-sm font-medium text-dj-texte">Supervision en cours</h3>
      </div>
      <p className="mt-1 text-xs text-dj-texte-muet">
        Un enseignant rattaché accumule des signalements de comportement mal configuré, sans réponse depuis au moins 2 jours.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {cascades.map((c) => (
          <div key={c.id} className="rounded-lg bg-dj-surface-haute/60 px-3 py-2">
            <p className="text-sm text-dj-texte">{c.compteur_signalements} signalement(s) similaire(s)</p>
            <p className="mt-0.5 text-[11px] text-dj-texte-muet">
              Déclenchée {dateRelative(c.declenchee_le)}
              {c.statut === "equipe_clovis" && " · équipe Clovis notifiée"}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
