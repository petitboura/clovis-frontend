"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AppSidebar } from "@/components/AppSidebar";
import { ChatFlottant } from "@/components/chat/ChatFlottant";
import { FenetresSections } from "@/components/chat/FenetresSections";
import { CatalogueClovis } from "@/components/CatalogueClovis";
import { PaletteCommandes } from "@/components/PaletteCommandes";
import { ContexteChat, useFournirContexteChat } from "@/lib/contexteChat";
import { ContexteCatalogue } from "@/lib/contexteCatalogue";
import { ContexteFenetres, useFournirFenetres } from "@/lib/contexteFenetres";
import { ContexteRetour, useFournirContexteRetour } from "@/lib/contexteRetour";
import { BarreOngletsNative } from "@/components/mobile/BarreOngletsNative";
import { BarreOngletsWeb } from "@/components/mobile/BarreOngletsWeb";
import { MenuHamburgerNatif } from "@/components/mobile/MenuHamburgerNatif";
import { MenuHamburgerWeb } from "@/components/mobile/MenuHamburgerWeb";
import { TransitionPage } from "@/components/TransitionPage";
import { BoutonNotifications } from "@/components/BoutonNotifications";

// Coquille de l'app entière (refonte "Mon espace = l'app", 15/08/2026).
// Monte UNE SEULE FOIS, au niveau du layout (voir app/(app)/layout.tsx) :
// - la session (connecte), lue une fois et transmise à la nav + au chat
// - la nav principale (AppSidebar)
// - le chat flottant (ChatFlottant), jamais démonté en changeant de
//   section -- sinon la conversation en cours serait perdue
// - le catalogue "Pourquoi Clovis ?", plus ouvert automatiquement à la
//   première visite depuis le 30/08 (chantier onboarding -- raccourcir le
//   chemin vers le premier message envoyé, voir audit-ux-mobile-2026).
//   Reste ouvrable à tout moment via AppSidebar, ChatFlottant et
//   PaletteCommandes (onOuvrirCatalogue), rien n'est perdu en
//   accessibilité, juste plus imposé par défaut.
export function AppShell({ children }: { children: React.ReactNode }) {
  const [connecte, setConnecte] = useState(false);
  const [catalogueOuvert, setCatalogueOuvert] = useState(false);
  // Ajouté le 26/08/2026, Bourama : refonte navigation mobile native.
  // false par défaut (donc web/desktop inchangés) tant que le check
  // Capacitor.isNativePlatform() n'a pas répondu -- évite un flash du
  // hamburger web au tout premier rendu dans l'appli native.
  const [natif, setNatif] = useState(false);
  // Remonté ici depuis ChatFlottant.tsx (16/08/2026) pour pouvoir être
  // ouvert depuis d'autres écrans -- voir lib/contexteChat.tsx et le
  // bouton "Ouvrir le chat" de l'écran d'accueil.
  // 30/08/2026, audit "fermeture brutale" : etat/setEtat ET le fondu de
  // fermeture (enFermeture/fermerAvecFondu, avant local à ChatFlottant.tsx)
  // viennent maintenant tous de ce même fournisseur -- voir
  // lib/contexteChat.tsx.
  const contexteChatValeur = useFournirContexteChat();
  const { etat: etatChat, setEtat: setEtatChat } = contexteChatValeur;
  // Ref pont entre ChatFlottant (propriétaire de nouvelleConversation) et
  // PaletteCommandes (composant frère, 22/08/2026, chantier "grandes
  // applis") -- voir les deux fichiers.
  const nouvelleConversationRef = useRef<(() => void) | null>(null);
  // Fenêtres flottantes de sections par-dessus le chat plein écran
  // (22/08/2026, demande Bourama -- voir lib/contexteFenetres.tsx).
  const fenetres = useFournirFenetres();
  // 31/08/2026, demande Bourama : le bouton retour (natif ET web mobile)
  // doit fermer ce qui est ouvert par-dessus l'appli au lieu de fermer
  // l'appli elle-même -- voir lib/contexteRetour.tsx pour le mécanisme.
  const contexteRetourValeur = useFournirContexteRetour();
  // Le catalogue "Pourquoi Clovis ?" est une modale globale : calque au
  // même titre que les autres, voir la pile dans lib/contexteRetour.tsx.
  // Appel direct sur contexteRetourValeur (pas useFermetureAuRetour, qui
  // lit le contexte via useContext -- AppShell est le composant qui
  // FOURNIT ce contexte à ses enfants, il n'est pas lui-même sous son
  // propre Provider et ne peut donc pas le consommer ainsi).
  useEffect(() => {
    if (!catalogueOuvert) return;
    const id = "catalogue-clovis";
    contexteRetourValeur.empiler(id, () => setCatalogueOuvert(false));
    return () => contexteRetourValeur.depiler(id);
  }, [catalogueOuvert, contexteRetourValeur]);

  useEffect(() => {
    let annule = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!annule) setConnecte(!!session);
    });
    return () => {
      annule = true;
    };
  }, []);

  useEffect(() => {
    let annule = false;
    import("@capacitor/core").then(({ Capacitor }) => {
      const estNatif = Capacitor.isNativePlatform();
      if (!annule) setNatif(estNatif);
      // Chantier "web mobile façon appli" (28/08/2026) : attribut lu par
      // --dj-barre-onglets-web dans app/globals.css, pour que cette
      // variable CSS (marge réservée par la nouvelle barre du bas web)
      // reste à 0 dans l'appli native, qui a déjà sa propre marge via
      // --cap-native-navigation-bottom -- sans cet attribut, les deux
      // marges se seraient additionnées dans l'appli native.
      if (!annule) document.documentElement.setAttribute("data-natif", estNatif ? "true" : "false");
    });
    return () => {
      annule = true;
    };
  }, []);

  return (
    <ContexteRetour.Provider value={contexteRetourValeur}>
    <ContexteChat.Provider value={contexteChatValeur}>
    <ContexteCatalogue.Provider value={{ ouvrir: () => setCatalogueOuvert(true) }}>
      <ContexteFenetres.Provider value={fenetres}>
        <div className="flex h-dvh">
          {natif && <BarreOngletsNative />}
          {/* 30/08/2026, menu hamburger : reprend Accueil/Connecter
              Claude/Paramètres/Partager/Avis/Pourquoi Clovis, tout ce qui
              n'a pas de place dans les 5 onglets directs. Étape 1 de
              l'audit navigation (30/08/2026) : web mobile a désormais son
              propre déclencheur (MenuHamburgerWeb), même mécanique que le
              natif -- BarreOngletsWeb ci-dessous n'a plus d'onglet Plus,
              l'ancienne page /plus est devenue une redirection. */}
          {natif && <MenuHamburgerNatif />}
          {!natif && <BarreOngletsWeb />}
          {!natif && <MenuHamburgerWeb />}
          {/* 02/09/2026, centre de notifications (bouton cloche) :
              contrairement au hamburger (mobile uniquement, md:hidden),
              visible mobile ET desktop -- pas de barre du haut dédiée
              dans cette appli, voir commentaire dans
              BoutonNotifications.tsx. */}
          <BoutonNotifications connecte={connecte} />
          <AppSidebar
            connecte={connecte}
            onOuvrirCatalogue={() => setCatalogueOuvert(true)}
            // Toujours masqué désormais (avant : uniquement natif) --
            // chantier "web mobile façon appli" (28/08/2026) : le menu
            // hamburger + tiroir mobile est remplacé aussi bien côté web
            // (BarreOngletsWeb ci-dessus) que côté natif (BarreOngletsNative,
            // déjà le cas). Ne concerne QUE cette instance-ci d'AppSidebar
            // (nav principale) -- celle montée dans ChatFlottant.tsx pour
            // le chat plein écran (contexteChat) garde son hamburger/tiroir
            // mobile inchangé, jamais touchée par ce chantier.
            masquerChromeMobile
          />
          {/* Marges via les variables CSS du plugin (voir "CSS insets" de
              la doc @capgo/capacitor-native-navigation) : valent 0px sur le
              web, donc ce padding est un no-op hors de l'appli native.
              Correctif (26/08/2026) : hors appli native, rien ne
              réservait l'espace de l'encoche/île dynamique/barre de
              statut en haut d'écran, alors que viewportFit:"cover" +
              display:"standalone" du manifest (voir app/layout.tsx et
              app/manifest.ts) font tourner le site edge-to-edge dès
              qu'il est ouvert en PWA installée : le contenu du tout
              haut de chaque page se retrouvait sous l'encoche sur
              téléphone à encoche/île dynamique. var(--safe-top) (durci
              tâche 4 le 30/08/2026, voir app/globals.css) vaut 0px sur
              desktop/appareil sans encoche, donc sans effet là où ce
              n'est pas nécessaire, même logique que le padding-bottom
              déjà posé sur la barre de saisie (ChatIA.tsx). */}
          <main
            className="flex-1 overflow-y-auto"
            style={
              natif
                ? {
                    // Correctif (31/08/2026, Bourama : "l'appli deborde
                    // du haut") : --cap-native-navigation-top, pose par
                    // @capgo/capacitor-native-navigation (voir
                    // BarreOngletsNative.tsx), avait ete souponne de ne
                    // jamais se declencher tant que le plugin n'etait pas
                    // synchronise cote Android.
                    // Correctif (05/09/2026, meme symptome revenu) :
                    // cause reelle trouvee dans le code source Android du
                    // plugin -- cette variable vaut TOUJOURS 0px (jamais
                    // absente) tant qu'aucun "navbar" natif du plugin
                    // n'est active, ce que ce projet ne fait jamais (voir
                    // explication complete dans app/globals.css). Elle
                    // est donc abandonnee pour le haut : --safe-top seul,
                    // fiable (plugin SystemBars natif de @capacitor/core,
                    // independant de native-navigation). --dj-hamburger-
                    // espace : voir commentaire dans app/globals.css
                    // (reserve la hauteur du bouton hamburger flottant).
                    // paddingBottom inchange : --cap-native-navigation-
                    // bottom reste correct ici, la barre d'onglets native
                    // est reellement visible hors chat et ce plugin est
                    // seul a connaitre sa vraie hauteur.
                    paddingTop: "calc(var(--safe-top) + var(--dj-hamburger-espace))",
                    paddingBottom: "var(--cap-native-navigation-bottom, var(--safe-bottom))",
                  }
                : {
                    paddingTop: "calc(var(--safe-top) + var(--dj-hamburger-espace))",
                    // Réserve l'espace de BarreOngletsWeb (0px sur
                    // desktop et hors mobile, voir --dj-barre-onglets-web
                    // dans app/globals.css) pour que le bas de chaque
                    // page ne se retrouve pas caché derrière la barre.
                    paddingBottom: "var(--dj-barre-onglets-web, 0px)",
                  }
            }
          >
            <TransitionPage>{children}</TransitionPage>
          </main>
          <ChatFlottant
            connecte={connecte}
            etat={etatChat}
            setEtat={setEtatChat}
            onOuvrirCatalogue={() => setCatalogueOuvert(true)}
            nouvelleConversationRef={nouvelleConversationRef}
            natif={natif}
          />
          <FenetresSections />
          <PaletteCommandes
            connecte={connecte}
            etatChat={etatChat}
            setEtatChat={setEtatChat}
            onOuvrirCatalogue={() => setCatalogueOuvert(true)}
            nouvelleConversationRef={nouvelleConversationRef}
          />
          {catalogueOuvert && <CatalogueClovis onFerme={() => setCatalogueOuvert(false)} />}
        </div>
      </ContexteFenetres.Provider>
    </ContexteCatalogue.Provider>
    </ContexteChat.Provider>
    </ContexteRetour.Provider>
  );
}
