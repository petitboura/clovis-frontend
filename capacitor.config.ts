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
};

export default config;
