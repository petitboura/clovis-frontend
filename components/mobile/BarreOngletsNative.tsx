"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useOuvrirChat } from "@/lib/contexteChat";

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
// Structure des 5 onglets, validee avec Bourama le 26/08 :
// Bibliotheque, ControleSession (placeholder "bientot disponible", ecran
// pas encore construit -- Lot 4 mobile), Chat (ouvre ChatFlottant, PAS une
// route -- le chat n'a jamais ete une page a part), Notes, Plus (nouvelle
// page /plus, liste groupee des sections restantes).
//
// IMPORTANT : ce fichier suppose que @capgo/capacitor-native-navigation
// est installe (voir package.json) et que `npx cap sync` a ete relance --
// impossible a verifier depuis ce sandbox (pas d'Android Studio/Xcode ici,
// meme avertissement que clovis-mobile/README.md). A tester sur appareil
// reel avant de considerer ce chantier termine.

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
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>',
};

const ONGLETS_NATIFS = [
  { id: "bibliotheque", titre: "Bibliothèque", route: "/bibliotheque", icone: ICONES_SVG.bibliotheque },
  { id: "controle-session", titre: "Session", route: "/controle-session", icone: ICONES_SVG.controleSession },
  { id: "chat", titre: "Chat", route: null, icone: ICONES_SVG.chat },
  { id: "notes", titre: "Notes", route: "/notes", icone: ICONES_SVG.notes },
  { id: "plus", titre: "Plus", route: "/plus", icone: ICONES_SVG.plus },
] as const;

function definitionOnglets() {
  return ONGLETS_NATIFS.map((o) => ({ id: o.id, title: o.titre, icon: { svg: o.icone } }));
}

export function BarreOngletsNative() {
  const router = useRouter();
  const pathname = usePathname();
  const ouvrirChat = useOuvrirChat();
  // Ref pour eviter de reconfigurer le plugin a chaque changement de route
  // (montage unique) tout en gardant acces a la derniere version de
  // router/ouvrirChat dans le listener 'tabSelect'.
  const gestionnaireRef = useRef({ router, ouvrirChat });
  gestionnaireRef.current = { router, ouvrirChat };

  useEffect(() => {
    let annule = false;
    let nettoyerEcoute: (() => void) | undefined;

    import("@capacitor/core").then(async ({ Capacitor }) => {
      if (annule || !Capacitor.isNativePlatform()) return;

      const { NativeNavigation } = await import("@capgo/capacitor-native-navigation");

      await NativeNavigation.configure({ contentInsetMode: "css" });
      await NativeNavigation.setTabbar({
        selectedId: "bibliotheque",
        labelVisibilityMode: "labeled",
        icons: true,
        tabs: definitionOnglets(),
      });

      const abonnement = await NativeNavigation.addListener("tabSelect", ({ id }: { id: string }) => {
        const { router, ouvrirChat } = gestionnaireRef.current;
        const onglet = ONGLETS_NATIFS.find((o) => o.id === id);
        if (!onglet) return;
        if (onglet.id === "chat") {
          ouvrirChat();
          return;
        }
        if (onglet.route) router.push(onglet.route);
      });
      nettoyerEcoute = () => abonnement.remove();
    });

    return () => {
      annule = true;
      nettoyerEcoute?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- montage unique volontaire, voir gestionnaireRef ci-dessus
  }, []);

  // Synchronise l'onglet visuellement actif avec la route affichee (ex :
  // ouvrir Bibliotheque depuis "Plus" doit aussi mettre a jour la barre).
  // Pas de methode dediee cote plugin : on rappelle setTabbar avec le
  // meme tableau de tabs, juste un nouveau selectedId.
  useEffect(() => {
    import("@capacitor/core").then(async ({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) return;
      const { NativeNavigation } = await import("@capgo/capacitor-native-navigation");
      const actif = ONGLETS_NATIFS.find((o) => o.route && pathname.startsWith(o.route));
      if (actif) {
        await NativeNavigation.setTabbar({
          selectedId: actif.id,
          labelVisibilityMode: "labeled",
          icons: true,
          tabs: definitionOnglets(),
        });
      }
    });
  }, [pathname]);

  return null;
}
