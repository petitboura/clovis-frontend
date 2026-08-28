"use client";

import { useEffect, useRef, useState } from "react";
import { Bird, X, Maximize2, Minimize2, MessageSquarePlus, History } from "lucide-react";
import { appelerApi, lireOutilsChatAgent } from "@/lib/api";
import { messageErreur } from "@/lib/erreurs";
import { ChatIA } from "./ChatIA";
import { AppSidebar } from "@/components/AppSidebar";
import { MessageAffiche, nettoyerMessageHistorique } from "./BulleMessage";
import { CompteRequisModal } from "@/components/CompteRequisModal";
import { Logo } from "@/components/Logo";
import { useHauteurVisuelle } from "@/lib/useHauteurVisuelle";
import type { EtatChat } from "@/lib/contexteChat";
import { useFenetres } from "@/lib/contexteFenetres";
import { texteAccueilSelonHeure } from "@/lib/salutations";

// Chat flottant global (refonte "Mon espace = l'app", 15/08/2026, demande
// Bourama : "il faut un bouton pour ouvrir le chat en plein écran"). Avant
// cette refonte, le chat était app/page.tsx tout entier (la home). Cette
// logique de chargement (détail agent + outils + historique) est reprise
// ICI à l'identique, mais montée une seule fois au niveau du layout de
// l'app (voir components/AppShell.tsx) -- jamais remontée en changeant de
// section de Mon espace, pour ne jamais perdre la conversation en cours.
//
// Trois états, jamais de démontage de ChatIA entre eux (juste un
// changement d'habillage CSS) pour préserver la conversation :
// - "fermee" : uniquement la bulle icône, ChatIA reste monté mais caché.
// - "mini" : petite fenêtre utilisable en bas à droite (bas de l'écran
//   sur mobile, faute de place).
// - "plein_ecran" : overlay plein écran, même logique de hauteur visuelle
//   que l'ancien app/page.tsx (clavier mobile, voir useHauteurVisuelle).

type AgentDetail = {
  id: string;
  nom: string;
  icone_url: string | null;
  titre_accueil: string;
  sous_titre_accueil: string;
  modeles_disponibles?: { modele_id: string; label: string; distributeur: string; palier: string }[];
  modele_choisi?: string | null;
  bouton_sans_enseignant?: boolean;
  section_mes_comportements?: boolean;
};

type FilConversation = {
  conversation_id: string | null;
  titre: string;
  derniere_activite: string;
};

