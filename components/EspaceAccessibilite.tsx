"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Settings2, Plus, X, Smartphone, ScrollText } from "lucide-react";
import { usePluginNatif, messageErreurPlugin } from "@/lib/usePluginNatif";
import { Skeleton } from "./Skeleton";

/**
 * Écran autonome pour le plugin natif Accessibilite (Lot 3B Partie 3 mobile,
 * 25/08/2026 : voir android/src/externe/.../accessibilite/AccessibilitePlugin.kt,
 * flavor "externe" uniquement : disponible() renvoie `false` sur le flavor
 * "play", ce n'est pas une supposition, c'est documenté par le plugin
 * lui-même).
 *
 * Construit le 26/08/2026 à la demande de Bourama : composant fonctionnel
 * autonome, pas de route Next.js dédiée, pas de décision sur l'emplacement
 * dans la navigation.
 *
 * cliquerParTexte/saisirTexteParCible ne sont PAS exposés ici : ce sont des
 * primitives que l'agent utilise lui-même (comme rechercherNotion côté
 * Connecteurs), pas des actions que l'utilisateur déclenche depuis cet
 * écran de réglages.
 *
 * Pas de méthode pour lister les apps installées côté plugin (seulement
 * autoriser/revoquer par nom de paquet) : pas de sélecteur d'apps ici,
 * juste un champ texte pour le nom de paquet. À signaler à Bourama si un
 * vrai sélecteur d'apps installées est souhaité plus tard.
 *
 * Pas de mécanisme i18n branché (voir EspaceParametres.tsx) : textes en
 * dur en français.
 */

type EntreeAccessibilite = { nomPaquet: string; typeEvenement: string; nombreNoeudsLus: number; horodatage: number };
type EntreeActions = { nomPaquet: string; cible: string; succes: boolean; message: string; horodatage: number };

type PluginAccessibilite = {
  disponible(): Promise<{ disponible: boolean }>;
  serviceActif(): Promise<{ actif: boolean }>;
  ouvrirReglagesService(): Promise<void>;
  listerAppsAutorisees(): Promise<{ paquets: string[] }>;
  autoriserApp(options: { nomPaquet: string }): Promise<void>;
  revoquerApp(options: { nomPaquet: string }): Promise<void>;
  journalAccessibilite(): Promise<{ entrees: EntreeAccessibilite[] }>;
  journalActions(): Promise<{ entrees: EntreeActions[] }>;
};

