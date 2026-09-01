"use client";

import { useContext, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ContexteChat, useOuvrirChat } from "@/lib/contexteChat";
import { useTheme } from "@/lib/useTheme";

// Cree le 26/08/2026, Bourama : refonte navigation mobile (chantier
// "vraie appli mobile", suite Lot 3A/3B fusion Capacitor).
//
// Remplace le menu hamburger + tiroir (AppSidebar en mode mobile) par une
// vraie barre d'onglets systeme, via @capgo/capacitor-native-navigation
// (option A validee par Bourama, pas une barre CSS qui imite le natif --
// voir echange 26/08). Ne fait strictement rien sur le web : le hook
// isNativePlatform() coupe tout court-circuit avant le moindre appel au
// plugin, donc AppSidebar reste inchangee pour le site/desktop.
//
// API du plugin verifiee sur la doc officielle (capgo.app/docs/plugins/
// native-navigation/getting-started) avant d'ecrire ce fichier -- configure()
// puis setTabbar({ selectedId, tabs }) puis addListener('tabSelect', ...).
// Pas de methode "selectTab" separee : pour changer l'onglet actif on
// rappelle setTabbar avec le meme tableau de tabs et un nouveau selectedId.
//
// Structure des 4 onglets, validee avec Bourama le 26/08, puis mise a jour
// le 30/08/2026 (tache 1 chantier nav mobile) : Bibliotheque,
// ControleSession (route /controle-session, ecran Concentration,
// EspaceConcentration.tsx, deja construit et fonctionnel, pas un
// placeholder ; commentaire corrige le 30/08/2026, audit navigation
// etape 2, l'ancienne mention "pas encore construit" etait perimee),
// Chat (ouvre ChatFlottant, PAS une route --
// le chat n'a jamais ete une page a part), Personnaliser Clovis (route
// /personnaliser, remplace l'ancien onglet Plus -- le contenu de /plus
// n'est pas supprime, il devient accessible via le menu hamburger a la
// tache 2 du meme chantier).
//
// IMPORTANT : ce fichier suppose que @capgo/capacitor-native-navigation
// est installe (voir package.json) et que `npx cap sync` a ete relance --
// impossible a verifier depuis ce sandbox (pas d'Android Studio/Xcode ici,
// meme avertissement que clovis-mobile/README.md). A tester sur appareil
// reel avant de considerer ce chantier termine.
//
// 30/08/2026, tache 2 partie B (Bourama) : masquer la barre native
// pendant le chat plein ecran (ChatFlottant.tsx, etat "plein_ecran"),
// pour la meme raison que la barre web est deja recouverte par son
// z-[110] -- la barre native, elle, est hors de la webview, le z-index
// du chat n'a aucune prise dessus. API verifiee dans les types du
// plugin installe (package.json : ^8.3.1, verifie via node_modules/
// @capgo/capacitor-native-navigation/dist/esm/definitions.d.ts) : pas
// de methode hide()/show() separee, setTabbar accepte un champ booleen
// `hidden` directement dans NativeNavigationTabbarOptions -- reappele
// avec le meme tableau de tabs/couleurs/selectedId a chaque fois (voir
// commentaire plus bas sur l'absence de "selectTab"), donc fusionne ici
// dans le meme effet que la synchronisation d'onglet actif plutot qu'un
// effet separe, pour eviter deux appels concurrents qui pourraient se
// doubler et scintiller.

// Icones en SVG brut (contrainte du plugin : doivent etre serialisables,
// un composant Lucide ne peut pas etre envoye au natif tel quel) --
// traits simples coherents avec le style Lucide deja utilise ailleurs
// dans l'app (stroke=currentColor, stroke-width=2).
const ICONES_SVG: Record<string, string> = {
  bibliotheque:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  controleSession:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22"/><path d="M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
  notes:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13.4 2.6a2.1 2.1 0 1 1 3 3L7 15l-4 1 1-4Z"/><path d="M3 22h18"/></svg>',
  // Repris de l'icone Lucide Wand2 (v0.383.0, deja utilisee pour
  // "Personnaliser Clovis" dans AppSidebar.tsx et EspacePlus.tsx -- meme
  // convention visuelle reprise ici plutot qu'une nouvelle icone inventee,
  // voir echange avec Bourama du 30/08/2026, tache 1 chantier nav mobile).
  // Wand2 resout en interne vers le trace "WandSparkles" dans cette
  // version de la lib (verifie dans node_modules), donc les traits ci
  // dessous sont copies a l'identique de ce trace, pas approximes.
  personnaliser:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg>',
  // Repris de l'icone Lucide Briefcase (deja utilisee pour "Bureau" dans
  // BarreOngletsWeb.tsx et l'ancien EspacePlus.tsx), meme convention
  // visuelle que "personnaliser" ci-dessus (icone Lucide existante
  // recopiee, pas inventee) -- Partie 1 navigation mobile, 29-30/08/2026.
  bureau:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect x="2" y="6" width="20" height="14" rx="2"/></svg>',
};

