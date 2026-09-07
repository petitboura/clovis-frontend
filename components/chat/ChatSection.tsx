"use client";

import { useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { appelerApi } from "@/lib/api";
import { ChatIA } from "./ChatIA";
import { AppSidebar } from "@/components/AppSidebar";
import { MessageAffiche, nettoyerMessageHistorique } from "./BulleMessage";
import { CompteRequisModal } from "@/components/CompteRequisModal";
import { Logo } from "@/components/Logo";
import { ContexteChat, type FilConversation } from "@/lib/contexteChat";
import { useFenetres } from "@/lib/contexteFenetres";
import { useOuvrirCatalogue } from "@/lib/contexteCatalogue";
import { texteAccueilSelonHeure } from "@/lib/salutations";
import { Skeleton } from "@/components/Skeleton";

// Étape 2 (07/09/2026, chantier "chat plein écran = vraie section",
// demande Bourama : "je veux que le chat plein écran soit une vraie
// section, une vraie comme les autres"). Rendu du chat pensé pour vivre
// dans le flux normal d'une page (app/(app)/chat/page.tsx), plus jamais
// en `fixed inset-0` par-dessus le reste -- contrairement à
// ChatFlottant.tsx (mode "plein_ecran"), qui reste inchangé et continue
// de gérer l'ancien overlay pour l'instant.
//
// IMPORTANT -- étape 2 uniquement : ce composant existe mais RIEN ne
// pointe encore vers app/(app)/chat pour l'instant (aucune barre
// d'onglets, aucune bulle, aucune palette de commandes ne navigue ici) --
// uniquement accessible en tapant /chat directement. Le comportement du
// bouton "Réduire"/"Fermer" une fois que ce sera une vraie page reste à
// trancher avec Bourama avant de brancher les vrais points d'entrée
// (étapes 3/4) -- volontairement absent ici pour l'instant.
//
// Lit l'état de la conversation dans ContexteChat (lib/contexteChat.tsx,
// étape 1) -- exactement la même source que ChatFlottant.tsx, donc la
// conversation en cours est partagée entre les deux tant que les deux
// coexistent.
const LIMITE_MESSAGES_INVITE = 5;
const CLE_COMPTEUR_INVITE = "clovis_nb_messages_invite";
const SOUS_TITRE_ACCUEIL_CLOVIS = "Ton compagnon d'études, à tes côtés.";

export function ChatSection() {
  const [connecte, setConnecte] = useState(false);
  // Détection natif : une seule source de vérité dans l'app (calculée
  // dans AppShell.tsx, voir son commentaire "data-natif" et celui de
  // ChatIA.tsx sur la prop `natif`) -- jamais recalculée ici, seulement
  // lue sur l'attribut que AppShell pose sur <html> une fois résolue.
  const [natif, setNatif] = useState(
    () => typeof document !== "undefined" && document.documentElement.dataset.natif === "true"
  );
  const [compteRequis, setCompteRequis] = useState(false);
  const ctxChat = useContext(ContexteChat);
  const ouvrirCatalogue = useOuvrirCatalogue();

  const chargement = ctxChat?.chargement ?? "chargement";
  const erreur = ctxChat?.erreur ?? null;
  const agent = ctxChat?.agent ?? null;
  const cle = ctxChat?.cle ?? "";
  const setCle = ctxChat?.setCle ?? (() => {});
  const messagesInitiaux = ctxChat?.messagesInitiaux ?? [];
  const setMessagesInitiaux = ctxChat?.setMessagesInitiaux ?? (() => {});
  const nbMessages = ctxChat?.nbMessages ?? 0;
  const setNbMessages = ctxChat?.setNbMessages ?? (() => {});
  const chargementFilConversation = ctxChat?.chargementFilConversation ?? false;
  const setChargementFilConversation = ctxChat?.setChargementFilConversation ?? (() => {});
  const outilsActifsAgent = ctxChat?.outilsActifsAgent ?? null;
  const historique = ctxChat?.historique ?? [];
  const texteInitialConversation = ctxChat?.texteInitialConversation ?? null;

  useEffect(() => {
    let annule = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!annule) setConnecte(!!session);
    });
    return () => {
      annule = true;
    };
  }, []);

  // data-natif est posé par AppShell.tsx une fois sa propre détection
  // résolue (toujours déjà monté avant toute route enfant, voir
  // app/(app)/layout.tsx) -- un MutationObserver couvre le seul cas où
  // cette page serait affichée avant que cette résolution soit terminée
  // (ex: /chat chargée directement, à froid).
  useEffect(() => {
    const cible = document.documentElement;
    if (cible.dataset.natif === "true") {
      setNatif(true);
      return;
    }
    const observateur = new MutationObserver(() => {
      if (cible.dataset.natif === "true") setNatif(true);
    });
    observateur.observe(cible, { attributes: true, attributeFilter: ["data-natif"] });
    return () => observateur.disconnect();
  }, []);

  const { fenetres, fermerToutes } = useFenetres();
  function fermerFenetresAuClic() {
    if (fenetres.length > 0) fermerToutes();
  }

  function nouvelleConversation() {
    setCle(crypto.randomUUID());
    setMessagesInitiaux([]);
    setNbMessages(0);
  }

  async function selectionnerConversation(fil: FilConversation) {
    if (!agent) return;
    setChargementFilConversation(true);
    try {
      const cheminId = fil.conversation_id ?? "legacy";
      const lignes: {
        role: "user" | "assistant";
        content: string;
        created_at: string;
        meta?: {
          outils?: MessageAffiche["outilsResultats"];
          pieces_jointes?: MessageAffiche["piecesJointes"];
        } | null;
      }[] = await appelerApi(`/api/historique/${agent.id}/conversations/${cheminId}`);
      setCle(fil.conversation_id ?? crypto.randomUUID());
      setMessagesInitiaux(
        lignes.map((l) => {
          if (l.role !== "user") {
            return {
              id: null,
              role: l.role,
              content: l.content,
              created_at: l.created_at,
              outilsResultats: l.meta?.outils ?? undefined,
            };
          }
          const { texte, piecesJointes } = nettoyerMessageHistorique(l.content);
          return {
            id: null,
            role: l.role,
            content: texte,
            created_at: l.created_at,
            piecesJointes: piecesJointes ?? l.meta?.pieces_jointes ?? undefined,
          };
        })
      );
      setNbMessages(lignes.length);
    } catch {
      // Échec de rechargement : on garde le fil courant plutôt que de
      // casser tout l'écran.
    } finally {
      setChargementFilConversation(false);
    }
  }

  function verifierLimiteInvite(): boolean {
    if (connecte) return true;
    const brut = window.localStorage.getItem(CLE_COMPTEUR_INVITE);
    const compte = brut ? parseInt(brut, 10) || 0 : 0;
    if (compte >= LIMITE_MESSAGES_INVITE) {
      setCompteRequis(true);
      return false;
    }
    window.localStorage.setItem(CLE_COMPTEUR_INVITE, String(compte + 1));
    return true;
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div
        onMouseDownCapture={fermerFenetresAuClic}
        className="hidden flex-shrink-0 items-center gap-2 border-b border-dj-bordure px-3 pb-2.5 pt-2.5 md:flex"
      >
        <Logo taille={20} />
        <span className="font-display text-sm font-bold text-dj-texte">Clovis</span>
      </div>

      <div className="flex min-h-0 flex-1">
        <AppSidebar
          connecte={connecte}
          onOuvrirCatalogue={ouvrirCatalogue}
          contexteChat
          aDesMessages={nbMessages > 0}
          conversationActiveId={cle}
          historique={historique}
          onNouvelleConversation={nouvelleConversation}
          onSelectionnerConversation={selectionnerConversation}
        />

        <div onMouseDownCapture={fermerFenetresAuClic} className="relative min-h-0 flex-1">
          {chargementFilConversation && (
            <div className="absolute inset-0 z-10 overflow-hidden bg-dj-fond">
              <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-5 px-4 py-6" aria-hidden>
                <div className="flex flex-col items-end">
                  <Skeleton className="h-9 w-2/5 rounded-cgpt-carte" />
                </div>
                <div className="flex flex-col items-start gap-2">
                  <Skeleton className="h-4 w-11/12 rounded" style={{ animationDelay: "80ms" }} />
                  <Skeleton className="h-4 w-4/5 rounded" style={{ animationDelay: "160ms" }} />
                  <Skeleton className="h-4 w-3/5 rounded" style={{ animationDelay: "240ms" }} />
                </div>
                <div className="flex flex-col items-end">
                  <Skeleton className="h-9 w-1/3 rounded-cgpt-carte" style={{ animationDelay: "320ms" }} />
                </div>
                <div className="flex flex-col items-start gap-2">
                  <Skeleton className="h-4 w-4/5 rounded" style={{ animationDelay: "400ms" }} />
                  <Skeleton className="h-4 w-2/3 rounded" style={{ animationDelay: "480ms" }} />
                </div>
              </div>
            </div>
          )}

          {chargement === "chargement" && (
            <div className="flex h-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-dj-bordure border-t-dj-texte-muet" />
            </div>
          )}

          {chargement === "erreur" && (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
              <p className="text-sm text-dj-texte">{erreur ?? "Une erreur est survenue."}</p>
              <button
                onClick={() => window.location.reload()}
                className="rounded-lg bg-dj-accent-1 px-4 py-2 text-sm font-bold text-[#1A0D02]"
              >
                Réessayer
              </button>
            </div>
          )}

          {chargement === "pret" && agent && (
            <ChatIA
              key={cle}
              agentId={agent.id}
              nomAgent="Clovis"
              titreAccueil={texteAccueilSelonHeure()}
              sousTitreAccueil={SOUS_TITRE_ACCUEIL_CLOVIS}
              iconePersonnalisee={<Logo taille={40} />}
              conversationId={cle}
              messagesInitiaux={messagesInitiaux}
              texteInitial={texteInitialConversation ?? undefined}
              onMessagesChange={setNbMessages}
              modelesDisponibles={agent.modeles_disponibles}
              modeleChoisi={agent.modele_choisi}
              outilsActifsAgent={outilsActifsAgent}
              boutonSansEnseignant={false}
              avantEnvoi={verifierLimiteInvite}
              pleinEcran
              natif={natif}
            />
          )}
        </div>
      </div>

      {compteRequis && (
        <CompteRequisModal
          texte="Crée un compte pour continuer."
          onFerme={() => setCompteRequis(false)}
          zIndex="z-[150]"
        />
      )}
    </div>
  );
}
