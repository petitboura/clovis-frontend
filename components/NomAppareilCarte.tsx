"use client";

import { useEffect, useState } from "react";
import { Smartphone, Pencil, Check, X } from "lucide-react";
import { usePluginNatif, messageErreurPlugin } from "@/lib/usePluginNatif";
import { Skeleton } from "./Skeleton";

/**
 * Créé le 04/09/2026, Bourama : correction du bug "deux téléphones du
 * même compte se mélangent" (voir clovis-backend/migrations/
 * 2026_09_04_appareil_id_ciblage.sql). Affiche le libellé actuel de CET
 * appareil (modèle du téléphone par défaut, voir IdentifiantAppareil.kt/
 * .swift) et permet à l'étudiant de le personnaliser -- utile seulement
 * s'il a désigné un dossier du même nom sur plusieurs de ses téléphones,
 * l'agent lui indique alors quel libellé utiliser pour lever
 * l'ambiguïté (voir gerer_dossier_telephone côté clovis-backend).
 * Jamais obligatoire : sans personnalisation, le modèle du téléphone
 * sert déjà de libellé.
 *
 * Même pattern que MiseAJourCarte.tsx (carte autonome, gère son propre
 * état "disponible seulement sur mobile").
 */

type InfosAppareil = { appareilId: string; appareilNom: string; nomPersonnalise: boolean };

type PluginDossiersAppareil = {
  obtenirInfosAppareil(): Promise<InfosAppareil>;
  definirNomAppareil(options: { nom: string }): Promise<void>;
};

export function NomAppareilCarte() {
  const { natif, plugin } = usePluginNatif<PluginDossiersAppareil>("Dossiers");

  const [chargement, setChargement] = useState(true);
  const [infos, setInfos] = useState<InfosAppareil | null>(null);
  const [enEdition, setEnEdition] = useState(false);
  const [valeurSaisie, setValeurSaisie] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!plugin) return;
    plugin
      .obtenirInfosAppareil()
      .then((r) => setInfos(r))
      .catch((e) => setErreur(messageErreurPlugin(e)))
      .finally(() => setChargement(false));
  }, [plugin]);

  function ouvrirEdition() {
    setValeurSaisie(infos?.appareilNom ?? "");
    setErreur(null);
    setEnEdition(true);
  }

  async function enregistrer() {
    if (!plugin || !valeurSaisie.trim()) return;
    setErreur(null);
    setEnregistrement(true);
    try {
      await plugin.definirNomAppareil({ nom: valeurSaisie.trim() });
      setInfos((i) => (i ? { ...i, appareilNom: valeurSaisie.trim(), nomPersonnalise: true } : i));
      setEnEdition(false);
    } catch (e) {
      setErreur(messageErreurPlugin(e));
    } finally {
      setEnregistrement(false);
    }
  }

  if (natif === null || chargement) {
    return (
      <div className="flex flex-col gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4" aria-hidden>
        <div className="flex items-center gap-3">
          <Skeleton className="h-[18px] w-[18px] flex-shrink-0 rounded" />
          <div className="flex flex-col gap-0.5">
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-2.5 w-32 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!natif) {
    return (
      <div className="flex animate-dj-fade-in-rapide items-center gap-3 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
        <Smartphone size={18} className="flex-shrink-0 text-dj-texte-muet" />
        <span className="text-sm text-dj-texte-muet">Nom de l&apos;appareil disponible uniquement depuis l&apos;app mobile.</span>
      </div>
    );
  }

  return (
    <div className="flex animate-dj-fade-in-rapide flex-col gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Smartphone size={18} className="flex-shrink-0 text-dj-texte-muet" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-dj-texte">Nom de cet appareil</span>
            <span className="text-xs text-dj-texte-muet">
              Utile seulement si tu as désigné le même dossier sur plusieurs téléphones
            </span>
          </div>
        </div>
        {!enEdition && (
          <button
            onClick={ouvrirEdition}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-dj-bordure px-3 py-1.5 text-xs font-medium text-dj-texte transition-colors hover:bg-dj-surface-hover"
          >
            <Pencil size={13} />
            {infos?.nomPersonnalise ? infos.appareilNom : infos?.appareilNom ?? "Renommer"}
          </button>
        )}
      </div>

      {enEdition && (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={valeurSaisie}
            onChange={(e) => setValeurSaisie(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && enregistrer()}
            placeholder="Ex. Mon Android, iPhone d'Amadou"
            className="flex-1 rounded-lg border border-dj-bordure bg-transparent px-3 py-1.5 text-sm text-dj-texte outline-none focus:border-dj-accent"
          />
          <button
            onClick={enregistrer}
            disabled={enregistrement || !valeurSaisie.trim()}
            className="flex-shrink-0 rounded-lg border border-dj-bordure p-1.5 text-dj-texte transition-colors hover:bg-dj-surface-hover disabled:opacity-50"
          >
            <Check size={15} />
          </button>
          <button
            onClick={() => setEnEdition(false)}
            className="flex-shrink-0 rounded-lg border border-dj-bordure p-1.5 text-dj-texte-muet transition-colors hover:bg-dj-surface-hover"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {erreur && <p className="text-xs text-[var(--dj-erreur)]">{erreur}</p>}
    </div>
  );
}
