"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock3, Settings2 } from "lucide-react";
import { usePluginNatif, messageErreurPlugin } from "@/lib/usePluginNatif";
import { synchroniserUsage, obtenirUsage, type LigneUsage } from "@/lib/api";
import { Skeleton } from "./Skeleton";
import { BandeauTelechargerApp } from "./BandeauTelechargerApp";

/**
 * Écran autonome pour le plugin natif TempsEcran (Android uniquement :
 * voir TempsEcranPlugin.kt, construit le 26/08/2026). PAS d'équivalent iOS
 * pour l'instant : Screen Time nécessite l'entitlement Family Controls
 * (compte Apple Developer Program actif, que Bourama n'a pas encore) et un
 * target d'extension Xcode séparé : documenté dans
 * clovis-mobile/ios-legacy-natif/.../UsageScreen.swift, pas contourné ici.
 *
 * Construit à la demande de Bourama ("go" en réponse à l'audit du 26/08
 * listant les interfaces manquantes) : composant fonctionnel autonome, pas
 * de route ni de placement dans la navigation imposé.
 *
 * Pas de mécanisme i18n branché (voir EspaceParametres.tsx) : textes en
 * dur en français.
 */

// 31/08/2026 : nomAffiche/icone ajoutés côté plugin (TempsEcranPlugin.kt,
// via ResolveurApps) pour ne plus afficher le nom de paquet technique brut
// (ex. "com.whatsapp"). nomPaquet gardé pour la synchronisation backend
// (lib/api.ts, inchangée) et comme clé React stable.
type AppUsage = { nomPaquet: string; nomAffiche: string; icone: string | null; dureeSecondes: number };

type PluginTempsEcran = {
  permissionAccordee(): Promise<{ accordee: boolean }>;
  ouvrirReglagesPermission(): Promise<void>;
  usageAujourdhui(): Promise<{ apps: AppUsage[] }>;
};