// Partie 1 navigation mobile (29-30/08/2026) : ajoute Bureau comme 5e
// onglet direct (jusque-la seulement accessible via le menu hamburger,
// voir EspacePlus.tsx/MenuHamburgerNatif.tsx) -- ne retire rien de la
// tache 1 du 30/08 (Personnaliser Clovis reste un onglet direct, le
// hamburger reste en place pour Connecter Claude/Parametres). Chat
// reste au centre exact (3e sur 5), Bureau juste a cote (4e), les deux
// dans la zone la plus atteignable au pouce -- voir audit UX mobile
// 29/08/2026, partie 2.3.
const ONGLETS_NATIFS = [
  { id: "bibliotheque", titre: "Bibliothèque", route: "/bibliotheque", icone: ICONES_SVG.bibliotheque },
  { id: "controle-session", titre: "Concentration", route: "/controle-session", icone: ICONES_SVG.controleSession },
  { id: "chat", titre: "Chat", route: null, icone: ICONES_SVG.chat },
  { id: "bureau", titre: "Bureau", route: "/bureau", icone: ICONES_SVG.bureau },
  { id: "personnaliser", titre: "Personnaliser Clovis", route: "/personnaliser", icone: ICONES_SVG.personnaliser },
] as const;

// Correctif (26/08/2026, retour "couleurs et icônes qui n'ont rien à voir
// avec le notre") : setTabbar/configure n'imposaient aucune couleur,
// le plugin retombe alors sur les teintes système par défaut (bleu
// Material sur Android), qui n'ont jamais correspondu à l'identité
// "Nuit d'étude" de Clovis. Valeurs reprises À L'IDENTIQUE des variables
// CSS déjà en place (voir app/globals.css, --dj-fond/--dj-accent-1/
// --dj-texte-muet, thèmes clair et sombre), pas de nouvelle couleur
// inventée, juste la même palette appliquée à la barre native.
const COULEURS_THEME: Record<"clair" | "sombre", { fond: string; accent: string; muet: string }> = {
  clair: { fond: "#faf8f5", accent: "#b8860b", muet: "#6b675e" },
  sombre: { fond: "#0f0d0b", accent: "#e8bf60", muet: "#9a9184" },
};

// 01/09/2026, correctif (Bourama : "barre toujours noire meme en changeant
// de theme") : dynamic n'etait jamais precise. Sur Android 12+, ce champ
// laisse "non specifie" peut faire deriver les couleurs non couvertes
// explicitement depuis la palette systeme Material You (souvent sombre),
// meme quand background/tint/inactiveTint sont bien fournis. dynamic:false
// force le plugin a n'utiliser que nos couleurs explicites, jamais la
// palette systeme.
function couleursTabbar(resolu: "clair" | "sombre") {
  const c = COULEURS_THEME[resolu];
  return { dynamic: false, background: c.fond, tint: c.accent, inactiveTint: c.muet };
}

function definitionOnglets() {
  return ONGLETS_NATIFS.map((o) => ({ id: o.id, title: o.titre, icon: { svg: o.icone } }));
}

