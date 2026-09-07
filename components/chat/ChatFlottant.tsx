"use client";

import { useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bird, X, Maximize2, MessageSquarePlus, History } from "lucide-react";
import { appelerApi } from "@/lib/api";
import { ChatIA } from "./ChatIA";
import { MessageAffiche, nettoyerMessageHistorique } from "./BulleMessage";
import { CompteRequisModal } from "@/components/CompteRequisModal";
import { Logo } from "@/components/Logo";
import { useHauteurVisuelle } from "@/lib/useHauteurVisuelle";
import { ContexteChat, type EtatChat, type FilConversation } from "@/lib/contexteChat";
import { useFermetureAuRetour } from "@/lib/contexteRetour";
import { texteAccueilSelonHeure } from "@/lib/salutations";
import { Skeleton } from "@/components/Skeleton";

// Chat flottant global (refonte "Mon espace = l'app", 15/08/2026, demande
// Bourama : "il faut un bouton pour ouvrir le chat en plein écran"). Avant
// cette refonte, le chat était app/page.tsx tout entier (la home). Cette
// logique de chargement (détail agent + outils + historique) est reprise
// ICI à l'identique, mais montée une seule fois au niveau du layout de
// l'app (voir components/AppShell.tsx) -- jamais remontée en changeant de
// section de Mon espace, pour ne jamais perdre la conversation en cours.
//
// Deux états, jamais de démontage de ChatIA entre eux (juste un
// changement d'habillage CSS) pour préserver la conversation :
// - "fermee" : uniquement la bulle icône, ChatIA reste monté mais caché.
// - "mini" : petite fenêtre utilisable en bas à droite (bas de l'écran
//   sur mobile, faute de place).
// Étape 5 (07/09/2026, chantier "chat plein écran = vraie section") :
// l'ancien troisième état "plein_ecran" (overlay fixed inset-0 par-dessus
// l'app) est retiré -- plus aucun déclencheur ne le pose (bulle, barres
// d'onglets, palette de commandes, préremplissage automatique naviguent
// tous vers la vraie route /chat désormais -- pour le bouton Maximize2
// du mini, via un vrai <Link href="/chat"> plus bas, voir
// fermerMiniAvantNavigation ; pour le reste, voir
// lib/contexteChat.tsx::useOuvrirChatAvecTexte). Le mode
// plein écran vit maintenant uniquement dans ChatSection.tsx (/chat).

const LIMITE_MESSAGES_INVITE = 5;
const CLE_COMPTEUR_INVITE = "clovis_nb_messages_invite";
const SOUS_TITRE_ACCUEIL_CLOVIS = "Ton compagnon d'études, à tes côtés.";

