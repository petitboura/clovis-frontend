"use client";

import { useEffect, useState } from "react";

/**
 * 26/08/2026, Bourama : Lot 3B Partie 3 mobile : construction des interfaces
 * pour les plugins Capacitor sans UI (ControleSession, Connecteurs, MiseAJour,
 * Dossiers, Accessibilite). Chacun a besoin du même point de départ : savoir
 * si on tourne dans l'app mobile (Capacitor.isNativePlatform()) et, si oui,
 * obtenir le plugin natif enregistré : même pattern que celui déjà utilisé
 * pour PontNatif dans lib/supabase.ts, centralisé ici pour ne pas le
 * dupliquer dans chacun des 5 écrans.
 *
 * `natif` vaut `null` tant que la vérification n'est pas terminée (évite un
 * flash "indisponible" avant que Capacitor ait répondu), `false` sur le web
 * classique (Vercel), `true` dans l'app.
 *
 * Ne décide de rien sur l'emplacement de ces écrans dans la navigation :
 * chaque composant reste autonome et gère lui-même son propre état
 * "disponible seulement sur mobile", pour pouvoir être branché n'importe où
 * (web ou mobile) sans casser.
 */
export function usePluginNatif<T extends object>(nomPlugin: string) {
  const [natif, setNatif] = useState<boolean | null>(null);
  const [plugin, setPlugin] = useState<T | null>(null);

  useEffect(() => {
    let annule = false;
    import("@capacitor/core").then(({ Capacitor, registerPlugin }) => {
      if (annule) return;
      const estNatif = Capacitor.isNativePlatform();
      setNatif(estNatif);
      if (estNatif) {
        setPlugin(registerPlugin<T>(nomPlugin));
      }
    });
    return () => {
      annule = true;
    };
  }, [nomPlugin]);

  return { natif, plugin };
}

/** Les rejets de plugins Capacitor sont de simples messages (pas de code
 * d'erreur stable comme lib/erreurs.ts côté API clovis-backend) : petit
 * helper pour ne pas répéter ce `instanceof Error` partout. */
export function messageErreurPlugin(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return "Une erreur est survenue.";
}