export function BarreOngletsNative() {
  const router = useRouter();
  const pathname = usePathname();
  const ouvrirChat = useOuvrirChat();
  const { resolu } = useTheme();
  // Tache 2 partie B (30/08/2026) : etat du chat, deja porte par
  // ContexteChat (voir lib/contexteChat.tsx, remonte dans AppShell.tsx).
  // Pas de hook dedie expose pour LIRE l'etat (seulement useOuvrirChat,
  // qui ne fait que l'ouvrir) -- le contexte est exporte, donc lu ici
  // directement plutot que d'ajouter un hook pour un seul appelant.
  const ctxChat = useContext(ContexteChat);
  const etatChat = ctxChat?.etat ?? "fermee";
  // Tache 2 partie B : avant cette tache, l'effet de sync ignorait
  // purement et simplement les routes qui ne correspondent a aucun
  // onglet (`if (actif)` -- ex. /connecter-claude, /bureau, /parametres,
  // atteintes uniquement depuis l'ancien onglet Plus). Le plugin garde
  // alors tout seul le dernier selectedId connu, jamais reinitialise a
  // "bibliotheque". Depuis cette tache, l'effet doit AUSSI tourner sur
  // ces routes-la pour mettre a jour `hidden` quand le chat change
  // d'etat -- ce ref reproduit donc le meme comportement de memoire que
  // le plugin assurait implicitement avant, plutot que de forcer
  // "bibliotheque" a chaque fois.
  const dernierOngletRef = useRef("bibliotheque");
  // Ref pour eviter de reconfigurer le plugin a chaque changement de route
  // (montage unique) tout en gardant acces a la derniere version de
  // router/ouvrirChat dans le listener 'tabSelect'.
  const gestionnaireRef = useRef({ router, ouvrirChat });
  gestionnaireRef.current = { router, ouvrirChat };
  // Meme logique pour resolu (theme) : lu par l'effet de synchronisation
  // de couleurs ci-dessous (pathname), pas par l'effet de montage.
  const resoluRef = useRef(resolu);
  resoluRef.current = resolu;

  useEffect(() => {
    let annule = false;
    let nettoyerEcoute: (() => void) | undefined;

    import("@capacitor/core").then(async ({ Capacitor }) => {
      if (annule || !Capacitor.isNativePlatform()) return;

      try {
        const { NativeNavigation } = await import("@capgo/capacitor-native-navigation");

        await NativeNavigation.configure({ contentInsetMode: "css", colors: couleursTabbar(resoluRef.current) });
        await NativeNavigation.setTabbar({
          hidden: false,
          selectedId: "bibliotheque",
          labelVisibilityMode: "labeled",
          icons: true,
          colors: couleursTabbar(resoluRef.current),
          tabs: definitionOnglets(),
        });

        const abonnement = await NativeNavigation.addListener("tabSelect", ({ id }: { id: string }) => {
          const { router, ouvrirChat } = gestionnaireRef.current;
          const onglet = ONGLETS_NATIFS.find((o) => o.id === id);
          if (!onglet) return;
          if (onglet.id === "chat") {
            ouvrirChat("plein_ecran");
            return;
          }
          if (onglet.route) router.push(onglet.route);
        });
        nettoyerEcoute = () => abonnement.remove();
      } catch (e) {
        // Correctif (31/08/2026, Bourama : "l'appli deborde du haut") :
        // avant, une erreur ici (ex. plugin pas encore synchronise cote
        // Android, voir android/capacitor.settings.gradle) disparaissait
        // silencieusement -- configure()/setTabbar() echouaient, aucune
        // des deux CSS var (--cap-native-navigation-top/bottom) n'etait
        // jamais posee, et rien ne le signalait. AppShell.tsx a maintenant
        // un repli sur --safe-top/--safe-bottom pour ce cas (voir son
        // commentaire), mais ce console.error reste necessaire pour
        // qu'un echec futur soit visible au lieu de redevenir invisible.
        console.error("BarreOngletsNative : echec de configuration de la barre native", e);
      }
    });

    return () => {
      annule = true;
      nettoyerEcoute?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- montage unique volontaire, voir gestionnaireRef ci-dessus
  }, []);

  // Synchronise l'onglet visuellement actif avec la route affichee (ex :
  // ouvrir Bibliotheque depuis "Personnaliser Clovis" doit aussi mettre a
  // jour la barre), ET masque/affiche la barre selon l'etat du chat
  // (tache 2 partie B, 30/08/2026 : plein_ecran doit la faire disparaitre,
  // mini/fermee doit la faire revenir). Un seul effet pour les deux --
  // dans les deux cas on rappelle setTabbar avec le meme tableau complet
  // (tabs, couleurs, selectedId), voir le commentaire d'en-tete sur
  // l'absence de "selectTab" et de "hide"/"show" dedies. Les fusionner
  // evite que le retour de plein_ecran (qui touche `hidden`) et un
  // changement de route simultane (qui touche `selectedId`) ne se
  // percutent en deux appels setTabbar concurrents, potentiellement
  // desynchronises. Depend aussi de `resolu` (26/08/2026, correctif
  // couleurs) : bascule clair/sombre doit recolorer la barre native en
  // direct.
  useEffect(() => {
    import("@capacitor/core").then(async ({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) return;
      const { NativeNavigation } = await import("@capgo/capacitor-native-navigation");
      const actif = ONGLETS_NATIFS.find((o) => o.route && pathname.startsWith(o.route));
      if (actif) dernierOngletRef.current = actif.id;
      await NativeNavigation.setTabbar({
        hidden: etatChat === "plein_ecran",
        selectedId: dernierOngletRef.current,
        labelVisibilityMode: "labeled",
        icons: true,
        colors: couleursTabbar(resolu),
        tabs: definitionOnglets(),
      });
    });
  }, [pathname, resolu, etatChat]);

  return null;
}
