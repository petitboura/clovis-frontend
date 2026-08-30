"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw, Smartphone } from "lucide-react";
import { usePluginNatif, messageErreurPlugin } from "@/lib/usePluginNatif";
import { Skeleton } from "./Skeleton";

/**
 * Carte autonome pour le plugin natif MiseAJour (Lot 3B Partie 3 mobile,
 * 25/08/2026 : voir android/src/play/.../MiseAJourPlugin.kt (stub, Play
 * Store gère les mises à jour lui-même) et android/src/externe/.../MiseAJourPlugin.kt
 * (vraie logique, hors Play Store)). disponible() renvoie `false` sur le
 * flavor "play" : ce n'est pas une supposition de ma part, c'est le
 * comportement documenté par le plugin lui-même, donc cette carte affiche
 * une explication plutôt que de disparaître silencieusement.
 *
 * Construit le 26/08/2026, groupe "Capacités du téléphone", carte simple
 * (statut + bouton), pas un écran à part. Pas de mécanisme i18n branché
 * (voir EspaceParametres.tsx) : textes en dur en français.
 */

type InfoMiseAJour = {
  misAJourDisponible: boolean;
  version?: string;
  urlTelechargement?: string;
  urlPage?: string;
};

type PluginMiseAJour = {
  disponible(): Promise<{ disponible: boolean }>;
  verifier(): Promise<InfoMiseAJour>;
  ouvrirTelechargement(options: { urlTelechargement: string }): Promise<void>;
};

export function MiseAJourCarte() {
  const { natif, plugin } = usePluginNatif<PluginMiseAJour>("MiseAJour");

  const [chargement, setChargement] = useState(true);
  const [disponibleSurCeBuild, setDisponibleSurCeBuild] = useState(false);
  const [verification, setVerification] = useState(false);
  const [info, setInfo] = useState<InfoMiseAJour | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!plugin) return;
    plugin
      .disponible()
      .then((r) => setDisponibleSurCeBuild(r.disponible))
      .catch((e) => setErreur(messageErreurPlugin(e)))
      .finally(() => setChargement(false));
  }, [plugin]);

  async function verifier() {
    if (!plugin) return;
    setErreur(null);
    setVerification(true);
    setInfo(null);
    try {
      const r = await plugin.verifier();
      setInfo(r);
    } catch (e) {
      setErreur(messageErreurPlugin(e));
    } finally {
      setVerification(false);
    }
  }

  async function telecharger() {
    if (!plugin || !info?.urlTelechargement) return;
    setErreur(null);
    try {
      await plugin.ouvrirTelechargement({ urlTelechargement: info.urlTelechargement });
    } catch (e) {
      setErreur(messageErreurPlugin(e));
    }
  }

  if (natif === null || chargement) {
    return (
      <div className="flex flex-col gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4" aria-hidden>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-[18px] w-[18px] flex-shrink-0 rounded" />
            <div className="flex flex-col gap-0.5">
              <Skeleton className="h-3.5 w-20 rounded" />
              <Skeleton className="h-2.5 w-28 rounded" />
            </div>
          </div>
          <Skeleton className="h-6 w-24 flex-shrink-0 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!natif) {
    return (
      <div className="flex animate-dj-fade-in-rapide items-center gap-3 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
        <Smartphone size={18} className="flex-shrink-0 text-dj-texte-muet" />
        <span className="text-sm text-dj-texte-muet">Mise à jour disponible uniquement depuis l&apos;app mobile.</span>
      </div>
    );
  }

  if (!disponibleSurCeBuild) {
    return (
      <div className="flex animate-dj-fade-in-rapide items-center gap-3 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
        <Download size={18} className="flex-shrink-0 text-dj-texte-muet" />
        <span className="text-sm text-dj-texte-muet">Les mises à jour sont gérées automatiquement par le Play Store.</span>
      </div>
    );
  }

  return (
    <div className="flex animate-dj-fade-in-rapide flex-col gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Download size={18} className="flex-shrink-0 text-dj-texte-muet" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-dj-texte">Mise à jour</span>
            <span className="text-xs text-dj-texte-muet">
              {info === null
                ? "Statut inconnu"
                : info.misAJourDisponible
                  ? `Version ${info.version ?? "?"} disponible`
                  : "Application à jour"}
            </span>
          </div>
        </div>
        {info?.misAJourDisponible ? (
          <button
            onClick={telecharger}
            className="flex-shrink-0 rounded-lg bg-dj-accent-1 px-3 py-1.5 text-xs font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2"
          >
            Télécharger
          </button>
        ) : (
          <button
            onClick={verifier}
            disabled={verification}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-dj-surface-haute px-3 py-1.5 text-xs font-bold text-dj-texte transition-colors hover:bg-dj-bordure disabled:opacity-50"
          >
            <RefreshCw size={12} className={verification ? "animate-spin" : ""} />
            Vérifier
          </button>
        )}
      </div>
      {erreur && <span className="text-xs text-[var(--dj-erreur)]">{erreur}</span>}
    </div>
  );
}
