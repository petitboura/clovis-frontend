// Cree le 25/08/2026, Bourama : Lot 3A Partie 3 mobile (fusion Capacitor).
//
// webDir "out" : dossier genere par `npm run build:capacitor` (export
// statique conditionnel, voir next.config.mjs -- CAPACITOR_BUILD=true).
// PAS de bloc `server` ici : volontairement pas de wrapping via
// server.url (charger le site distant en direct dans la WebView) --
// voir next.config.mjs pour le detail de ce choix et les recherches qui
// l'ont motive (25/08/2026).
//
// appId reutilise tel quel : c'est le meme identifiant que le socle
// natif deja existant (clovis-mobile/android, applicationId
// "com.clovis.app") -- meme app aux yeux du Play Store, pas une nouvelle
// fiche/signature a recreer.
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.clovis.app",
  appName: "Clovis",
  webDir: "out",
  // Tache 4 (30/08/2026, zones de securite) : "css" est deja la valeur
  // par defaut du plugin System Bars (bundle dans @capacitor/core depuis
  // Capacitor 8), mais on la fixe explicitement ici plutot que de
  // dependre d'un defaut qui pourrait changer plus tard -- c'est ce
  // parametre qui fait que Capacitor injecte --safe-area-inset-* en CSS
  // (voir app/globals.css, --safe-top/--safe-bottom), indispensable sur
  // Android 15+/API 35+ (edge to edge obligatoire, cible actuelle du
  // projet : API 36).
  plugins: {
    SystemBars: {
      insetsHandling: "css",
    },
  },
};

export default config;