export function ChatFlottant({
  connecte,
  etat,
  setEtat,
  onOuvrirCatalogue,
  nouvelleConversationRef,
  natif = false,
}: {
  connecte: boolean;
  etat: EtatChat;
  setEtat: (etat: EtatChat) => void;
  // Transmise à AppSidebar en mode plein écran (voir plus bas) -- "Pourquoi
  // Clovis ?" vit dans le dropdown Actions de la sidebar, mais l'état
  // catalogueOuvert lui-même reste au niveau du layout (AppShell.tsx).
  onOuvrirCatalogue: () => void;
  // Ref pont vers PaletteCommandes.tsx (22/08/2026, chantier "grandes
  // applis" -- Cmd+K version complète) : composant frère monté dans
  // AppShell.tsx, pas un enfant, donc il ne peut pas appeler directement
  // nouvelleConversation() ci-dessous. Voir l'effet plus bas.
  nouvelleConversationRef?: React.MutableRefObject<(() => void) | null>;
  // Ajouté le 26/08/2026 (correctif "boutons qui s'ajoutent par-dessus") :
  // en app native, BarreOngletsNative.tsx expose déjà un onglet "Chat"
  // dans la vraie barre système : la bulle flottante ronde faisait
  // doublon par-dessus elle (voir plus bas, bouton "fermee" masqué dans
  // ce cas). N'affecte que la bulle fermée : une fois le chat ouvert
  // (mini/plein écran), rien ne change.
  natif?: boolean;
}) {
  const [compteRequis, setCompteRequis] = useState(false);
  const [historiqueOuvert, setHistoriqueOuvert] = useState(false);
  // Fondu de fermeture (18/08/2026, demande Bourama : "le popup disparaît
  // ... brut, j'aime pas"). La fermeture change etat vers "fermee", ce qui
  // démonte immédiatement tout le panneau (voir le early return juste en
  // dessous) -- sans ce délai, aucune animation de sortie n'est possible.
  // Correctif (30/08/2026, audit "fermeture brutale") : ce mécanisme
  // vivait avant en local ici (useState + setTimeout). Remonté dans
  // ContexteChat (lib/contexteChat.tsx) pour que useFermerChat
  // (AppSidebar.tsx, tiroir mobile) déclenche exactement le même fondu au
  // lieu de fermer sec -- ctxChat reste défensif (?? ) au cas où ce
  // composant serait un jour rendu hors de ContexteChat.Provider.
  const ctxChat = useContext(ContexteChat);
  const enFermeture = ctxChat?.enFermeture ?? false;
  useHauteurVisuelle();
  // 07/09/2026, correctif Bourama ("la bulle réapparaît par-dessus le
  // chat plein écran") : ce composant reste monté sur toutes les pages
  // (voir AppShell.tsx), /chat compris -- rien ne le masquait
  // spécifiquement là-bas, contrairement à la sidebar/au hamburger
  // (mêmes raisons, voir leurs commentaires respectifs dans
  // AppShell.tsx : la page /chat affiche déjà sa propre interface de
  // chat, cette bulle/ce popup y feraient doublon). Voir le early return
  // plus bas.
  const pathname = usePathname();

  // Étape 1 (07/09/2026, chantier "chat plein écran = vraie section") :
  // état de la conversation déplacé dans ContexteChat (lib/contexteChat.tsx)
  // -- avant en state local ici (useState). Comportement inchangé, ce
  // composant reste pour l'instant le seul à les lire/écrire ; valeurs
  // par défaut (?? ) gardées uniquement pour le cas défensif où ce
  // composant serait rendu hors de ContexteChat.Provider, comme
  // enFermeture ci-dessus.
  const chargement = ctxChat?.chargement ?? "chargement";
  const setChargement = ctxChat?.setChargement ?? (() => {});
  const erreur = ctxChat?.erreur ?? null;
  const setErreur = ctxChat?.setErreur ?? (() => {});
  const agent = ctxChat?.agent ?? null;
  const setAgent = ctxChat?.setAgent ?? (() => {});
  const cle = ctxChat?.cle ?? "";
  const setCle = ctxChat?.setCle ?? (() => {});
  const messagesInitiaux = ctxChat?.messagesInitiaux ?? [];
  const setMessagesInitiaux = ctxChat?.setMessagesInitiaux ?? (() => {});
  const nbMessages = ctxChat?.nbMessages ?? 0;
  const setNbMessages = ctxChat?.setNbMessages ?? (() => {});
  // Absent jusqu'ici (audit Bourama 30/08) : rien ne signalait le
  // chargement en cours quand on rouvre une conversation passée --
  // l'ancien fil restait affiché tel quel jusqu'à l'arrivée brutale du
  // nouveau. Ajouté pour piloter le skeleton de la zone de messages
  // (voir plus bas, juste avant le rendu de ChatIA).
  const chargementFilConversation = ctxChat?.chargementFilConversation ?? false;
  const setChargementFilConversation = ctxChat?.setChargementFilConversation ?? (() => {});
  const outilsActifsAgent = ctxChat?.outilsActifsAgent ?? null;
  const setOutilsActifsAgent = ctxChat?.setOutilsActifsAgent ?? (() => {});
  const historique = ctxChat?.historique ?? [];
  const setHistorique = ctxChat?.setHistorique ?? (() => {});

  // Partie 5 (06/09/2026) : une demande de préremplissage (voir
  // useOuvrirChatAvecTexte, lib/contexteChat.tsx) force une NOUVELLE
  // conversation -- une correction à traiter n'a rien à faire mélangée
  // au fil en cours -- puis passe le texte à ChatIA (texteInitial
  // ci-dessous). Capturé dans le contexte partagé (étape 1, avant en
  // state local ici) avant de vider la demande au niveau du contexte
  // (sinon rien ne resterait à transmettre à ChatIA une fois le contexte
  // remis à null) ; consommée une seule fois pour ne jamais la
  // réappliquer à une conversation suivante.
  const texteInitialConversation = ctxChat?.texteInitialConversation ?? null;
  const setTexteInitialConversation = ctxChat?.setTexteInitialConversation ?? (() => {});
  const demandePrefill = ctxChat?.demandePrefill ?? null;
  useEffect(() => {
    if (demandePrefill === null) return;
    setTexteInitialConversation(demandePrefill);
    nouvelleConversation();
    ctxChat?.setDemandePrefill(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nouvelleConversation recréée à chaque rendu (pas dans useCallback), la comparer romprait l'effet ; seul demandePrefill doit déclencher ce passage.
  }, [demandePrefill]);

  const fermerAvecFondu = ctxChat?.fermerAvecFondu ?? (() => setEtat("fermee"));

  function nouvelleConversation() {
    setCle(crypto.randomUUID());
    setMessagesInitiaux([]);
    setNbMessages(0);
    setHistoriqueOuvert(false);
  }

  // Pont vers PaletteCommandes.tsx (voir la prop ci-dessus) -- placé
  // avant le early return de la bulle fermée pour que les hooks
  // s'exécutent dans le même ordre à chaque rendu, peu importe `etat`.
  useEffect(() => {
    if (nouvelleConversationRef) nouvelleConversationRef.current = nouvelleConversation;
  });

  // 31/08/2026, demande Bourama : le bouton retour (natif + web mobile)
  // ferme le popup mini avec le même fondu (fermerAvecFondu) que le
  // bouton "Fermer" de l'en-tête plutôt que de fermer sec.
  // Étape 5 (07/09/2026) : le calque équivalent pour l'ancien overlay
  // "plein_ecran" (marquerPleinEcranSansHistorique) est retiré avec lui.
  // Le comportement du bouton retour sur la vraie page /chat reste à
  // trancher séparément avec Bourama (voir ChatSection.tsx).
  const { marquerFermetureSansHistorique: marquerMiniSansHistorique } = useFermetureAuRetour(etat === "mini", fermerAvecFondu);

  // Étape 4 (07/09/2026, chantier "chat plein écran = vraie section") :
  // agrandir le popup mini (bouton Maximize2 plus bas) navigue vers la
  // vraie route /chat (app/(app)/chat/page.tsx, étape 2) au lieu de
  // passer etat sur "plein_ecran".
  // Correctif (07/09/2026, demande Bourama : "mets le lien directement
  // dans le bouton" -- un onClick + router.push() n'est pas un vrai
  // lien, pas de preview d'URL au survol contrairement aux autres
  // boutons de section de l'app, potentiel de bug pour rien) : la
  // navigation elle-même passe désormais par un vrai <Link href="/chat">
  // (voir plus bas) -- cette fonction ne gère plus QUE l'effet de bord
  // (fermer le mini avec le même fondu que fermerChatEtNaviguer, et
  // marquerMiniSansHistorique pour que le démontage du calque "mini" ne
  // consomme pas une entrée d'historique et n'annule pas la navigation
  // du Link).
  function fermerMiniAvantNavigation() {
    marquerMiniSansHistorique?.();
    fermerAvecFondu();
  }
  // Sous-menu historique (mode mini, dropdown dans l'en-tête -- voir plus
  // bas) et modale "compte requis" : mêmes calques de retour que le reste
  // de l'appli.
  useFermetureAuRetour(historiqueOuvert, () => setHistoriqueOuvert(false));
  useFermetureAuRetour(compteRequis, () => setCompteRequis(false));

  async function selectionnerConversation(fil: FilConversation) {
    if (!agent) return;
    setChargementFilConversation(true);
    try {
      const cheminId = fil.conversation_id ?? "legacy";
      const lignes: {
        role: "user" | "assistant";
        content: string;
        created_at: string;
        // Ajouté 28/08/2026 (Bourama : outils exécutés/sources/pièces
        // jointes disparaissaient à la réouverture d'une conversation --
        // voir core/main.py:_sauvegarder_echange). Structure déjà alignée
        // sur MessageAffiche.outilsResultats/piecesJointes côté backend,
        // aucune transformation nécessaire au-delà du renommage de champ.
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
            // Les marqueurs texte (nettoyerMessageHistorique) restent la
            // source principale ; meta.pieces_jointes ne comble que les
            // cas qu'ils ne couvrent pas encore (ex: image envoyée via
            // le chemin vision dédié).
            piecesJointes: piecesJointes ?? l.meta?.pieces_jointes ?? undefined,
          };
        })
      );
      setNbMessages(lignes.length);
      setHistoriqueOuvert(false);
    } catch {
      // Échec de rechargement : on garde le fil courant plutôt que de
      // casser tout le widget.
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

  // Voir le commentaire plus haut (déclaration de `pathname`) : la page
  // /chat a déjà sa propre interface de chat, donc ni la bulle fermée ni
  // le popup mini ne doivent s'afficher par-dessus elle.
  if (pathname === "/chat") return null;

  // Bulle fermée : affichée sur desktop uniquement, seul endroit où
  // elle sert encore, faute d'un onglet "Chat" dédié là-bas. Masquée en
  // app native (l'onglet "Chat" de la barre système fait déjà ce rôle,
  // voir prop `natif` ci-dessus) ET, depuis le 30/08/2026 (demande
  // Bourama, une fois BarreOngletsWeb.tsx alignée sur le natif avec son
  // propre onglet "Chat"), sur web mobile aussi, la bulle y faisait
  // doublon par-dessus cet onglet.
  if (etat === "fermee") {
    if (natif) return null;
    return (
      <button
        onClick={() => setEtat("mini")}
        aria-label="Ouvrir le chat"
        // 28/08/2026, chantier "web mobile façon appli" : levée au-dessus
        // de BarreOngletsWeb (voir components/mobile/BarreOngletsWeb.tsx)
        // via --dj-barre-onglets-web -- conservé même si la bulle est
        // maintenant masquée sur mobile web (md:hidden), pour ne pas
        // casser le calc() si elle redevenait visible un jour en-dessous
        // du point de rupture md.
        className="group fixed bottom-[calc(1.25rem+var(--dj-barre-onglets-web,0px))] right-5 z-40 hidden h-12 w-12 items-center justify-center rounded-cgpt-bouton bg-dj-accent-1 text-[#1A0D02] shadow-[0_4px_20px_rgba(0,0,0,0.35)] transition-colors hover:bg-dj-accent-2 md:flex"
      >
        <Bird size={20} className="transition-transform duration-200 group-hover:-rotate-12 group-hover:scale-110" />
      </button>
    );
  }

  // 22/08/2026, demande Bourama : "cliquer dans l'interface du CHAT ferme
  // toutes les fenêtres flottantes de sections" -- ne concernait que
  // l'ancien overlay plein écran (seul endroit où FenetresSections.tsx
  // pouvait s'ouvrir par-dessus le chat, via l'instance AppSidebar
  // contexteChat qui vivait ici). Retiré avec l'overlay à l'étape 5
  // (07/09/2026) : le popup mini n'a jamais eu de fenêtres de section à
  // fermer.

  return (
    <div
      className={
        // Mini popup : centré au milieu de l'écran en desktop (demande
        // Bourama, 17/08/2026 -- "le popup se met à gauche, au coin, je
        // veux qu'il soit au milieu"), inchangé en bas à droite sur
        // mobile (faute de place, clavier virtuel). La bulle fermée,
        // elle, reste toujours en bas à droite (voir le bouton
        // ci-dessus) -- seule la fenêtre une fois ouverte est concernée.
        //
        // CORRECTIF 18/08/2026 (Bourama : "le popup ... trop en bas") :
        // le centrage se faisait avant via left-1/2 top-1/2 +
        // -translate-x/y-1/2, mais cgpt-entree-modal (juste en dessous)
        // anime aussi la propriété transform -- une fois l'animation
        // finie (fill-mode "both"), son état final "translateY(0)
        // scale(1)" écrasait complètement notre décalage de centrage,
        // qui utilisait aussi transform. Le popup perdait son -50%
        // vertical et se retrouvait affiché une demi-hauteur trop bas.
        // Centrage refait ici avec inset-0 + margin:auto (propriétés
        // indépendantes de transform), qui coexiste sans conflit avec
        // l'animation.
        //
        // 28/08/2026, chantier "web mobile façon appli" : bottom-5
        // remplacé par un calc() incluant --dj-barre-onglets-web (vaut
        // 0px en natif et sur desktop, voir app/globals.css), pour lever
        // le popup au-dessus de BarreOngletsWeb sur mobile web.
        "fixed bottom-[calc(1.25rem+var(--dj-barre-onglets-web,0px))] right-5 z-40 flex h-[min(70dvh,600px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-fond shadow-[0_4px_30px_rgba(0,0,0,0.45)] md:inset-0 md:m-auto" +
        // Fondu d'ouverture (mount -- reprend l'animation standard des
        // modals du projet, cgpt-entree-modal) et de fermeture (juste
        // avant le démontage réel, voir fermerAvecFondu) -- demande
        // Bourama 18/08/2026 : "le popup disparaît ... apparaît brut".
        (enFermeture
          ? " pointer-events-none scale-95 opacity-0 transition-all duration-200 ease-cgpt-doux"
          : " animate-cgpt-entree-modal transition-all duration-200 ease-cgpt-doux")
      }
    >
      {/* En-tête compact du popup mini : nouvelle conversation +
          historique en dropdown, faute de place pour un vrai rail
          (l'équivalent en plein écran vit dans AppSidebar, rendue par
          ChatSection.tsx sur la route /chat depuis l'étape 5). */}
      <div
        // Étape 5 (07/09/2026) : cet en-tête ne gère plus que le mode
        // mini (popup, desktop uniquement, voir le early return "fermee"
        // plus haut et BarreOngletsNative.tsx/BarreOngletsWeb.tsx qui
        // naviguent vers /chat pour mobile) -- toujours visible, plus de
        // ternaire hidden md:flex qui ne servait qu'à le masquer en mode
        // plein écran mobile, cas qui n'existe plus ici.
        className="flex flex-shrink-0 items-center gap-2 border-b border-dj-bordure px-3 pb-2.5 pt-2.5"
      >
        <Logo taille={20} />
        <span className="font-display text-sm font-bold text-dj-texte">Clovis</span>

        <div className="ml-auto flex items-center gap-1">
          {nbMessages > 0 && (
            <button
              onClick={nouvelleConversation}
              title="Nouvelle conversation"
              className="group flex h-8 w-8 items-center justify-center rounded-cgpt-bouton text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte"
            >
              <MessageSquarePlus size={16} className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:rotate-6" />
            </button>
          )}
          {historique.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setHistoriqueOuvert((v) => !v)}
                title="Historique"
                className={`group flex h-8 w-8 items-center justify-center rounded-cgpt-bouton transition-colors ${
                  historiqueOuvert ? "bg-dj-surface-haute text-dj-texte" : "text-dj-texte-muet hover:bg-dj-surface-haute hover:text-dj-texte"
                }`}
              >
                <History size={16} className="transition-transform duration-300 group-hover:rotate-45" />
              </button>
              {historiqueOuvert && (
                <div className="dj-scroll-isole absolute right-0 top-9 z-10 max-h-64 w-56 animate-dj-fade-in-rapide overflow-y-auto rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-1 shadow-lg">
                  {historique.map((fil) => (
                    <button
                      key={fil.conversation_id ?? "legacy"}
                      onClick={() => selectionnerConversation(fil)}
                      className="block w-full truncate rounded-xl px-2.5 py-2 text-left text-sm text-dj-texte transition-colors hover:bg-dj-surface-haute"
                    >
                      {fil.titre}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <Link
            href="/chat"
            onClick={fermerMiniAvantNavigation}
            title="Plein écran"
            className="group flex h-8 w-8 items-center justify-center rounded-cgpt-bouton text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte"
          >
            <Maximize2 size={16} className="transition-transform duration-200 group-hover:scale-110" />
          </Link>
          <button
            onClick={fermerAvecFondu}
            title="Fermer"
            className="group flex h-8 w-8 items-center justify-center rounded-cgpt-bouton text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte"
          >
            <X size={16} className="transition-transform duration-200 group-hover:rotate-90" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-h-0 flex-1">
          {/* Comble le trou identifié dans l'audit (30/08) : avant, rien
              ne s'affichait entre le clic sur une conversation passée et
              l'arrivée de la réponse -- l'ancien fil restait figé à
              l'écran puis sautait d'un coup. Reproduit la vraie
              alternance de bulles : utilisateur = carte alignée à droite
              (rounded-cgpt-carte bg-dj-surface, comme le vrai message),
              assistant = simple texte sans cadre aligné à gauche, sur
              plusieurs lignes de largeurs différentes (comme le vrai
              texte de lecture). */}
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
              natif={natif}
            />
          )}
        </div>
      </div>

      {compteRequis && (
        // CORRECTIF (audit 25/08/2026) : z-[100] par défaut du composant
        // passait derrière ce popup mini (z-40 plus haut dans ce même
        // fichier) -- le popup "compte requis" devenait invisible,
        // présent dans le DOM mais inaccessible, si déclenché pendant
        // que le chat est ouvert.
        // z-[150] (relevé le 28/08/2026, ex z-[120]) : à l'époque, les
        // fenêtres de section (FenetresSections.tsx) montaient aussi
        // jusqu'à 120+, z-[120] ne suffisait donc plus dès qu'une
        // fenêtre de section était ouverte en même temps que le chat en
        // plein écran (overlay retiré depuis, voir étape 5 en tête de
        // fichier, mais cette valeur n'a pas encore été réévaluée --
        // étape 6 du même chantier, pas encore faite).
        <CompteRequisModal
          texte="Crée un compte pour continuer."
          onFerme={() => setCompteRequis(false)}
          zIndex="z-[150]"
        />
      )}
    </div>
  );
}
