"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Settings2, Play, Square } from "lucide-react";
import { usePluginNatif, messageErreurPlugin } from "@/lib/usePluginNatif";
import { Skeleton } from "./Skeleton";
import { BandeauTelechargerApp } from "./BandeauTelechargerApp";
import { BoutonInfoSection } from "./BoutonInfoSection";

/**
 * Écran autonome pour le plugin natif ControleSession (Lot 3B Partie 3
 * mobile, 25/08/2026 : voir android/.../controlesession/ControleSessionPlugin.kt).
 * Composant construit le 26/08/2026 à la demande de Bourama : les 5 plugins
 * sans interface doivent être "faits pour qu'elle les intègre où elle veut"
 * : pas de route Next.js dédiée ici, pas de décision sur l'emplacement dans
 * la navigation (un autre chantier de Bourama s'en charge), juste le
 * composant fonctionnel.
 *
 * 09/09/2026, Bourama : la session est maintenant basée sur une durée
 * choisie par l'étudiant (fini l'arrêt manuel uniquement), pour que
 * l'auto-arrêt fonctionne de façon fiable même si l'app est tuée entre
 * temps (voir ControleSessionPlugin.kt/ControleSessionAlarmReceiver.kt) ET
 * pour que ce soit pilotable par l'IA côté chat. Choix de durée en pilules
 * prédéfinies + saisie libre (recherche de références faite avant de
 * coder : motif "durées prédéfinies en boutons" repris de Forest/Temps
 * d'écran iOS, style pilule déjà utilisé ailleurs dans l'app).
 *
 * `sessionActive` démarre toujours à `false` à l'ouverture de l'écran : le
 * plugin n'expose toujours pas de méthode pour savoir si une session
 * démarrée plus tôt (par ce composant ou par l'IA) est encore en cours au
 * moment où l'étudiant rouvre cet écran, limite déjà documentée avant ce
 * chantier, pas résolue ici (hors demande de Bourama pour cette session de
 * travail).
 *
 * Pas de mécanisme i18n branché dans ce projet (même constat que
 * EspaceParametres.tsx/EspacePlugins.tsx) : textes en dur en français.
 */

type PluginControleSession = {
  permissionAccordee(): Promise<{ accordee: boolean }>;
  ouvrirReglagesPermission(): Promise<void>;
  demarrerSession(options: { dureeMinutes: number }): Promise<void>;
  arreterSession(): Promise<void>;
};

const DUREES_PREDEFINIES_MIN = [15, 30, 45, 60, 90];

export function EspaceControleSession() {
  const { natif, plugin } = usePluginNatif<PluginControleSession>("ControleSession");

  const [chargementPermission, setChargementPermission] = useState(true);
  const [permissionAccordee, setPermissionAccordee] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [dureeChoisieMin, setDureeChoisieMin] = useState<number | null>(30);
  const [dureeLibre, setDureeLibre] = useState("");

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

  function choisirDureePredefinie(minutes: number) {
    setDureeChoisieMin(minutes);
    setDureeLibre("");
  }

  function changerDureeLibre(valeur: string) {
    setDureeLibre(valeur);
    const nombre = parseInt(valeur, 10);
    setDureeChoisieMin(Number.isFinite(nombre) && nombre > 0 ? nombre : null);
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
        if (!dureeChoisieMin) {
          setErreur("Choisis une durée avant de démarrer.");
          return;
        }
        await plugin.demarrerSession({ dureeMinutes: dureeChoisieMin });
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
      <div className="flex flex-col gap-4 p-4" aria-hidden>
        <div>
          <Skeleton className="h-4 w-44 rounded" />
          <Skeleton className="mt-1 h-3 w-full rounded" style={{ animationDelay: "60ms" }} />
          <Skeleton className="h-3 w-3/4 rounded" style={{ animationDelay: "120ms" }} />
        </div>
        <div className="flex flex-col items-center gap-4 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-6">
          <Skeleton className="h-3 w-3 rounded-full" style={{ animationDelay: "180ms" }} />
          <Skeleton className="h-3.5 w-40 rounded" style={{ animationDelay: "240ms" }} />
          <Skeleton className="h-8 w-44 rounded-lg" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    );
  }

  if (!natif) {
    // 30/08/2026, audit navigation web mobile vs natif, étape 4 :
    // couvre PC ET navigateur mobile (usePluginNatif ne distingue pas
    // les deux), conformément à la décision de Bourama de verrouiller
    // les 2 sous-écrans de Concentration sur PC (pas de partie
    // "consultation" côté serveur pour Contrôle de session, contrairement
    // à Temps d'écran, voir EspaceTempsEcran.tsx).
    return <BandeauTelechargerApp titre="Contrôle de session" />;
  }

  return (
    <div className="flex animate-dj-fade-in-rapide flex-col gap-4 p-4">
      <div className="flex items-center gap-1.5">
        <h2 className="font-display text-base font-bold text-dj-texte">Contrôle de session</h2>
        <BoutonInfoSection
          rubriqueId="controle-session"
          texteCourt="Coupe les sonneries et notifications, et active Ne pas déranger pendant la durée choisie."
        />
      </div>

      {chargementPermission ? (
        <div
          className="flex flex-col items-center gap-4 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-6"
          aria-hidden
        >
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-3.5 w-40 rounded" style={{ animationDelay: "80ms" }} />
          <Skeleton className="h-8 w-44 rounded-lg" style={{ animationDelay: "160ms" }} />
        </div>
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

          {!sessionActive && (
            <div className="flex w-full flex-col items-center gap-2">
              <span className="text-xs text-dj-texte-muet">Durée</span>
              <div className="flex flex-wrap justify-center gap-1.5">
                {DUREES_PREDEFINIES_MIN.map((minutes) => (
                  <button
                    key={minutes}
                    onClick={() => choisirDureePredefinie(minutes)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                      dureeChoisieMin === minutes && dureeLibre === ""
                        ? "bg-dj-accent-1 text-[#1A0D02]"
                        : "border border-dj-bordure bg-dj-surface text-dj-texte hover:bg-dj-surface-haute"
                    }`}
                  >
                    {minutes} min
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder="Autre (min)"
                  value={dureeLibre}
                  onChange={(e) => changerDureeLibre(e.target.value)}
                  className="w-24 rounded-lg border border-dj-bordure bg-dj-surface px-2.5 py-1.5 text-center text-xs text-dj-texte outline-none focus:border-dj-accent-1"
                />
              </div>
            </div>
          )}

          <button
            onClick={basculerSession}
            disabled={enCours || (!sessionActive && !dureeChoisieMin)}
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
