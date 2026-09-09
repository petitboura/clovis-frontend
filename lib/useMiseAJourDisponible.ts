"use client";

import { useEffect, useState } from "react";
import { usePluginNatif } from "./usePluginNatif";

/**
 * Créé le 09/09/2026, demande Bourama : signal partagé "une mise à jour
 * est disponible", utilisé par le bandeau d'accueil (BandeauMiseAJour.tsx)
 * et les points rouges (icône Paramètres dans EspacePlus.tsx, icône
 * Profil dans AppSidebar.tsx). Ne remplace PAS MiseAJourCarte.tsx (Espace
 * Paramètres), qui garde sa propre vérification indépendante avec son
 * bouton "Vérifier" manuel -- volontairement laissée telle quelle.
 *
 * Même principe de petit store partagé que useNotificationsPush.ts :
 * une seule vérification réseau (GitHub) par ouverture d'app, partagée
 * entre tous les endroits qui affichent ce signal, plutôt qu'un appel
 * par composant affiché à l'écran.
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

let infoPartagee: InfoMiseAJour | null = null;
let verificationLancee = false;
const abonnes = new Set<() => void>();

function notifierAbonnes() {
  abonnes.forEach((f) => f());
}

export function useMiseAJourDisponible() {
  const { plugin } = usePluginNatif<PluginMiseAJour>("MiseAJour");
  const [, forcerRafraichissement] = useState(0);

  useEffect(() => {
    const f = () => forcerRafraichissement((t) => t + 1);
    abonnes.add(f);
    return () => {
      abonnes.delete(f);
    };
  }, []);

  useEffect(() => {
    if (!plugin || verificationLancee) return;
    verificationLancee = true;
    plugin
      .disponible()
      .then((r) => (r.disponible ? plugin.verifier() : null))
      .then((r) => {
        infoPartagee = r;
        notifierAbonnes();
      })
      .catch(() => {
        // Pas de connexion ou API indisponible : jamais bloquant, pas de
        // signal affiché, même logique que MiseAJourCarte.tsx.
        infoPartagee = null;
        notifierAbonnes();
      });
  }, [plugin]);

  async function telecharger() {
    if (!plugin || !infoPartagee?.urlTelechargement) return;
    await plugin.ouvrirTelechargement({ urlTelechargement: infoPartagee.urlTelechargement });
  }

  return {
    misAJourDisponible: infoPartagee?.misAJourDisponible === true,
    version: infoPartagee?.version,
    telecharger,
  };
}
