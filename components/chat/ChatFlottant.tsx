"use client";

import { useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bird, X, Maximize2, MessageSquarePlus, History } from "lucide-react";
import { appelerApi, lireMonProfil, enregistrerMonProfil } from "@/lib/api";
import { ChatIA } from "./ChatIA";
import { MessageAffiche, nettoyerMessageHistorique } from "./BulleMessage";
import { CompteRequisModal } from "@/components/CompteRequisModal";
import { Logo } from "@/components/Logo";
import { useHauteurVisuelle } from "@/lib/useHauteurVisuelle";
import { ContexteChat, type EtatChat, type FilConversation } from "@/lib/contexteChat";
import { useFermetureAuRetour } from "@/lib/contexteRetour";
import { useFenetreDeplacable, POIGNEES_REDIMENSIONNEMENT } from "@/lib/useFenetreDeplacable";
import { TAILLE_MIN } from "@/lib/contexteFenetres";
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

// 07/09/2026, demande Bourama : le popup mini (desktop) doit être
// déplaçable/redimensionnable comme les fenêtres de section (voir
// lib/useFenetreDeplacable.ts, extrait de FenetresSections.tsx), et
// retrouver sa taille/position sur n'importe quel appareil où le
// compte se connecte (voir profil, ProfilPublic côté backend). Reprend
// la même taille visuelle que le centrage CSS d'avant (min(92vw,380px)
// x min(70dvh,600px)) -- calculée ici en pixels réels une fois, plutôt
// qu'en CSS, puisque la position/taille devient un état JS piloté par
// le glissement/redimensionnement (voir POPUP_TAILLE_MIN plus bas).
function positionEtTailleParDefaut() {
  if (typeof window === "undefined") {
    return { x: 0, y: 0, largeur: 380, hauteur: 600 };
  }
  const largeur = Math.min(window.innerWidth * 0.92, 380);
  const hauteur = Math.min(window.innerHeight * 0.7, 600);
  return {
    x: Math.max(0, (window.innerWidth - largeur) / 2),
    y: Math.max(0, (window.innerHeight - hauteur) / 2),
    largeur,
    hauteur,
  };
}