function formaterDuree(secondes: number): string {
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h} h ${m.toString().padStart(2, "0")}`;
}

export function EspaceTempsEcran() {
  const { natif, plugin } = usePluginNatif<PluginTempsEcran>("TempsEcran");

  const [chargementPermission, setChargementPermission] = useState(true);
  const [permissionAccordee, setPermissionAccordee] = useState(false);
  const [chargementUsage, setChargementUsage] = useState(false);
  const [appsAujourdhui, setAppsAujourdhui] = useState<AppUsage[] | null>(null);
  const [historique, setHistorique] = useState<LigneUsage[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const verifierPermission = useCallback(() => {
    if (!plugin) return;
    setChargementPermission(true);
    plugin
      .permissionAccordee()
      .then((r) => setPermissionAccordee(r.accordee))
      .catch((e) => setErreur(messageErreurPlugin(e)))
      .finally(() => setChargementPermission(false));
  }, [plugin]);

  useEffect(() => {
    verifierPermission();
  }, [verifierPermission]);

  // Même raison que EspaceControleSession/EspaceAccessibilite : la
  // permission se donne dans les Réglages système, en dehors de l'app.
  useEffect(() => {
    function surRetourFocus() {
      if (document.visibilityState === "visible") verifierPermission();
    }
    document.addEventListener("visibilitychange", surRetourFocus);
    return () => document.removeEventListener("visibilitychange", surRetourFocus);
  }, [verifierPermission]);

  useEffect(() => {
    if (!plugin || !permissionAccordee) return;
    setChargementUsage(true);
    setErreur(null);
    plugin
      .usageAujourdhui()
      .then(async (r) => {
        setAppsAujourdhui(r.apps);
        // Synchronise vers le backend puis relit l'historique : voir
        // lib/api.ts (synchroniserUsage/obtenirUsage), contrat déjà en
        // place côté clovis-backend.
        const aujourdhui = new Date().toISOString().slice(0, 10);
        await synchroniserUsage(
          "android",
          r.apps.map((a) => ({ nom_app: a.nomPaquet, date: aujourdhui, duree_secondes: a.dureeSecondes }))
        );
        const h = await obtenirUsage(7);
        setHistorique(h.usage);
      })
      .catch((e) => setErreur(messageErreurPlugin(e)))
      .finally(() => setChargementUsage(false));
  }, [plugin, permissionAccordee]);

  async function ouvrirReglages() {
    if (!plugin) return;
    setErreur(null);
    try {
      await plugin.ouvrirReglagesPermission();
    } catch (e) {
      setErreur(messageErreurPlugin(e));
    }
  }

  if (natif === null) {
    return (
      <div className="flex flex-col gap-4 p-4" aria-hidden>
        <div>
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="mt-1 h-3 w-full rounded" style={{ animationDelay: "60ms" }} />
          <Skeleton className="h-3 w-2/3 rounded" style={{ animationDelay: "120ms" }} />
        </div>

        <div className="flex flex-col items-center gap-1 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
          <Skeleton className="h-7 w-24 rounded" style={{ animationDelay: "180ms" }} />
          <Skeleton className="mt-1 h-3 w-56 rounded" style={{ animationDelay: "240ms" }} />
        </div>

        <div className="overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface">
          <div className="divide-y divide-dj-bordure">
            {["w-32", "w-40", "w-24"].map((largeur, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <Skeleton className={`h-3.5 ${largeur} rounded`} style={{ animationDelay: `${300 + i * 80}ms` }} />
                <Skeleton
                  className="h-3 w-10 flex-shrink-0 rounded"
                  style={{ animationDelay: `${300 + i * 80 + 20}ms` }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-24 rounded" style={{ animationDelay: "540ms" }} />
          <div className="overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface">
            <div className="divide-y divide-dj-bordure">
              {["w-20", "w-24", "w-16"].map((largeur, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-2">
                  <Skeleton className={`h-3.5 ${largeur} rounded`} style={{ animationDelay: `${620 + i * 80}ms` }} />
                  <Skeleton
                    className="h-3 w-10 flex-shrink-0 rounded"
                    style={{ animationDelay: `${620 + i * 80 + 20}ms` }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!natif) {
    // 30/08/2026, audit navigation web mobile vs natif, étape 4 :
    // l'historique (7 derniers jours) est bien stocké côté serveur et
    // pourrait techniquement être consulté sans le plugin, mais
    // aujourd'hui son chargement est entièrement imbriqué dans le flux
    // de permission natif (voir l'useEffect plus haut), en construire
    // un vrai découplé pour PC/web est un vrai chantier à part, pas une
    // simple étape de verrouillage. Bourama a tranché : verrouiller ce
    // sous-écran comme Contrôle de session pour l'instant, plutôt que de
    // construire cette vue à la volée ici.
    return <BandeauTelechargerApp titre="Temps d'écran" />;
  }

  const totalAujourdhui = (appsAujourdhui ?? []).reduce((s, a) => s + a.dureeSecondes, 0);
  const totauxParJour = (historique ?? []).reduce<Record<string, number>>((acc, l) => {
    acc[l.date] = (acc[l.date] ?? 0) + l.duree_secondes;
    return acc;
  }, {});

  return (
    <div className="flex animate-dj-fade-in-rapide flex-col gap-4 p-4">
      <div>
        <h2 className="font-display text-base font-bold text-dj-texte">Temps d&apos;écran</h2>
        <p className="mt-1 text-xs text-dj-texte-muet">Temps passé aujourd&apos;hui dans chaque app, et les 7 derniers jours.</p>
      </div>

      {chargementPermission ? (
        <div className="flex flex-col gap-4" aria-hidden>
          <div className="flex flex-col items-center gap-1 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
            <Skeleton className="h-7 w-24 rounded" />
            <Skeleton className="mt-1 h-3 w-56 rounded" style={{ animationDelay: "60ms" }} />
          </div>

          <div className="overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface">
            <div className="divide-y divide-dj-bordure">
              {["w-32", "w-40", "w-24"].map((largeur, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <Skeleton className={`h-3.5 ${largeur} rounded`} style={{ animationDelay: `${120 + i * 80}ms` }} />
                  <Skeleton
                    className="h-3 w-10 flex-shrink-0 rounded"
                    style={{ animationDelay: `${120 + i * 80 + 20}ms` }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-24 rounded" style={{ animationDelay: "360ms" }} />
            <div className="overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface">
              <div className="divide-y divide-dj-bordure">
                {["w-20", "w-24", "w-16"].map((largeur, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-4 py-2">
                    <Skeleton className={`h-3.5 ${largeur} rounded`} style={{ animationDelay: `${440 + i * 80}ms` }} />
                    <Skeleton
                      className="h-3 w-10 flex-shrink-0 rounded"
                      style={{ animationDelay: `${440 + i * 80 + 20}ms` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : !permissionAccordee ? (
        <div className="flex flex-col gap-3 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
          <div className="flex items-start gap-3">
            <Clock3 size={18} className="mt-0.5 flex-shrink-0 text-dj-texte-muet" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-dj-texte">Permission requise</span>
              <span className="text-xs text-dj-texte-muet">
                Accorde l&apos;accès à l&apos;usage des apps pour que Clovis puisse afficher ton temps d&apos;écran.
              </span>
            </div>
          </div>
          <button
            onClick={ouvrirReglages}
            className="flex w-fit items-center gap-2 self-start rounded-lg bg-dj-accent-1 px-3 py-1.5 text-xs font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2"
          >
            <Settings2 size={14} />
            Ouvrir les réglages
          </button>
        </div>
      ) : chargementUsage ? (
        <div className="flex flex-col gap-4" aria-hidden>
          <div className="flex flex-col items-center gap-1 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
            <Skeleton className="h-7 w-24 rounded" />
            <Skeleton className="mt-1 h-3 w-56 rounded" style={{ animationDelay: "60ms" }} />
          </div>

          <div className="overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface">
            <div className="divide-y divide-dj-bordure">
              {["w-32", "w-40", "w-24"].map((largeur, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <Skeleton className={`h-3.5 ${largeur} rounded`} style={{ animationDelay: `${120 + i * 80}ms` }} />
                  <Skeleton
                    className="h-3 w-10 flex-shrink-0 rounded"
                    style={{ animationDelay: `${120 + i * 80 + 20}ms` }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-24 rounded" style={{ animationDelay: "360ms" }} />
            <div className="overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface">
              <div className="divide-y divide-dj-bordure">
                {["w-20", "w-24", "w-16"].map((largeur, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-4 py-2">
                    <Skeleton className={`h-3.5 ${largeur} rounded`} style={{ animationDelay: `${440 + i * 80}ms` }} />
                    <Skeleton
                      className="h-3 w-10 flex-shrink-0 rounded"
                      style={{ animationDelay: `${440 + i * 80 + 20}ms` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center gap-1 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
            <span className="text-2xl font-bold text-dj-texte">{formaterDuree(totalAujourdhui)}</span>
            <span className="text-xs text-dj-texte-muet">aujourd&apos;hui, toutes apps confondues</span>
          </div>

          {(appsAujourdhui ?? []).length > 0 && (
            <div className="overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface">
              <div className="divide-y divide-dj-bordure">
                {(appsAujourdhui ?? []).map((a) => (
                  <div key={a.nomPaquet} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      {a.icone ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.icone} alt="" className="h-6 w-6 flex-shrink-0 rounded-md" />
                      ) : (
                        <div className="h-6 w-6 flex-shrink-0 rounded-md bg-dj-surface-haute" aria-hidden />
                      )}
                      <span className="truncate text-sm text-dj-texte">{a.nomAffiche}</span>
                    </div>
                    <span className="flex-shrink-0 text-xs text-dj-texte-muet">{formaterDuree(a.dureeSecondes)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(totauxParJour).length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-dj-texte-muet">7 derniers jours</span>
              <div className="overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface">
                <div className="divide-y divide-dj-bordure">
                  {Object.entries(totauxParJour)
                    .sort(([a], [b]) => (a < b ? 1 : -1))
                    .map(([jour, total]) => (
                      <div key={jour} className="flex items-center justify-between gap-3 px-4 py-2">
                        <span className="text-sm text-dj-texte">{jour}</span>
                        <span className="text-xs text-dj-texte-muet">{formaterDuree(total)}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {erreur && <span className="text-sm text-[var(--dj-erreur)]">{erreur}</span>}
    </div>
  );
}
