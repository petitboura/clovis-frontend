"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, CalendarPlus, ExternalLink, Send, ShieldCheck } from "lucide-react";
import { usePluginNatif, messageErreurPlugin } from "@/lib/usePluginNatif";
import { Skeleton } from "./Skeleton";
import { BandeauTelechargerApp } from "./BandeauTelechargerApp";

/**
 * Écran autonome pour le plugin Notifications : construit d'abord côté
 * iOS (NotificationsPlugin.swift), Android en avait été oublié (aucun
 * plugin équivalent, aucun registerPlugin dans MainActivity.java). Le
 * plugin Android manquant a été ajouté le 26/08/2026
 * (NotificationsPlugin.kt), avec exactement le même nom JS et les mêmes
 * méthodes que la version iOS : ce composant fonctionne donc sur les deux
 * plateformes sans code spécifique, sauf `ouvrirApp` (voir plus bas).
 *
 * Pas de mécanisme i18n branché (voir EspaceParametres.tsx) : textes en
 * dur en français.
 */

type PluginNotifications = {
  demanderAutorisation(): Promise<{ accordee: boolean }>;
  autorisationAccordee(): Promise<{ accordee: boolean }>;
  afficherNotificationTest(options: { titre: string; corps: string; prioritaire?: boolean }): Promise<void>;
  programmerRappel(options: { titre: string; corps: string; dateEpochMs: number }): Promise<void>;
  creerEvenementCalendrier(options: { titre: string; debutEpochMs: number; finEpochMs: number }): Promise<{ sauvegarde: boolean }>;
  ouvrirApp(options: { nomPaquet?: string; schema?: string }): Promise<void>;
};

function dateInputVersEpochMs(valeur: string): number | null {
  if (!valeur) return null;
  const t = new Date(valeur).getTime();
  return Number.isNaN(t) ? null : t;
}

