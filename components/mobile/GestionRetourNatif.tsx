"use client";

import { useContext, useEffect } from "react";
import { ContexteRetour } from "@/lib/contexteRetour";

// Créé le 31/08/2026, Bourama : "peu importe où t'es le bouton retour
// ferme l'appli".
//
// Aucun listener 'backButton' n'existait nulle part dans le projet, et
// @capacitor/app (le plugin qui permet de l'intercepter) n'était même pas
// installé (voir package.json) -- le bouton retour matériel Android
// suivait donc le comportement par défaut de la WebView, qui n'a jamais
// été branché sur la navigation de l'app.
//
// API vérifiée sur le package @capacitor/app 8.1.1 (npm) avant d'écrire ce
// fichier : addListener('backButton', ...) fournit `canGoBack` (true si la
// WebView a un historique de navigation, ex. après un router.push comme
// dans BarreOngletsNative.tsx/BarreOngletsWeb.tsx). Comme documenté par le
// plugin lui-même : écouter cet évènement désactive le comportement par
// défaut, donc c'est à nous de rappeler window.history.back() ou
// App.exitApp() selon le cas -- exactement l'exemple officiel de la doc.
//
// Portée volontairement minimale (demande explicite de Bourama, 3
// correctifs précis) : ne ferme PAS en premier les panneaux/popups
// ouverts (MenuHamburgerNatif, ChatFlottant plein_ecran, etc.) avant de
// naviguer en arrière -- seulement le routage. À signaler si Bourama veut
// ce comportement en plus.
//
// Ne fait rien sur le web (le hook coupe court avant tout appel au
// plugin, même pattern que lib/usePluginNatif.ts) : le bouton "retour" du
// navigateur web mobile suit déjà l'historique normalement.
// Portée (31/08/2026, mise à jour -- Bourama : "bien sûr qu'il ferme
// d'abord ce que l'utilisateur voit ou retourne en arrière") : interroge
// D'ABORD lib/contexteRetour.tsx (panneaux, popups, fenêtres flottantes,
// chat plein écran empilés là pendant qu'ils sont visibles) -- seulement
// si rien n'y est empilé, on retombe sur canGoBack/exitApp ci-dessous.
export function GestionRetourNatif() {
  const retour = useContext(ContexteRetour);

  useEffect(() => {
    let annule = false;
    let nettoyer: (() => void) | undefined;

    import("@capacitor/core")
      .then(async ({ Capacitor }) => {
        if (annule || !Capacitor.isNativePlatform()) return;

        const { App } = await import("@capacitor/app");
        const abonnement = await App.addListener("backButton", ({ canGoBack }) => {
          if (retour?.intercepter()) return;
          if (canGoBack) {
            window.history.back();
          } else {
            App.exitApp();
          }
        });
        if (annule) {
          abonnement.remove();
          return;
        }
        nettoyer = () => abonnement.remove();
      })
      .catch((e) => {
        console.error("GestionRetourNatif : échec de l'abonnement au bouton retour", e);
      });

    return () => {
      annule = true;
      nettoyer?.();
    };
  }, [retour]);

  return null;
}
