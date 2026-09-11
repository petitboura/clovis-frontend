import type { MetadataRoute } from "next";
import { headers } from "next/headers";

// Ajouté le 09/08 (Bourama, priorité #2 après le correctif de la barre
// latérale) : jusqu'ici BoutonInstaller.tsx et useNotificationsPush.ts
// existaient déjà côté client mais restaient totalement inertes, faute
// de manifest + service worker dans ce dépôt (voir commentaires dans
// ces deux fichiers). Next.js génère automatiquement
// /manifest.webmanifest à partir de ce fichier (App Router, aucun
// package supplémentaire) -- couplé à public/sw.js +
// ServiceWorkerRegistration.tsx pour l'installabilité.
//
// Icônes (icone-192.png, icone-512.png) régénérées le 18/08 (demande
// Bourama) : fond toujours plein (jamais transparent, cf. note du
// 17/08 plus haut) mais coins désormais arrondis (rayon ~18% du côté)
// au lieu d'un carré à angles droits.
//
// icone-192-maskable.png / icone-512-maskable.png (purpose
// "maskable", ajoutées le 18/08) : mêmes couleurs, logo resserré dans
// la zone de sécurité centrale, fond plein bord à bord SANS coins
// arrondis -- c'est volontaire, le système (Android notamment) est
// censé découper lui-même la forme finale (rond, carré arrondi,
// squircle...) selon le launcher/thème de l'appareil. On ne choisit
// pas cette forme depuis le dépôt, on donne juste au système la
// matière première pour le faire. Les navigateurs/OS qui ne
// supportent pas "maskable" retombent sur les icônes "any"
// ci-dessus (coins arrondis fixes).
//
// Refonte complète (tâche 5, chantier navigation/UI mobile) : toutes
// les tailles intermédiaires (48/72/96/128/144) regénérées à partir
// des deux mêmes masters 512x512 déjà en place (icone-512.png pour
// "any", icone-512-maskable.png pour "maskable"), au lieu de n'avoir
// que 192/512 -- couverture complète des lanceurs Android qui piochent
// la taille la plus proche de leur densité d'écran plutôt que de
// toujours redimensionner à la volée depuis la plus grande. Vérifié
// avec Maskable.app : le logo tient largement dans la zone de sécurité
// (bien en dessous du rayon de 40% recommandé), rendu correct dans
// les découpes cercle/carré arrondi/squircle testées.
// Correctif (06/09/2026, demande Bourama) : l'installation PWA (bouton
// BoutonInstaller.tsx + bannière/mini-infobar native du navigateur) est
// désactivée spécifiquement sur Android mobile -- la vraie appli native
// existe déjà pour cette plateforme (voir BoutonFlottantTelecharger.tsx,
// qui pointe vers /telecharger). PC et iOS mobile gardent le PWA
// installable (pas encore d'appli native sur iOS). "display: browser"
// disqualifie la page des critères d'installabilité Chrome -- plus de
// beforeinstallprompt, donc plus de bannière ET BoutonInstaller.tsx
// retombe naturellement à `return null` (sa condition existante :
// `!evenementInstall && !estIOS`), sans modification nécessaire côté
// composant. Volontairement laissé intact ici : public/sw.js +
// ServiceWorkerRegistration.tsx, partagés avec les notifications push
// (useNotificationsPush.ts) -- Bourama a explicitement demandé de les
// garder actives sur Android mobile malgré la désactivation du PWA.
// /Android.*Mobile/i (et non simplement /Android/i) pour ne viser que
// les téléphones -- les tablettes Android n'incluent pas le token
// "Mobile" dans leur User-Agent et gardent donc le PWA, comme le PC.
export default function manifest(): MetadataRoute.Manifest {
  // headers() est incompatible avec l'export statique (build:capacitor) :
  // son seul appel fait planter tout l'export ("couldn't be rendered
  // statically because it used headers"), constaté le 11/09/2026. Sans
  // objet de toute façon pour l'app native (ce fichier ne sert qu'au PWA
  // web) -- on saute la détection User-Agent dans ce cas précis, "browser"
  // par défaut n'a aucun effet réel côté app native.
  const estAndroidMobile =
    process.env.CAPACITOR_BUILD === "true" ? false : /Android.*Mobile/i.test(headers().get("user-agent") || "");

  return {
    id: "/",
    name: "Clovis",
    short_name: "Clovis",
    description: "Ton compagnon d'études pour la classe.",
    start_url: "/",
    scope: "/",
    display: estAndroidMobile ? "browser" : "standalone",
    background_color: "#0f0d0b",
    theme_color: "#0f0d0b",
    icons: [
      { src: "/icone-48.png", sizes: "48x48", type: "image/png", purpose: "any" },
      { src: "/icone-72.png", sizes: "72x72", type: "image/png", purpose: "any" },
      { src: "/icone-96.png", sizes: "96x96", type: "image/png", purpose: "any" },
      { src: "/icone-128.png", sizes: "128x128", type: "image/png", purpose: "any" },
      { src: "/icone-144.png", sizes: "144x144", type: "image/png", purpose: "any" },
      { src: "/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icone-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icone-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