const AGENT_INVITE_ID = "clovis";
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
  const [chargement, setChargement] = useState<"chargement" | "pret" | "erreur">("chargement");
  const [erreur, setErreur] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [cle, setCle] = useState(() => crypto.randomUUID());
  const [messagesInitiaux, setMessagesInitiaux] = useState<MessageAffiche[]>([]);
  const [nbMessages, setNbMessages] = useState(0);
  const [compteRequis, setCompteRequis] = useState(false);
  const [historiqueOuvert, setHistoriqueOuvert] = useState(false);
  const [outilsActifsAgent, setOutilsActifsAgent] = useState<{
    outils: string[];
    actions_locales: string[];
  } | null>(null);
  const [historique, setHistorique] = useState<FilConversation[]>([]);
  // Fondu de fermeture (18/08/2026, demande Bourama : "le popup disparaît
  // ... brut, j'aime pas"). La fermeture change etat vers "fermee", ce qui
  // démonte immédiatement tout le panneau (voir le early return juste en
  // dessous) -- sans ce délai, aucune animation de sortie n'est possible.
  // On retarde donc le vrai changement d'état de la durée de l'animation.
  const [enFermeture, setEnFermeture] = useState(false);
  useHauteurVisuelle();

  // Chargé dès le montage du layout (pas seulement à l'ouverture du
  // widget) : l'ouverture doit être instantanée, jamais un écran de
  // chargement qui apparaît après coup.
  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const detail: AgentDetail = await appelerApi(`/api/agents/${AGENT_INVITE_ID}`);
        const [outils, fils] = await Promise.all([
          lireOutilsChatAgent(AGENT_INVITE_ID).catch(() => ({ outils: [], actions_locales: [] })),
          appelerApi(`/api/historique/${AGENT_INVITE_ID}/conversations`).catch((e) => {
            console.error("Erreur chargement historique conversations:", e);
            return [] as FilConversation[];
          }),
        ]);
        if (!annule) {
          setAgent(detail);
          setOutilsActifsAgent(outils);
          setHistorique(fils as FilConversation[]);
          setChargement("pret");
        }
      } catch (e) {
        if (!annule) {
          setErreur(messageErreur(e));
          setChargement("erreur");
        }
      }
    })();
    return () => {
      annule = true;
    };
  }, []);

  function fermerAvecFondu() {
    setEnFermeture(true);
    window.setTimeout(() => {
      setEtat("fermee");
      setEnFermeture(false);
    }, 200);
  }

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

  async function selectionnerConversation(fil: FilConversation) {
    if (!agent) return;
    try {
      const cheminId = fil.conversation_id ?? "legacy";
      const lignes: { role: "user" | "assistant"; content: string; created_at: string }[] = await appelerApi(
        `/api/historique/${agent.id}/conversations/${cheminId}`
      );
      setCle(fil.conversation_id ?? crypto.randomUUID());
      setMessagesInitiaux(
        lignes.map((l) => {
          if (l.role !== "user") {
            return { id: null, role: l.role, content: l.content, created_at: l.created_at };
          }
          const { texte, piecesJointes } = nettoyerMessageHistorique(l.content);
          return { id: null, role: l.role, content: texte, created_at: l.created_at, piecesJointes };
        })
      );
      setNbMessages(lignes.length);
      setHistoriqueOuvert(false);
    } catch {
      // Échec de rechargement : on garde le fil courant plutôt que de
      // casser tout le widget.
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

  // Bulle fermée : toujours affichée (sauf pendant le tout premier
  // chargement, pour ne jamais montrer un bouton qui échouerait au clic),
  // sauf en app native où l'onglet "Chat" de la barre système fait déjà
  // ce rôle (voir prop `natif` ci-dessus).
  if (etat === "fermee") {
    if (natif) return null;
    return (
      <button
        onClick={() => setEtat("mini")}
        aria-label="Ouvrir le chat"
        className="group fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-cgpt-bouton bg-dj-accent-1 text-[#1A0D02] shadow-[0_4px_20px_rgba(0,0,0,0.35)] transition-colors hover:bg-dj-accent-2"
      >
        <Bird size={20} className="transition-transform duration-200 group-hover:-rotate-12 group-hover:scale-110" />
      </button>
    );
  }

  const pleinEcran = etat === "plein_ecran";
  // 22/08/2026, demande Bourama : cliquer dans l'interface du CHAT
  // lui-même (pas la sidebar-rail à côté, qui a déjà sa propre logique
  // d'ouverture/premier-plan) ferme TOUTES les fenêtres flottantes de
  // sections. Voir les deux onMouseDownCapture posés plus bas (en-tête +
  // zone de contenu du chat), jamais sur le conteneur englobant qui
  // contiendrait aussi la sidebar.
  const { fenetres, fermerToutes } = useFenetres();
  function fermerFenetresAuClic() {
    if (pleinEcran && fenetres.length > 0) fermerToutes();
  }

  return (
    <div
      className={
        (pleinEcran
          ? "fixed inset-0 z-[110] flex flex-col bg-dj-fond"
          : // Mini popup : centré au milieu de l'écran en desktop (demande
            // Bourama, 17/08/2026 -- "le popup se met à gauche, au coin, je
            // veux qu'il soit au milieu"), inchangé en bas à droite sur
            // mobile (faute de place, clavier virtuel). La bulle fermée,
            // elle, reste toujours en bas à droite (voir le bouton
            // ci-dessus) -- seule la fenêtre une fois ouverte est concernée.
            //
            // CORRECTIF 18/08/2026 (Bourama : "le popup ... trop en bas") :
            // le centrage se faisait avant via left-1/2 top-1/2 +
            // -translate-x/y-1/2, mais cgpt-entree-modal (juste en
            // dessous) anime aussi la propriété transform -- une fois
            // l'animation finie (fill-mode "both"), son état final
            // "translateY(0) scale(1)" écrasait complètement notre
            // décalage de centrage, qui utilisait aussi transform. Le
            // popup perdait son -50% vertical et se retrouvait affiché
            // une demi-hauteur trop bas. Centrage refait ici avec
            // inset-0 + margin:auto (propriétés indépendantes de
            // transform), qui coexiste sans conflit avec l'animation.
            "fixed bottom-5 right-5 z-40 flex h-[min(70dvh,600px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-fond shadow-[0_4px_30px_rgba(0,0,0,0.45)] md:inset-0 md:m-auto") +
        // Fondu d'ouverture (mount -- reprend l'animation standard des
        // modals du projet, cgpt-entree-modal) et de fermeture (juste
        // avant le démontage réel, voir fermerAvecFondu) -- demande
        // Bourama 18/08/2026 : "le popup disparaît ... apparaît brut".
        (enFermeture
          ? " pointer-events-none scale-95 opacity-0 transition-all duration-200 ease-cgpt-doux"
          : " animate-cgpt-entree-modal transition-all duration-200 ease-cgpt-doux")
      }
      style={pleinEcran ? { height: "var(--vh-visuelle, 100dvh)" } : undefined}
    >
      {/* En-tête compact. En mode mini : nouvelle conversation +
          historique en dropdown, faute de place pour un vrai rail. En
          mode plein écran, ces deux-là vivent désormais dans AppSidebar
          (contexteChat=true) juste en dessous, RailChatPleinEcran.tsx
          supprimé le 21/08/2026 (demande Bourama : "il faut qu'il soit
          la barre latérale de l'app avec les deux nouveaux boutons rien
          d'autre") -- pas de doublon ici. Partager / Avis / Pourquoi
          Clovis restent dans le dropdown Actions de cette même
          AppSidebar, jamais dupliqués dans l'en-tête du chat. */}
      <div
        onMouseDownCapture={fermerFenetresAuClic}
        // Correctif (26/08/2026) : en mode plein écran (fixed inset-0),
        // cet en-tête touche littéralement le tout haut du viewport,
        // sous encoche/île dynamique en PWA installée (display:standalone
        // + viewportFit:"cover", voir app/layout.tsx/manifest.ts), le
        // logo/titre se retrouvait coincé sous la barre de statut. Ajout
        // sur le py-2.5 existant, pas un remplacement (0px sur desktop/
        // appareil sans encoche, donc sans effet là où ce n'est pas
        // nécessaire), pas de concernement en mode mini (jamais ancré
        // en haut d'écran, voir bottom-5 right-5 ci-dessus).
        className={`flex flex-shrink-0 items-center gap-2 border-b border-dj-bordure px-3 pb-2.5 ${
          pleinEcran ? "pt-[calc(0.625rem+env(safe-area-inset-top))]" : "pt-2.5"
        }`}
      >
        <Logo taille={20} />
        <span className="font-display text-sm font-bold text-dj-texte">Clovis</span>

        <div className="ml-auto flex items-center gap-1">
          {!pleinEcran && nbMessages > 0 && (
            <button
              onClick={nouvelleConversation}
              title="Nouvelle conversation"
              className="group flex h-8 w-8 items-center justify-center rounded-cgpt-bouton text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte"
            >
              <MessageSquarePlus size={16} className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:rotate-6" />
            </button>
          )}
          {!pleinEcran && historique.length > 0 && (
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
                <div className="absolute right-0 top-9 z-10 max-h-64 w-56 animate-dj-fade-in-rapide overflow-y-auto rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-1 shadow-lg">
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
          <button
            onClick={() => setEtat(pleinEcran ? "mini" : "plein_ecran")}
            title={pleinEcran ? "Réduire" : "Plein écran"}
            className="group flex h-8 w-8 items-center justify-center rounded-cgpt-bouton text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte"
          >
            {pleinEcran ? (
              <Minimize2 size={16} className="transition-transform duration-200 group-hover:scale-90" />
            ) : (
              <Maximize2 size={16} className="transition-transform duration-200 group-hover:scale-110" />
            )}
          </button>
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
        {pleinEcran && (
          <AppSidebar
            connecte={connecte}
            onOuvrirCatalogue={onOuvrirCatalogue}
            contexteChat
            aDesMessages={nbMessages > 0}
            conversationActiveId={cle}
            historique={historique}
            onNouvelleConversation={nouvelleConversation}
            onSelectionnerConversation={selectionnerConversation}
          />
        )}

        <div onMouseDownCapture={fermerFenetresAuClic} className="min-h-0 flex-1">
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
              onMessagesChange={setNbMessages}
              modelesDisponibles={agent.modeles_disponibles}
              modeleChoisi={agent.modele_choisi}
              outilsActifsAgent={outilsActifsAgent}
              boutonSansEnseignant={false}
              avantEnvoi={verifierLimiteInvite}
              pleinEcran={pleinEcran}
            />
          )}
        </div>
      </div>

      {compteRequis && (
        // CORRECTIF (audit 25/08/2026) : z-[100] par défaut du composant
        // passait DERRIÈRE le chat plein écran (z-[110] plus haut dans ce
        // même fichier) -- le popup "compte requis" devenait invisible,
        // présent dans le DOM mais inaccessible, si déclenché pendant que
        // le chat est en plein écran. z-[120] pour rester au-dessus dans
        // les deux états (mini z-40 et plein écran z-[110]).
        <CompteRequisModal
          texte="Crée un compte pour continuer."
          onFerme={() => setCompteRequis(false)}
          zIndex="z-[120]"
        />
      )}
    </div>
  );
}