// Taille minimale du popup mini une fois redimensionné -- même valeurs
// que les fenêtres de section (TAILLE_MIN, contexteFenetres.tsx), pour
// rester cohérent : en dessous, le contenu (en-tête + zone de messages)
// ne serait plus vraiment utilisable.
const POPUP_TAILLE_MIN = TAILLE_MIN;

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

  // 07/09/2026, demande Bourama : popup mini déplaçable/redimensionnable
  // (desktop uniquement) avec taille/position retrouvée par compte.
  //
  // CORRECTIF (07/09/2026, bug signalé Bourama "rien ne marche, ni
  // l'agrandir ni la bouger") : la première version lisait
  // `window.matchMedia(...)` directement dans l'initialiseur de
  // useState, exécuté aussi bien côté serveur (SSR) que côté navigateur.
  // Côté serveur, `window` n'existe pas -- `estDesktop` valait donc
  // toujours `false` dans le HTML généré par le serveur, quelle que
  // soit la taille d'écran réelle du visiteur. Au moment de
  // l'hydratation, React peut conserver ce `false` du HTML serveur au
  // lieu de recalculer côté navigateur (pas d'erreur visible, juste un
  // popup qui reste figé dans son état "mobile" -- sans poignées ni
  // glissement -- même sur grand écran). `natif` (juste au-dessus, voir
  // AppShell.tsx) évite exactement ce piège en démarrant à `false`
  // partout puis en posant la vraie valeur dans un effet, qui ne
  // s'exécute jamais côté serveur -- repris ici à l'identique.
  const [estDesktop, setEstDesktop] = useState(false);
  useEffect(() => {
    setEstDesktop(window.matchMedia("(min-width: 768px)").matches);
    // Un redimensionnement de fenêtre qui traverserait le point de
    // rupture pendant que le popup est déjà ouvert reste un cas limite
    // non couvert (une seule fois au montage), comme pour `natif`.
  }, []);
  // Valeur par défaut tout de suite (calcul synchrone, pas d'attente
  // réseau) -- affichée immédiatement, puis éventuellement remplacée par
  // la vraie sauvegarde du compte une fois lireMonProfil() résolu
  // (voir l'effet plus bas). Ordre des champs choisi pour matcher
  // exactement l'API (popup_chat_x/y/largeur/hauteur).
  const [popup, setPopup] = useState(() => positionEtTailleParDefaut());

  useEffect(() => {
    if (!estDesktop) return;
    let annule = false;
    lireMonProfil()
      .then((p) => {
        if (annule) return;
        const { popup_chat_x, popup_chat_y, popup_chat_largeur, popup_chat_hauteur } = p ?? {};
        if (
          popup_chat_x == null ||
          popup_chat_y == null ||
          popup_chat_largeur == null ||
          popup_chat_hauteur == null
        ) {
          return; // jamais personnalisé par ce compte -- on garde la valeur par défaut déjà affichée.
        }
        // Bornage (même esprit que le glissement/redimensionnement à la
        // main) : l'écran actuel peut être plus petit que celui où la
        // taille/position a été sauvegardée la dernière fois (autre
        // appareil), donc on ne fait pas confiance aveuglément aux
        // valeurs brutes du profil.
        const largeur = Math.max(POPUP_TAILLE_MIN.width, Math.min(popup_chat_largeur, window.innerWidth - 24));
        const hauteur = Math.max(POPUP_TAILLE_MIN.height, Math.min(popup_chat_hauteur, window.innerHeight - 24));
        const x = Math.max(-400, Math.min(popup_chat_x, window.innerWidth - 80));
        const y = Math.max(0, Math.min(popup_chat_y, window.innerHeight - 40));
        setPopup({ x, y, largeur, hauteur });
      })
      .catch(() => {
        // Invité (401) ou échec réseau : on garde la valeur par défaut
        // déjà affichée, rien de grave à signaler ici.
      });
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois au montage, comme le chargement du profil dans AppSidebar.tsx.
  }, [estDesktop]);

  // Sauvegarde (07/09/2026) : SEULEMENT au relâchement du glissement/
  // redimensionnement (surFinGeste ci-dessous), jamais pendant le geste
  // -- voir lib/useFenetreDeplacable.ts. Échec silencieux volontaire
  // (comme le chargement ci-dessus) : une préférence de confort qui ne
  // se sauvegarde pas une fois ne justifie pas d'interrompre le chat.
  function sauvegarderPopup(rect: { x: number; y: number; width: number; height: number }) {
    enregistrerMonProfil({
      popup_chat_x: Math.round(rect.x),
      popup_chat_y: Math.round(rect.y),
      popup_chat_largeur: Math.round(rect.width),
      popup_chat_hauteur: Math.round(rect.height),
    }).catch(() => {});
  }

  const { demarrerGlissement: demarrerGlissementPopup, demarrerRedimensionnement: demarrerRedimensionnementPopup } =
    useFenetreDeplacable({
      x: popup.x,
      y: popup.y,
      width: popup.largeur,
      height: popup.hauteur,
      largeurMin: POPUP_TAILLE_MIN.width,
      hauteurMin: POPUP_TAILLE_MIN.height,
      deplacer: (nx, ny) => setPopup((p) => ({ ...p, x: nx, y: ny })),
      redimensionner: (patch) =>
        setPopup((p) => ({
          x: patch.x ?? p.x,
          y: patch.y ?? p.y,
          largeur: patch.width ?? p.largeur,
          hauteur: patch.height ?? p.hauteur,
        })),
      surFinGeste: (rect) => sauvegarderPopup(rect),
    });

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

  // 07/09/2026, bug signalé Bourama : cliquer sur une conversation
  // récente de EcranAccueil.tsx ("Activité récente") ouvrait le chat
  // sans jamais charger cette conversation précise (voir
  // useOuvrirConversation, lib/contexteChat.tsx). L'agent doit être
  // chargé avant d'appeler selectionnerConversation (elle a besoin
  // d'agent.id) -- si la demande arrive avant, l'effet se redéclenche
  // dès qu'`agent` arrive (dépendance ci-dessous) plutôt que de perdre
  // la demande. Consommée une seule fois (setDemandeOuvrirConversation(null)),
  // jamais réappliquée à une conversation suivante.
  const demandeOuvrirConversation = ctxChat?.demandeOuvrirConversation ?? null;
  useEffect(() => {
    if (demandeOuvrirConversation === null || !agent) return;
    selectionnerConversation({
      conversation_id: demandeOuvrirConversation.conversationId,
      titre: "",
      derniere_activite: "",
    });
    ctxChat?.setDemandeOuvrirConversation(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectionnerConversation recréée à chaque rendu (pas dans useCallback) ; seuls demandeOuvrirConversation et agent doivent déclencher ce passage.
  }, [demandeOuvrirConversation, agent]);

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
      // 07/09/2026, demande Bourama : popup mini déplaçable/redimensionnable
      // sur desktop, avec taille/position mémorisée par compte (voir
      // `popup` plus haut). L'ancien centrage CSS (md:inset-0 md:m-auto)
      // est retiré : sur desktop, la position ET la taille viennent
      // maintenant entièrement du style inline ci-dessous (left/top/
      // width/height, piloté par le glissement/redimensionnement) --
      // aucune classe de largeur/hauteur/position ne doit donc rester
      // active en même temps sur desktop, sous peine de conflit. Sur
      // mobile (estDesktop=false), rien ne change : mêmes classes
      // qu'avant (bas-droite, taille fixe), pas de style inline.
      style={estDesktop ? { left: popup.x, top: popup.y, width: popup.largeur, height: popup.hauteur } : undefined}
      className={
        "fixed z-40 flex flex-col overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-fond shadow-[0_4px_30px_rgba(0,0,0,0.45)]" +
        // Classes de position/taille : uniquement sur mobile désormais
        // (desktop les reçoit via le style inline ci-dessus -- voir
        // commentaire juste au-dessus). 28/08/2026, chantier "web mobile
        // façon appli" : bottom-5 remplacé par un calc() incluant
        // --dj-barre-onglets-web (vaut 0px en natif et sur desktop, voir
        // app/globals.css), pour lever le popup au-dessus de
        // BarreOngletsWeb sur mobile web.
        (estDesktop
          ? ""
          : " bottom-[calc(1.25rem+var(--dj-barre-onglets-web,0px))] right-5 h-[min(70dvh,600px)] w-[min(92vw,380px)]") +
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
          ChatSection.tsx sur la route /chat depuis l'étape 5). Sert
          aussi de poignée de glissement sur desktop (07/09/2026, même
          principe que l'en-tête des fenêtres de section, voir
          FenetresSections.tsx) -- touch-action:none nécessaire même si
          ce popup n'existe qu'en pratique sur desktop, par cohérence
          avec ce même correctif ailleurs (évite qu'un trackpad/écran
          tactile capte le geste comme un scroll avant que le glissement
          démarre). */}
      <div
        onPointerDown={estDesktop ? demarrerGlissementPopup : undefined}
        style={estDesktop ? { touchAction: "none" } : undefined}
        // Étape 5 (07/09/2026) : cet en-tête ne gère plus que le mode
        // mini (popup, desktop uniquement, voir le early return "fermee"
        // plus haut et BarreOngletsNative.tsx/BarreOngletsWeb.tsx qui
        // naviguent vers /chat pour mobile) -- toujours visible, plus de
        // ternaire hidden md:flex qui ne servait qu'à le masquer en mode
        // plein écran mobile, cas qui n'existe plus ici.
        className={
          "flex flex-shrink-0 items-center gap-2 border-b border-dj-bordure px-3 pb-2.5 pt-2.5" +
          (estDesktop ? " cursor-grab select-none active:cursor-grabbing" : "")
        }
      >
        <Logo taille={20} />
        <span className="font-display text-sm font-bold text-dj-texte">Clovis</span>

        <div className="ml-auto flex items-center gap-1">
          {nbMessages > 0 && (
            <button
              onClick={nouvelleConversation}
              onPointerDown={(e) => e.stopPropagation()}
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
                onPointerDown={(e) => e.stopPropagation()}
                title="Historique"
                className={`group flex h-8 w-8 items-center justify-center rounded-cgpt-bouton transition-colors ${
                  historiqueOuvert ? "bg-dj-surface-haute text-dj-texte" : "text-dj-texte-muet hover:bg-dj-surface-haute hover:text-dj-texte"
                }`}
              >
                <History size={16} className="transition-transform duration-300 group-hover:rotate-45" />
              </button>
              {historiqueOuvert && (
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  className="dj-scroll-isole absolute right-0 top-9 z-10 max-h-64 w-56 animate-dj-fade-in-rapide overflow-y-auto rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-1 shadow-lg"
                >
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
            onPointerDown={(e) => e.stopPropagation()}
            title="Plein écran"
            className="group flex h-8 w-8 items-center justify-center rounded-cgpt-bouton text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte"
          >
            <Maximize2 size={16} className="transition-transform duration-200 group-hover:scale-110" />
          </Link>
          <button
            onClick={fermerAvecFondu}
            onPointerDown={(e) => e.stopPropagation()}
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

      {/* Poignées de redimensionnement (07/09/2026, desktop uniquement,
          même principe que FenetresSections.tsx -- voir
          lib/useFenetreDeplacable.ts). z-10 (comme dans
          FenetresSections.tsx) : sans ça, rien ne garantit qu'elles
          passent devant le contenu du chat (ChatIA) selon comment son
          propre contenu se positionne à l'intérieur. */}
      {estDesktop &&
        POIGNEES_REDIMENSIONNEMENT.map((p) => (
          <div
            key={p.direction}
            onPointerDown={(e) => demarrerRedimensionnementPopup(e, p.direction)}
            className={`absolute z-10 ${p.classe}`}
            style={{ touchAction: "none" }}
          />
        ))}
    </div>
  );
}
