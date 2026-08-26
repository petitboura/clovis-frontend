"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock3, Settings2, Smartphone } from "lucide-react";
import { usePluginNatif, messageErreurPlugin } from "@/lib/usePluginNatif";
import { synchroniserUsage, obtenirUsage, type LigneUsage } from "@/lib/api";
import { Skeleton } from "./Skeleton";

/**
 * Écran autonome pour le plugin natif TempsEcran (Android uniquement --
 * voir TempsEcranPlugin.kt, construit le 26/08/2026). PAS d'équivalent iOS
 * pour l'instant : Screen Time nécessite l'entitlement Family Controls
 * (compte Apple Developer Program actif, que Bourama n'a pas encore) et un
 * target d'extension Xcode séparé -- documenté dans
 * clovis-mobile/ios-legacy-natif/.../UsageScreen.swift, pas contourné ici.
 *
 * Construit à la demande de Bourama ("go" en réponse à l'audit du 26/08
 * listant les interfaces manquantes) : composant fonctionnel autonome, pas
 * de route ni de placement dans la navigation imposé.
 *
 * Pas de mécanisme i18n branché (voir EspaceParametres.tsx) -- textes en
 * dur en français.
 */

type AppUsage = { nomPaquet: string; dureeSecondes: number };

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
        // Synchronise vers le backend puis relit l'historique -- voir
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
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-24 rounded-cgpt-carte" />
      </div>
    );
  }

  if (!natif) {
    return (
      <div className="flex animate-dj-fade-in-rapide flex-col items-center gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-6 text-center">
        <Smartphone size={22} className="text-dj-texte-muet" />
        <p className="text-sm text-dj-texte-muet">Temps d&apos;écran est disponible uniquement depuis l&apos;app mobile Android.</p>
      </div>
    );
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
        <Skeleton className="h-20 rounded-cgpt-carte" />
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
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 rounded-cgpt-carte" />
          <Skeleton className="h-12 rounded-cgpt-carte" />
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
                    <span className="truncate text-sm text-dj-texte">{a.nomPaquet}</span>
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
