"use client";

import { useEffect, useState } from "react";

/**
 * Correctif du 31/08/2026 (Bourama : bug remonté sur Connexion/Inscription,
 * étendu après audit à TOUS les écrans hors AppShell.tsx -- "cherche bien
 * y en a tant d'autre").
 *
 * Toutes les pages qui passent par AppShell.tsx reçoivent automatiquement
 * une marge en haut et en bas pour ne pas se faire recouvrir par la barre
 * de statut / la barre système du téléphone (voir <main> dans AppShell.tsx).
 * Mais 5 écrans sont volontairement en dehors d'AppShell (pas de nav dessus
 * : connexion, inscription, cgu, copyright, consentement OAuth) et n'ont
 * donc jamais reçu ce traitement -- sur l'appli native (edge-to-edge
 * obligatoire dès Android 15/API 35, cible actuelle API 36), la barre
 * système du bas notamment pouvait recouvrir du texte et des boutons.
 *
 * Reprend exactement la même logique qu'AppShell.tsx (même détection
 * Capacitor.isNativePlatform(), mêmes variables CSS) plutôt que d'en
 * inventer une nouvelle : natif -> --cap-native-navigation-top/bottom
 * (source de vérité pour le layout strictement natif, voir
 * app/globals.css) ; web -> --safe-top/--safe-bottom (encoche/île
 * dynamique ou barre de gestes du navigateur/PWA). Pas de
 * --dj-barre-onglets-web ici : ces 5 écrans n'affichent jamais la barre
 * d'onglets, donc rien à réserver pour elle.
 *
 * `natif` reste `false` par défaut le temps que Capacitor réponde --
 * comme AppShell.tsx, pour ne pas faire clignoter la mise en page web au
 * tout premier rendu dans l'appli.
 */
export function EcranAutonome({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const [natif, setNatif] = useState(false);

  useEffect(() => {
    let annule = false;
    import("@capacitor/core").then(({ Capacitor }) => {
      if (!annule) setNatif(Capacitor.isNativePlatform());
    });
    return () => {
      annule = true;
    };
  }, []);

  return (
    <main
      className={className}
      style={
        natif
          ? {
              paddingTop: "var(--cap-native-navigation-top, 0px)",
              paddingBottom: "var(--cap-native-navigation-bottom, 0px)",
            }
          : {
              paddingTop: "var(--safe-top)",
              paddingBottom: "var(--safe-bottom)",
            }
      }
    >
      {children}
    </main>
  );
}