function formaterHorodatage(ms: number): string {
  return new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function EspaceAccessibilite() {
  const { natif, plugin } = usePluginNatif<PluginAccessibilite>("Accessibilite");

  const [chargementEtat, setChargementEtat] = useState(true);
  const [disponibleSurCeBuild, setDisponibleSurCeBuild] = useState(false);
  const [serviceActif, setServiceActif] = useState(false);

  const [paquets, setPaquets] = useState<string[]>([]);
  const [nouveauPaquet, setNouveauPaquet] = useState("");
  const [action, setAction] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [onglet, setOnglet] = useState<"apps" | "lectures" | "actions">("apps");
  const [journalLectures, setJournalLectures] = useState<EntreeAccessibilite[] | null>(null);
  const [journalActions, setJournalActions] = useState<EntreeActions[] | null>(null);

  const verifierEtat = useCallback(() => {
    if (!plugin) return;
    setChargementEtat(true);
    Promise.all([plugin.disponible(), plugin.serviceActif()])
      .then(([d, s]) => {
        setDisponibleSurCeBuild(d.disponible);
        setServiceActif(s.actif);
      })
      .catch((e) => setErreur(messageErreurPlugin(e)))
      .finally(() => setChargementEtat(false));
  }, [plugin]);

  useEffect(() => {
    verifierEtat();
  }, [verifierEtat]);

  // Même logique que EspaceControleSession : l'activation se fait dans les
  // Réglages système (Accessibilité), en dehors de l'app.
  useEffect(() => {
    function surRetourFocus() {
      if (document.visibilityState === "visible") verifierEtat();
    }
    document.addEventListener("visibilitychange", surRetourFocus);
    return () => document.removeEventListener("visibilitychange", surRetourFocus);
  }, [verifierEtat]);

  useEffect(() => {
    if (!plugin || !serviceActif) return;
    plugin.listerAppsAutorisees().then((r) => setPaquets(r.paquets));
  }, [plugin, serviceActif]);

  useEffect(() => {
    if (!plugin || !serviceActif) return;
    if (onglet === "lectures" && journalLectures === null) {
      plugin.journalAccessibilite().then((r) => setJournalLectures(r.entrees));
    } else if (onglet === "actions" && journalActions === null) {
      plugin.journalActions().then((r) => setJournalActions(r.entrees));
    }
  }, [plugin, serviceActif, onglet, journalLectures, journalActions]);

  async function ouvrirReglages() {
    if (!plugin) return;
    setErreur(null);
    try {
      await plugin.ouvrirReglagesService();
    } catch (e) {
      setErreur(messageErreurPlugin(e));
    }
  }

  async function autoriser() {
    if (!plugin || !nouveauPaquet.trim()) return;
    setAction(true);
    setErreur(null);
    try {
      await plugin.autoriserApp({ nomPaquet: nouveauPaquet.trim() });
      setPaquets((p) => [...p, nouveauPaquet.trim()]);
      setNouveauPaquet("");
    } catch (e) {
      setErreur(messageErreurPlugin(e));
    } finally {
      setAction(false);
    }
  }

  async function revoquer(nomPaquet: string) {
    if (!plugin) return;
    setAction(true);
    setErreur(null);
    try {
      await plugin.revoquerApp({ nomPaquet });
      setPaquets((p) => p.filter((x) => x !== nomPaquet));
    } catch (e) {
      setErreur(messageErreurPlugin(e));
    } finally {
      setAction(false);
    }
  }

  if (natif === null || chargementEtat) {
    return (
      <div className="flex animate-dj-fade-in-rapide flex-col gap-4 p-4" aria-hidden>
        <div>
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="mt-2 h-3 w-64 rounded" />
        </div>

        <div className="flex gap-1 rounded-lg bg-dj-surface-haute p-1">
          <div className="flex-1 px-2 py-1.5">
            <Skeleton className="mx-auto h-3 w-3/4 rounded" />
          </div>
          <div className="flex-1 px-2 py-1.5">
            <Skeleton className="mx-auto h-3 w-3/4 rounded" />
          </div>
          <div className="flex-1 px-2 py-1.5">
            <Skeleton className="mx-auto h-3 w-3/4 rounded" />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1 rounded-lg border border-dj-bordure" />
            <Skeleton className="h-8 w-24 flex-shrink-0 rounded-lg" />
          </div>
          <div className="overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface">
            <div className="divide-y divide-dj-bordure">
              {["w-40", "w-32", "w-48", "w-36"].map((largeur, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <Skeleton className={`h-3.5 ${largeur} rounded`} />
                  <Skeleton className="h-[26px] w-[26px] flex-shrink-0 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!natif) {
    return (
      <div className="flex animate-dj-fade-in-rapide flex-col items-center gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-6 text-center">
        <Smartphone size={22} className="text-dj-texte-muet" />
        <p className="text-sm text-dj-texte-muet">Accessibilité est disponible uniquement depuis l&apos;app mobile.</p>
      </div>
    );
  }

  if (!disponibleSurCeBuild) {
    return (
      <div className="flex animate-dj-fade-in-rapide flex-col items-center gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-6 text-center">
        <ShieldCheck size={22} className="text-dj-texte-muet" />
        <p className="text-sm text-dj-texte-muet">Cette fonctionnalité n&apos;est pas disponible sur cette version de l&apos;app.</p>
      </div>
    );
  }

  return (
    <div className="flex animate-dj-fade-in-rapide flex-col gap-4 p-4">
      <div>
        <h2 className="font-display text-base font-bold text-dj-texte">Accessibilité</h2>
        <p className="mt-1 text-xs text-dj-texte-muet">
          Autorise Clovis à lire et agir dans les apps que tu choisis, une par une.
        </p>
      </div>

      {!serviceActif ? (
        <div className="flex flex-col gap-3 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="mt-0.5 flex-shrink-0 text-dj-texte-muet" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-dj-texte">Service non activé</span>
              <span className="text-xs text-dj-texte-muet">
                Active le service d&apos;accessibilité de Clovis dans les réglages système pour continuer.
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
      ) : (
        <>
          <div className="flex gap-1 rounded-lg bg-dj-surface-haute p-1">
            {(
              [
                ["apps", "Apps autorisées"],
                ["lectures", "Journal (lecture)"],
                ["actions", "Journal (actions)"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setOnglet(id)}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                  onglet === id ? "bg-dj-surface text-dj-texte" : "text-dj-texte-muet hover:text-dj-texte"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {onglet === "apps" && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  value={nouveauPaquet}
                  onChange={(e) => setNouveauPaquet(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && autoriser()}
                  placeholder="Nom du paquet (ex : com.whatsapp)"
                  className="flex-1 rounded-lg border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-accent-1"
                />
                <button
                  onClick={autoriser}
                  disabled={action || !nouveauPaquet.trim()}
                  className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-dj-accent-1 px-3 py-2 text-xs font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
                >
                  <Plus size={14} />
                  Autoriser
                </button>
              </div>
              {paquets.length === 0 ? (
                <p className="p-2 text-sm text-dj-texte-muet">Aucune app autorisée pour l&apos;instant.</p>
              ) : (
                <div className="overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface">
                  <div className="divide-y divide-dj-bordure">
                    {paquets.map((p) => (
                      <div key={p} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <span className="truncate text-sm text-dj-texte">{p}</span>
                        <button
                          onClick={() => revoquer(p)}
                          disabled={action}
                          aria-label="Révoquer"
                          className="flex-shrink-0 rounded-lg p-1.5 text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-[var(--dj-erreur)] disabled:opacity-50"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {onglet === "lectures" &&
            (journalLectures === null ? (
              <div className="overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface" aria-hidden>
                <div className="divide-y divide-dj-bordure">
                  {["w-32", "w-40", "w-24", "w-36", "w-28"].map((largeur, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                      <Skeleton className="h-[14px] w-[14px] flex-shrink-0 rounded" />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <Skeleton className={`h-3.5 ${largeur} rounded`} />
                        <Skeleton className="h-2.5 w-24 rounded" />
                      </div>
                      <Skeleton className="h-2.5 w-8 flex-shrink-0 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ) : journalLectures.length === 0 ? (
              <p className="p-2 text-sm text-dj-texte-muet">Aucune lecture récente.</p>
            ) : (
              <div className="overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface">
                <div className="divide-y divide-dj-bordure">
                  {journalLectures.map((e, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                      <ScrollText size={14} className="flex-shrink-0 text-dj-texte-muet" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm text-dj-texte">{e.nomPaquet}</span>
                        <span className="text-xs text-dj-texte-muet">
                          {e.typeEvenement} · {e.nombreNoeudsLus} nœuds
                        </span>
                      </div>
                      <span className="flex-shrink-0 text-xs text-dj-texte-muet">{formaterHorodatage(e.horodatage)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

          {onglet === "actions" &&
            (journalActions === null ? (
              <div className="overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface" aria-hidden>
                <div className="divide-y divide-dj-bordure">
                  {["w-36", "w-28", "w-44", "w-32", "w-40"].map((largeur, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                      <Skeleton className="h-2 w-2 flex-shrink-0 rounded-full" />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <Skeleton className={`h-3.5 ${largeur} rounded`} />
                        <Skeleton className="h-2.5 w-28 rounded" />
                      </div>
                      <Skeleton className="h-2.5 w-8 flex-shrink-0 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ) : journalActions.length === 0 ? (
              <p className="p-2 text-sm text-dj-texte-muet">Aucune action récente.</p>
            ) : (
              <div className="overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface">
                <div className="divide-y divide-dj-bordure">
                  {journalActions.map((e, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                      <span
                        className={`h-2 w-2 flex-shrink-0 rounded-full ${e.succes ? "bg-dj-succes" : "bg-[var(--dj-erreur)]"}`}
                        aria-hidden
                      />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm text-dj-texte">
                          {e.nomPaquet} · {e.cible}
                        </span>
                        <span className="truncate text-xs text-dj-texte-muet">{e.message}</span>
                      </div>
                      <span className="flex-shrink-0 text-xs text-dj-texte-muet">{formaterHorodatage(e.horodatage)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </>
      )}

      {erreur && <span className="text-sm text-[var(--dj-erreur)]">{erreur}</span>}
    </div>
  );
}
