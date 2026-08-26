"use client";

import { useEffect, useState } from "react";
import { Link2, Smartphone } from "lucide-react";
import { usePluginNatif, messageErreurPlugin } from "@/lib/usePluginNatif";
import { Skeleton } from "./Skeleton";

/**
 * Carte autonome pour le plugin natif Connecteurs (Lot 3B Partie 3 mobile,
 * 25/08/2026 : voir android/.../connecteurs/ConnecteursPlugin.kt). Un seul
 * connecteur exposé pour l'instant (Notion). Composant construit le
 * 26/08/2026, groupe "Capacités du téléphone" : carte simple (statut +
 * bouton), pas un écran à part, à la demande de Bourama.
 *
 * Le plugin n'expose AUCUNE méthode de déconnexion (seulement statutNotion/
 * demarrerConnexionNotion/finaliserConnexionNotion/rechercherNotion) : pas
 * de bouton "Déconnecter" ici, ce serait inventer une capacité qui n'existe
 * pas côté natif. À signaler à Bourama si besoin plus tard.
 *
 * rechercherNotion() n'a pas sa place ici : c'est un outil que l'agent
 * utilise lui-même une fois connecté, pas une action que l'utilisateur
 * déclenche depuis cette carte.
 *
 * Pas de mécanisme i18n branché (voir EspaceParametres.tsx) : textes en
 * dur en français.
 */

type PluginConnecteurs = {
  statutNotion(): Promise<{ connecte: boolean }>;
  demarrerConnexionNotion(): Promise<void>;
  finaliserConnexionNotion(options: { code: string; state: string }): Promise<{ connecte: boolean; espace: string }>;
  addListener(
    eventName: "retourOAuth",
    listener: (data: { code: string; state: string }) => void
  ): Promise<{ remove: () => void }>;
};

export function ConnecteurNotionCarte() {
  const { natif, plugin } = usePluginNatif<PluginConnecteurs>("Connecteurs");

  const [chargement, setChargement] = useState(true);
  const [connecte, setConnecte] = useState(false);
  const [espace, setEspace] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!plugin) return;
    plugin
      .statutNotion()
      .then((r) => setConnecte(r.connecte))
      .catch((e) => setErreur(messageErreurPlugin(e)))
      .finally(() => setChargement(false));
  }, [plugin]);

  // Une fois le Custom Tabs OAuth refermé, l'app reçoit l'événement
  // `retourOAuth` (code + state) : c'est à cet écran de finaliser la
  // connexion, le plugin se contente de relayer l'événement (voir
  // commentaire de ConnecteursPlugin.kt : "pas de décider la logique").
  useEffect(() => {
    if (!plugin) return;
    let handle: { remove: () => void } | null = null;
    plugin
      .addListener("retourOAuth", ({ code, state }) => {
        setEnCours(true);
        setErreur(null);
        plugin
          .finaliserConnexionNotion({ code, state })
          .then((r) => {
            setConnecte(r.connecte);
            setEspace(r.espace);
          })
          .catch((e) => setErreur(messageErreurPlugin(e)))
          .finally(() => setEnCours(false));
      })
      .then((h) => {
        handle = h;
      });
    return () => handle?.remove();
  }, [plugin]);

  async function connecter() {
    if (!plugin) return;
    setErreur(null);
    setEnCours(true);
    try {
      await plugin.demarrerConnexionNotion();
      // La suite se passe dans le listener `retourOAuth` ci-dessus, une fois
      // l'utilisateur revenu du Custom Tabs : `enCours` reste à true
      // jusque-là volontairement, pour ne pas laisser croire que rien ne
      // se passe pendant que le navigateur système est ouvert.
    } catch (e) {
      setErreur(messageErreurPlugin(e));
      setEnCours(false);
    }
  }

  if (natif === null || chargement) {
    return <Skeleton className="h-16 rounded-cgpt-carte" />;
  }

  if (!natif) {
    return (
      <div className="flex animate-dj-fade-in-rapide items-center gap-3 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
        <Smartphone size={18} className="flex-shrink-0 text-dj-texte-muet" />
        <span className="text-sm text-dj-texte-muet">Connecteurs disponible uniquement depuis l&apos;app mobile.</span>
      </div>
    );
  }

  return (
    <div className="flex animate-dj-fade-in-rapide flex-col gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link2 size={18} className="flex-shrink-0 text-dj-texte-muet" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-dj-texte">Notion</span>
            <span className="text-xs text-dj-texte-muet">
              {connecte ? (espace ? `Connecté (${espace})` : "Connecté") : "Non connecté"}
            </span>
          </div>
        </div>
        {!connecte && (
          <button
            onClick={connecter}
            disabled={enCours}
            className="flex-shrink-0 rounded-lg bg-dj-accent-1 px-3 py-1.5 text-xs font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
          >
            {enCours ? "Connexion…" : "Connecter"}
          </button>
        )}
      </div>
      {erreur && <span className="text-xs text-[var(--dj-erreur)]">{erreur}</span>}
    </div>
  );
}
