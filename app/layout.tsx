import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Work_Sans, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";
// KaTeX/MathLive (rendu de formules dans BulleMessage.tsx et
// EditeurMathsRiche.tsx) : dans djiguigne-frontend ce CSS est scopé à la
// seule route /agent/[id]/chat (audit vitesse du 01/08, voir globals.css).
// Ici l'app entière EST le chat (pas de vitrine/blog à alléger), donc pas
// besoin de ce découpage par route — chargé une fois au niveau racine.
import "katex/dist/katex.min.css";
import "mathlive/fonts.css";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { ReveilBackend } from "@/components/ReveilBackend";
import { SplashOuverture } from "@/components/SplashOuverture";
import { SplashPret } from "@/components/SplashPret";

// CORRECTIF (17/08) -- Bourama a demandé de sortir de la charte
// Djiguignè (jugée trop générique "IA" -- palette + paire de polices
// Bricolage Grotesque/Inter, devenue elle-même un choix par défaut des
// produits IA/SaaS actuels) au profit d'une identité propre à Clovis :
// Space Grotesk (titres/UI) + Work Sans (texte courant). Portée CLOVIS
// UNIQUEMENT -- djiguigne-frontend garde Bricolage Grotesque/Inter,
// ce fichier n'est donc plus dérivé à l'identique de son homologue.
//
// Volontairement ABSENT ici : SessionSyncVitrine (synchronisation de
// session avec djiguigne-ai.vercel.app). Clovis ne doit jamais
// laisser transparaître l'existence de l'écosystème Djiguignè (brief
// section 1) — inclure ce composant romprait ce principe dès le layout
// racine, avant même la moindre page.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-work-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// Police serif éditoriale pour le corps des réponses de l'IA uniquement
// (09/08, demande Bourama : "façon Claude" pour le texte des réponses --
// pas pour les titres, qui restent en display, juste agrandis). Non
// concernée par le changement de palette/typo UI du 17/08 (Space
// Grotesk/Work Sans) -- reste Source Serif 4, partagée avec
// djiguigne-frontend pour ce seul élément.
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-lecture",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: "Clovis",
  description: "Ton compagnon d'études pour la classe.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Clovis" },
  // Aperçu de lien (WhatsApp, Messenger, iMessage, etc.) -- ajouté le 24/08
  // (demande Bourama : le lien de l'appli n'affichait aucun aperçu, faute de
  // ces métadonnées). L'image elle-même vient de app/opengraph-image.png,
  // convention native du App Router (Next.js génère automatiquement les
  // balises <meta property="og:image">/<meta name="twitter:image"> à partir
  // de ce fichier, URL absolue calculée via metadataBase ci-dessus -- aucune
  // URL en dur ici).
  openGraph: {
    title: "Clovis",
    description: "Ton compagnon d'études pour la classe.",
    siteName: "Clovis",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Clovis",
    description: "Ton compagnon d'études pour la classe.",
  },
  // Icône d'onglet (favicon) et icône iOS "ajouter à l'écran d'accueil"
  // (12/08) : désormais générées automatiquement par Next.js depuis
  // app/icon.png et app/apple-icon.png (convention native du App
  // Router, aucune config ici nécessaire). Avant ça, ni djiguigne-
  // frontend ni ce dépôt n'avaient de vrai favicon -- seule l'icône
  // PWA (manifest) était branchée, ce qui laissait un onglet
  // navigateur sans icône. La ligne `icons: { apple: ... }` qui
  // pointait vers icone-192.png est retirée : app/apple-icon.png fait
  // maintenant ce travail nativement, la garder aurait dupliqué la
  // balise <link rel="apple-touch-icon">.
};

export default function RacineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fr"
      // suppressHydrationWarning : le script ci-dessous modifie l'attribut
      // data-theme de <html> AVANT l'hydratation React (lecture directe du
      // DOM, hors du cycle React) -- sans ça, React comparerait le HTML
      // envoyé par le serveur (sans data-theme) à celui du navigateur
      // (avec data-theme posé par le script) et log un avertissement
      // d'hydratation à chaque chargement, alors que c'est volontaire.
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${workSans.variable} ${jetbrainsMono.variable} ${sourceSerif.variable}`}
    >
      <head>
        {/* Script anti-flash (17/08, thème clair/sombre) : doit s'exécuter
            de façon SYNCHRONE avant le premier rendu de <body>, sinon
            l'utilisateur voit une fraction de seconde du thème par défaut
            (clair, valeurs de base de :root) avant que React ne se monte
            et applique le bon thème -- particulièrement visible en sombre
            (flash blanc). Lecture directe de localStorage + matchMedia,
            volontairement hors de React (trop tôt dans le cycle de vie
            pour qu'un hook s'en charge). Doit rester IDENTIQUE à la
            logique de lib/useTheme.ts (clé de stockage, valeurs). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("clovis-theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-dj-fond font-sans text-dj-texte antialiased">
        {/* Écran d'ouverture (25/08, demande Bourama) -- voir
            SplashOuverture.tsx pour le pourquoi du composant serveur.
            Le script qui suit fait disparaître #clovis-splash quand
            l'app signale qu'elle est prête (événement "clovis:pret",
            déclenché par SplashPret.tsx plus bas une fois React monté),
            ou au bout de 4s en filet de sécurité si ce signal tarde
            (connexion lente) -- ne doit jamais bloquer indéfiniment
            l'accès à l'appli (standards-dev #9). Doit rester APRÈS le
            <div id="clovis-splash"> dans le HTML pour le trouver dans
            le DOM au moment où il s'exécute. */}
        <SplashOuverture />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var el=document.getElementById("clovis-splash");if(!el)return;var parti=false;function partir(){if(parti)return;parti=true;el.classList.add("clovis-splash-sortie");el.addEventListener("transitionend",function(){if(el.parentNode)el.parentNode.removeChild(el);},{once:true});}document.addEventListener("clovis:pret",partir,{once:true});setTimeout(partir,4000);}catch(e){}})();`,
          }}
        />
        <ServiceWorkerRegistration />
        <ReveilBackend />
        {children}
        <SplashPret />
      </body>
    </html>
  );
}
