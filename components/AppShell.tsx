"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AppSidebar } from "@/components/AppSidebar";
import { ChatFlottant } from "@/components/chat/ChatFlottant";
import { FenetresSections } from "@/components/chat/FenetresSections";
import { CatalogueClovis } from "@/components/CatalogueClovis";
import { PaletteCommandes } from "@/components/PaletteCommandes";
import { ContexteChat, type EtatChat } from "@/lib/contexteChat";
import { ContexteFenetres, useFournirFenetres } from "@/lib/contexteFenetres";
import { BarreOngletsNative } from "@/components/mobile/BarreOngletsNative";

// Coquille de l'app entière (refonte "Mon espace = l'app", 15/08/2026).
// Monte UNE SEULE FOIS, au niveau du layout (voir app/(app)/layout.tsx) :
// - la session (connecte), lue une fois et transmise à la nav + au chat
// - la nav principale (AppSidebar)
// - le chat flottant (ChatFlottant), jamais démonté en changeant de
//   section -- sinon la conversation en cours serait perdue
// - le catalogue "Pourquoi Clovis ?", qui garde son comportement
//   d'ouverture automatique à la toute première visite (14/08, demande
//   Bourama), indépendamment de la section sur laquelle on atterrit.
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
  const [etatChat, setEtatChat] = useState<EtatChat>("fermee");
  // Ref pont entre ChatFlottant (propriétaire de nouvelleConversation) et
  // PaletteCommandes (composant frère, 22/08/2026, chantier "grandes
  // applis") -- voir les deux fichiers.
  const nouvelleConversationRef = useRef<(() => void) | null>(null);
  // Fenêtres flottantes de sections par-dessus le chat plein écran
  // (22/08/2026, demande Bourama -- voir lib/contexteFenetres.tsx).
  const fenetres = useFournirFenetres();

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
    if (localStorage.getItem("clovis_catalogue_vu")) return;
    localStorage.setItem("clovis_catalogue_vu", "1");
    setCatalogueOuvert(true);
  }, []);

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
    <ContexteChat.Provider value={{ etat: etatChat, setEtat: setEtatChat }}>
      <ContexteFenetres.Provider value={fenetres}>
        <div className="flex h-dvh">
          {natif && <BarreOngletsNative />}
          <AppSidebar
            connecte={connecte}
            onOuvrirCatalogue={() => setCatalogueOuvert(true)}
            masquerChromeMobile={natif}
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
              téléphone à encoche/île dynamique. env(safe-area-inset-top)
              vaut 0px sur desktop/appareil sans encoche, donc sans effet
              là où ce n'est pas nécessaire, même logique que le
              padding-bottom déjà posé sur la barre de saisie
              (ChatIA.tsx). */}
          <main
            className="flex-1 overflow-y-auto"
            style={
              natif
                ? {
                    paddingTop: "var(--cap-native-navigation-top, 0px)",
                    paddingBottom: "var(--cap-native-navigation-bottom, 0px)",
                  }
                : { paddingTop: "env(safe-area-inset-top)" }
            }
          >
            {children}
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
    </ContexteChat.Provider>
  );
}