export function EspaceRappels() {
  const { natif, plugin } = usePluginNatif<PluginNotifications>("Notifications");

  const [chargementPermission, setChargementPermission] = useState(true);
  const [accordee, setAccordee] = useState(false);
  const [action, setAction] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const [titreRappel, setTitreRappel] = useState("");
  const [corpsRappel, setCorpsRappel] = useState("");
  const [dateRappel, setDateRappel] = useState("");

  const [titreEvenement, setTitreEvenement] = useState("");
  const [debutEvenement, setDebutEvenement] = useState("");
  const [finEvenement, setFinEvenement] = useState("");

  const [nomPaquet, setNomPaquet] = useState("");
  const [schema, setSchema] = useState("");

  const verifierPermission = useCallback(() => {
    if (!plugin) return;
    setChargementPermission(true);
    plugin
      .autorisationAccordee()
      .then((r) => setAccordee(r.accordee))
      .catch((e) => setErreur(messageErreurPlugin(e)))
      .finally(() => setChargementPermission(false));
  }, [plugin]);

  useEffect(() => {
    verifierPermission();
  }, [verifierPermission]);

  async function demanderPermission() {
    if (!plugin) return;
    setErreur(null);
    try {
      const r = await plugin.demanderAutorisation();
      setAccordee(r.accordee);
    } catch (e) {
      setErreur(messageErreurPlugin(e));
    }
  }

  async function envoyerTest() {
    if (!plugin || !titreRappel.trim() || !corpsRappel.trim()) return;
    setAction(true);
    setErreur(null);
    setConfirmation(null);
    try {
      await plugin.afficherNotificationTest({ titre: titreRappel.trim(), corps: corpsRappel.trim() });
      setConfirmation("Notification envoyée.");
    } catch (e) {
      setErreur(messageErreurPlugin(e));
    } finally {
      setAction(false);
    }
  }

  async function programmer() {
    if (!plugin || !titreRappel.trim() || !corpsRappel.trim()) return;
    const dateEpochMs = dateInputVersEpochMs(dateRappel);
    if (dateEpochMs === null) {
      setErreur("Choisis une date et une heure valides.");
      return;
    }
    setAction(true);
    setErreur(null);
    setConfirmation(null);
    try {
      await plugin.programmerRappel({ titre: titreRappel.trim(), corps: corpsRappel.trim(), dateEpochMs });
      setConfirmation("Rappel programmé.");
    } catch (e) {
      setErreur(messageErreurPlugin(e));
    } finally {
      setAction(false);
    }
  }

  async function creerEvenement() {
    if (!plugin || !titreEvenement.trim()) return;
    const debutEpochMs = dateInputVersEpochMs(debutEvenement);
    const finEpochMs = dateInputVersEpochMs(finEvenement);
    if (debutEpochMs === null || finEpochMs === null) {
      setErreur("Choisis une date de début et de fin valides.");
      return;
    }
    setAction(true);
    setErreur(null);
    setConfirmation(null);
    try {
      const r = await plugin.creerEvenementCalendrier({ titre: titreEvenement.trim(), debutEpochMs, finEpochMs });
      setConfirmation(r.sauvegarde ? "Événement ajouté au calendrier." : "Ajout annulé.");
    } catch (e) {
      setErreur(messageErreurPlugin(e));
    } finally {
      setAction(false);
    }
  }

  async function ouvrirApp() {
    if (!plugin || (!nomPaquet.trim() && !schema.trim())) return;
    setAction(true);
    setErreur(null);
    try {
      await plugin.ouvrirApp({ nomPaquet: nomPaquet.trim() || undefined, schema: schema.trim() || undefined });
    } catch (e) {
      setErreur(messageErreurPlugin(e));
    } finally {
      setAction(false);
    }
  }

  if (natif === null || chargementPermission) {
    return (
      <div className="flex flex-col gap-4 p-4" aria-hidden>
        <div>
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="mt-1 h-3 w-full rounded" style={{ animationDelay: "60ms" }} />
          <Skeleton className="h-3 w-1/2 rounded" style={{ animationDelay: "120ms" }} />
        </div>

        <div className="flex flex-col gap-3 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 flex-shrink-0 rounded" style={{ animationDelay: "180ms" }} />
            <Skeleton className="h-3.5 w-28 rounded" style={{ animationDelay: "200ms" }} />
          </div>
          <Skeleton className="h-9 rounded-lg" style={{ animationDelay: "220ms" }} />
          <Skeleton className="h-9 rounded-lg" style={{ animationDelay: "240ms" }} />
          <Skeleton className="h-9 rounded-lg" style={{ animationDelay: "260ms" }} />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-32 rounded-lg" style={{ animationDelay: "280ms" }} />
            <Skeleton className="h-6 w-28 rounded-lg" style={{ animationDelay: "300ms" }} />
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 flex-shrink-0 rounded" style={{ animationDelay: "340ms" }} />
            <Skeleton className="h-3.5 w-40 rounded" style={{ animationDelay: "360ms" }} />
          </div>
          <Skeleton className="h-9 rounded-lg" style={{ animationDelay: "380ms" }} />
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1 rounded-lg" style={{ animationDelay: "400ms" }} />
            <Skeleton className="h-9 flex-1 rounded-lg" style={{ animationDelay: "420ms" }} />
          </div>
          <Skeleton className="h-6 w-24 rounded-lg" style={{ animationDelay: "440ms" }} />
        </div>

        <div className="flex flex-col gap-3 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 flex-shrink-0 rounded" style={{ animationDelay: "500ms" }} />
            <Skeleton className="h-3.5 w-28 rounded" style={{ animationDelay: "520ms" }} />
          </div>
          <Skeleton className="h-3 w-full rounded" style={{ animationDelay: "540ms" }} />
          <Skeleton className="h-3 w-2/3 rounded" style={{ animationDelay: "560ms" }} />
          <Skeleton className="h-9 rounded-lg" style={{ animationDelay: "580ms" }} />
          <Skeleton className="h-9 rounded-lg" style={{ animationDelay: "600ms" }} />
          <Skeleton className="h-6 w-20 rounded-lg" style={{ animationDelay: "620ms" }} />
        </div>
      </div>
    );
  }

  if (!natif) {
    // 30/08/2026, audit navigation web mobile vs natif, étape 4 : couvre
    // PC ET navigateur mobile (usePluginNatif ne distingue pas les deux).
    return <BandeauTelechargerApp titre="Rappels" />;
  }

  return (
    <div className="flex animate-dj-fade-in-rapide flex-col gap-4 p-4">
      <div>
        <h2 className="font-display text-base font-bold text-dj-texte">Rappels</h2>
        <p className="mt-1 text-xs text-dj-texte-muet">Notifications, rappels programmés et événements de calendrier.</p>
      </div>

      {!accordee ? (
        <div className="flex flex-col gap-3 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="mt-0.5 flex-shrink-0 text-dj-texte-muet" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-dj-texte">Autorisation requise</span>
              <span className="text-xs text-dj-texte-muet">Autorise les notifications pour recevoir tes rappels.</span>
            </div>
          </div>
          <button
            onClick={demanderPermission}
            className="flex w-fit items-center gap-2 self-start rounded-lg bg-dj-accent-1 px-3 py-1.5 text-xs font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2"
          >
            Autoriser
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-dj-texte-muet" />
              <span className="text-sm font-medium text-dj-texte">Nouveau rappel</span>
            </div>
            <input
              value={titreRappel}
              onChange={(e) => setTitreRappel(e.target.value)}
              placeholder="Titre"
              className="rounded-lg border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-accent-1"
            />
            <input
              value={corpsRappel}
              onChange={(e) => setCorpsRappel(e.target.value)}
              placeholder="Message"
              className="rounded-lg border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-accent-1"
            />
            <input
              type="datetime-local"
              value={dateRappel}
              onChange={(e) => setDateRappel(e.target.value)}
              className="rounded-lg border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-accent-1"
            />
            <div className="flex gap-2">
              <button
                onClick={envoyerTest}
                disabled={action || !titreRappel.trim() || !corpsRappel.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-dj-surface-haute px-3 py-1.5 text-xs font-bold text-dj-texte transition-colors hover:bg-dj-bordure disabled:opacity-50"
              >
                <Send size={13} />
                Tester maintenant
              </button>
              <button
                onClick={programmer}
                disabled={action || !titreRappel.trim() || !corpsRappel.trim() || !dateRappel}
                className="flex items-center gap-1.5 rounded-lg bg-dj-accent-1 px-3 py-1.5 text-xs font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
              >
                <Bell size={13} />
                Programmer
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
            <div className="flex items-center gap-2">
              <CalendarPlus size={16} className="text-dj-texte-muet" />
              <span className="text-sm font-medium text-dj-texte">Ajouter au calendrier</span>
            </div>
            <input
              value={titreEvenement}
              onChange={(e) => setTitreEvenement(e.target.value)}
              placeholder="Titre de l'événement"
              className="rounded-lg border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-accent-1"
            />
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={debutEvenement}
                onChange={(e) => setDebutEvenement(e.target.value)}
                className="flex-1 rounded-lg border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-accent-1"
              />
              <input
                type="datetime-local"
                value={finEvenement}
                onChange={(e) => setFinEvenement(e.target.value)}
                className="flex-1 rounded-lg border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-accent-1"
              />
            </div>
            <button
              onClick={creerEvenement}
              disabled={action || !titreEvenement.trim() || !debutEvenement || !finEvenement}
              className="flex w-fit items-center gap-1.5 rounded-lg bg-dj-accent-1 px-3 py-1.5 text-xs font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
            >
              <CalendarPlus size={13} />
              Ajouter
            </button>
          </div>

          <div className="flex flex-col gap-3 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
            <div className="flex items-center gap-2">
              <ExternalLink size={16} className="text-dj-texte-muet" />
              <span className="text-sm font-medium text-dj-texte">Ouvrir une app</span>
            </div>
            <p className="text-xs text-dj-texte-muet">
              Sur Android, seules les apps déclarées dans AndroidManifest.xml (bloc &lt;queries&gt;, vide pour l&apos;instant)
              peuvent être ouvertes.
            </p>
            <input
              value={nomPaquet}
              onChange={(e) => setNomPaquet(e.target.value)}
              placeholder="Nom du paquet Android (ex : com.whatsapp)"
              className="rounded-lg border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-accent-1"
            />
            <input
              value={schema}
              onChange={(e) => setSchema(e.target.value)}
              placeholder="Schéma d'URL iOS (ex : whatsapp://)"
              className="rounded-lg border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-accent-1"
            />
            <button
              onClick={ouvrirApp}
              disabled={action || (!nomPaquet.trim() && !schema.trim())}
              className="flex w-fit items-center gap-1.5 rounded-lg bg-dj-surface-haute px-3 py-1.5 text-xs font-bold text-dj-texte transition-colors hover:bg-dj-bordure disabled:opacity-50"
            >
              <ExternalLink size={13} />
              Ouvrir
            </button>
          </div>
        </>
      )}

      {confirmation && <span className="text-sm text-dj-succes">{confirmation}</span>}
      {erreur && <span className="text-sm text-[var(--dj-erreur)]">{erreur}</span>}
    </div>
  );
}
