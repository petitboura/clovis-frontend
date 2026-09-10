"use client";

import { useEffect, useState } from "react";
import { ClipboardList, AlertTriangle } from "lucide-react";
import { obtenirAuditCorrections, type AuditCorrections } from "@/lib/api";
import { messageErreur, ErreurApi } from "@/lib/erreurs";
import { Skeleton } from "./Skeleton";
import { CTACompteRequis } from "./CTACompteRequis";
import { BoutonInfoSection } from "./BoutonInfoSection";
import { dateRelative } from "@/lib/dateRelative";

/**
 * Audit synthétique hebdomadaire des signalements pédagogiques (refonte
 * du 10/09/2026). Regroupe par notion en difficulté quand un
 * rattachement existe (voir core/audit_hebdomadaire_corrections.py).
 * Les signalements encore "nouveau" sont mis en avant, séparément.
 */
export function AuditCorrections() {
  const [audit, setAudit] = useState<AuditCorrections | undefined>(undefined);
  const [erreur, setErreur] = useState<string | null>(null);
  const [sansCompte, setSansCompte] = useState(false);

  useEffect(() => {
    obtenirAuditCorrections()
      .then(setAudit)
      .catch((e) => {
        if (e instanceof ErreurApi && e.statusCode === 401) {
          setSansCompte(true);
        } else {
          setErreur(messageErreur(e));
        }
      });
  }, []);

  if (sansCompte) {
    return <CTACompteRequis texte="Crée un compte pour recevoir l'audit hebdomadaire des signalements de tes élèves." />;
  }

  return (
    <div className="flex animate-dj-fade-in-rapide flex-col gap-3 rounded-xl border border-dj-bordure bg-dj-surface p-4">
      <div className="flex items-center gap-2">
        <ClipboardList size={18} className="text-dj-texte-muet" />
        <h2 className="text-sm font-medium text-dj-texte">Audit hebdomadaire</h2>
        <BoutonInfoSection
          rubriqueId="audit-corrections"
          texteCourt="Une fois par semaine, un résumé des signalements de tes élèves, même s'il n'y en a aucun."
        />
      </div>

      {erreur && <p className="text-sm text-dj-texte-muet">{erreur}</p>}

      {!audit && !erreur && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-3/4 rounded-md" />
          <Skeleton className="h-4 w-1/2 rounded-md" />
          <Skeleton className="h-4 w-2/3 rounded-md" />
        </div>
      )}

      {audit && audit.total === 0 && (
        <p className="text-sm text-dj-texte-muet">Aucun signalement pour l'instant.</p>
      )}

      {audit && audit.total > 0 && (
        <div className="flex flex-col gap-3">
          {audit.nouveaux_non_traites.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-dj-texte-muet">
                {audit.nouveaux_non_traites.length} signalement(s) à corriger
              </p>
              {audit.nouveaux_non_traites.map((s) => (
                <div key={s.id} className="flex items-start gap-2 rounded-lg bg-dj-surface-haute/60 px-3 py-2">
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-dj-accent-1" />
                  <div>
                    <p className="text-sm text-dj-texte">{s.question_texte}</p>
                    {s.created_at && <p className="mt-1 text-[11px] text-dj-texte-muet">{dateRelative(s.created_at)}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {audit.tendances_notions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-dj-texte-muet">Notions les plus en difficulté</p>
              {audit.tendances_notions.map((t) => (
                <div
                  key={t.notion_id}
                  className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm text-dj-texte hover:bg-dj-surface-haute"
                >
                  <span>{t.notion_id}</span>
                  <span className="text-dj-texte-muet">{t.nombre}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
