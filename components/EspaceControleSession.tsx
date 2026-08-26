"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Settings2, Play, Square, Smartphone } from "lucide-react";
import { usePluginNatif, messageErreurPlugin } from "@/lib/usePluginNatif";
import { Skeleton } from "./Skeleton";

/**
 * Écran autonome pour le plugin natif ControleSession (Lot 3B Partie 3
 * mobile, 25/08/2026 : voir android/.../controlesession/ControleSessionPlugin.kt).
 * Composant construit le 26/08/2026 à la demande de Bourama : les 5 plugins
 * sans interface doivent être "faits pour qu'elle les intègre où elle veut"
 * : pas de route Next.js dédiée ici, pas de décision sur l'emplacement dans
 * la navigation (un autre chantier de Bourama s'en charge), juste le
 * composant fonctionnel.
 *
 * Le plugin n'expose PAS de méthode pour savoir si une session est déjà en
 * cours (seulement demarrerSession/arreterSession) : son propre commentaire
 * dit que l'état ne survit pas à un kill de process. Donc `sessionActive`
 * démarre toujours à `false` ici : ce n'est pas une supposition, c'est ce
 * que le plugin documente lui-même comme comportement voulu.
 *
 * Pas de mécanisme i18n branché dans ce projet (même constat que
 * EspaceParametres.tsx/EspacePlugins.tsx) : textes en dur en français.
 */

type PluginControleSession = {
  permissionAccordee(): Promise<{ accordee: boolean }>;
  ouvrirReglagesPermission(): Promise<void>;
  demarrerSession(): Promise<void>;
  arreterSession(): Promise<void>;
};

export function EspaceControleSession() {
  const { natif, plugin } = usePluginNatif<PluginControleSession>("ControleSession");

  const [chargementPermission, setChargementPermission] = useState(true);
  const [permissionAccordee, setPermissionAccordee] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [enCours, setEnCours] = useState(false);
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

  // L'utilisateur accorde la permission dans les Réglages système, en dehors
  // de l'app : on revérifie automatiquement quand l'app reprend le focus,
  // plutôt que d'obliger à revenir sur cet écran ou à taper un bouton
  // "actualiser" (anticipation d'un aller-retour Réglages <-> app).
  useEffect(() => {
    function surRetourFocus() {
      if (document.visibilityState === "visible") verifierPermission();
    }
    document.addEventListener("visibilitychange", surRetourFocus);
    return () => document.removeEventListener("visibilitychange", surRetourFocus);
  }, [verifierPermission]);

  async function ouvrirReglages() {
    if (!plugin) return;
    setErreur(null);
    try {
      await plugin.ouvrirReglagesPermission();
    } catch (e) {
      setErreur(messageErreurPlugin(e));
    }
  }

  async function basculerSession() {
    if (!plugin) return;
    setErreur(null);
    setEnCours(true);
    try {
      if (sessionActive) {
        await plugin.arreterSession();
        setSessionActive(false);
      } else {
        await plugin.demarrerSession();
        setSessionActive(true);
      }
    } catch (e) {
      setErreur(messageErreurPlugin(e));
    } finally {
      setEnCours(false);
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
        <p className="text-sm text-dj-texte-muet">Contrôle de session est disponible uniquement depuis l&apos;app mobile.</p>
      </div>
    );
  }

  return (
    <div className="flex animate-dj-fade-in-rapide flex-col gap-4 p-4">
      <div>
        <h2 className="font-display text-base font-bold text-dj-texte">Contrôle de session</h2>
        <p className="mt-1 text-xs text-dj-texte-muet">
          Coupe les sonneries et notifications, et active Ne pas déranger le temps de ta session de travail.
        </p>
      </div>

      {chargementPermission ? (
        <Skeleton className="h-20 rounded-cgpt-carte" />
      ) : !permissionAccordee ? (
        <div className="flex flex-col gap-3 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="mt-0.5 flex-shrink-0 text-dj-texte-muet" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-dj-texte">Permission requise</span>
              <span className="text-xs text-dj-texte-muet">
                Accorde l&apos;accès à la Politique de notification pour que Clovis puisse couper le son et activer Ne pas
                déranger.
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
        <div className="flex flex-col items-center gap-4 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-6">
          <span
            className={`h-3 w-3 rounded-full ${sessionActive ? "bg-dj-succes" : "bg-dj-inactif"}`}
            aria-hidden
          />
          <span className="text-sm text-dj-texte">{sessionActive ? "Session en cours" : "Aucune session en cours"}</span>
          <button
            onClick={basculerSession}
            disabled={enCours}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50 ${
              sessionActive
                ? "bg-dj-surface-haute text-dj-texte hover:bg-dj-bordure"
                : "bg-dj-accent-1 text-[#1A0D02] hover:bg-dj-accent-2"
            }`}
          >
            {sessionActive ? <Square size={14} /> : <Play size={14} />}
            {sessionActive ? "Arrêter la session" : "Démarrer une session"}
          </button>
        </div>
      )}

      {erreur && <span className="text-sm text-[var(--dj-erreur)]">{erreur}</span>}
    </div>
  );
}
