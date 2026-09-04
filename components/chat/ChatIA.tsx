"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { appelerApiStream, uploaderImageChat, uploaderDocumentChat, uploaderVideoChat, transcrireAudioChat } from "@/lib/api";
import { useNotificationsPush, proposerNotificationsPushUneFois } from "@/lib/useNotificationsPush";
import { BulleMessage, MessageAffiche } from "./BulleMessage";
import { BarreDeSaisie, LongueurReponse, LocalisationJointe } from "./BarreDeSaisie";
import { PopupFeedback } from "./PopupFeedback";
import { StatutOutil, EtatStatut } from "./StatutOutil";
import { ConfirmationOutil } from "./ConfirmationOutil";
import { BoutonRepriseAgent } from "./BoutonRepriseAgent";
import { messageErreur } from "@/lib/erreurs";
import { emettreDonneesModifieesPourOutil } from "@/lib/evenementsDonnees";
import { IconeGenerique } from "@/components/icones/IconeGenerique";
import dynamic from "next/dynamic";

// Chargé dynamiquement, ssr:false (26/08) : react-pdf/pdfjs-dist accède
// à des API navigateur (Path2D, DOMMatrix...) dès son import, pas
// seulement à l'utilisation -- une évaluation côté serveur (SSR
// classique de Next.js pour un composant client) plante sans ça. Sans
// incidence perçue : le composant ne rend rien tant qu'aucune position
// n'a été ouverte (voir VisionneurPositionGlobal.tsx).
const VisionneurPositionGlobal = dynamic(
  () => import("./VisionneurPositionGlobal").then((m) => m.VisionneurPositionGlobal),
  { ssr: false },
);

// Page de chat qui remplace chat.py (Streamlit). Consomme la
// nouvelle route /api/chat (api/chat.py) en streaming, au lieu d'appeler
// chat() directement en process comme le faisait Streamlit.
//
// conversationId/messagesInitiaux contrôlés par le parent depuis le
// 2026-07-16 (ajout de la sidebar façon Streamlit, voir SidebarChat.tsx) :
// permet de recharger un ancien fil (Historique) ou d'en démarrer un
// nouveau en remontant simplement ce composant (key={conversationId} côté
// parent), sans changer sa logique interne d'envoi/streaming.
export function ChatIA({
  agentId,
  nomAgent,
  iconeUrl = null,
  titreAccueil,
  sousTitreAccueil,
  conversationId,
  messagesInitiaux = [],
  onMessagesChange,
  modelesDisponibles = [],
  modeleChoisi = null,
  boutonSansEnseignant = false,
  avantEnvoi,
  iconePersonnalisee,
  outilsActifsAgent = null,
  pleinEcran = false,
  natif = false,
}: {
  agentId: string;
  nomAgent: string;
  // Nouveau système d'icône (2026-08-05) : remplace l'ancien cas
  // particulier AGENTS_SANS_IMAGE_VITRINE/IconeMatrix -- voir usage plus
  // bas, écran d'accueil du chat.
  iconeUrl?: string | null;
  titreAccueil?: string;
  sousTitreAccueil?: string;
  conversationId: string;
  messagesInitiaux?: MessageAffiche[];
  onMessagesChange?: (nbMessages: number) => void;
  // Modeles premium (02/08/2026, voir core/fournisseurs_llm.py) : liste
  // vide = agent sans abonnement premium debloque, BarreDeSaisie
  // n'affiche alors AUCUN selecteur (comportement identique a avant
  // cette feature). `modeleChoisi` = preference par defaut du createur
  // (AgentEditable.modele_choisi cote backend), simple valeur initiale --
  // l'utilisateur peut la changer pour la session via le selecteur.
  modelesDisponibles?: { modele_id: string; label: string; distributeur: string; palier: string }[];
  modeleChoisi?: string | null;
  // Agent "Clovis" / contenu dynamique par matière (06/08/2026) -- voir
  // core/contenu_dynamique_matiere.py. Passé jusqu'à BarreDeSaisie pour
  // afficher le bouton "Sans enseignant" (forcer le prompt généraliste
  // pour un message précis, sans passer par le routeur de matière).
  boutonSansEnseignant?: boolean;
  // Mode invité (09/08, demande Bourama : inscription demandée seulement
  // au 5ème message) : appelé juste avant le tout premier appel réseau
  // d'un envoi. Retourne false pour bloquer -- rien n'est envoyé, aucun
  // message n'est ajouté à l'écran (le parent, page.tsx, ouvre alors
  // CompteRequisModal à la place). Retourne true pour laisser passer,
  // comme si la prop n'existait pas.
  avantEnvoi?: () => boolean;
  // Écran de démarrage : remplace iconeUrl/IconeGenerique par cet
  // élément quand fourni (09/08, demande Bourama : sur Clovis, l'IA
  // "étudiant autonome" ne doit montrer ni le nom technique de l'agent
  // réel -- déjà géré via nomAgent -- ni son icône réelle, remplacée ici
  // par le logo Clovis).
  iconePersonnalisee?: React.ReactNode;
  // Outils autorisés pour cet agent (14/08, demande Bourama) -- chargés
  // par le parent (page.tsx) EN MÊME TEMPS que le détail de l'agent,
  // pendant l'écran de chargement plein écran, et simplement transmis
  // ici jusqu'à BarreDeSaisie. `null` tant que le chargement initial
  // n'est pas terminé -- mais dans ce cas ChatIA elle-même n'est pas
  // encore montée (page.tsx n'affiche le chat qu'une fois etat==="pret"),
  // donc en pratique cette prop est toujours déjà résolue ici.
  outilsActifsAgent?: { outils: string[]; actions_locales: string[] } | null;
  // Pour relancer l'animation du titre d'accueil à l'entrée en plein
  // écran (18/08/2026, demande Bourama) -- voir l'effet dédié plus bas.
  pleinEcran?: boolean;
  // Appli installée (Capacitor.isNativePlatform(), calculé une fois dans
  // AppShell.tsx et redescendu via ChatFlottant.tsx) -- transmis à
  // /api/chat pour forcer gerer_dossier_telephone + explorer_dossier
  // côté backend (04/09/2026, demande Bourama). Jamais recalculé ici :
  // une seule source de vérité pour cette détection dans l'app.
  natif?: boolean;
}) {
  const [modeleSelectionne, setModeleSelectionne] = useState<string | null>(modeleChoisi);
  const [messages, setMessages] = useState<MessageAffiche[]>(messagesInitiaux);
  // Correctif mobile (2026-07-30, demande Bourama) : aucun scroll auto
  // n'existait avant -- sur desktop le "scroll anchoring" natif du
  // navigateur masquait le problème la plupart du temps, mais sur mobile
  // (redimensionnement du viewport visible à l'ouverture du clavier +
  // barre de saisie qui grandit sur plusieurs lignes) ça ne suffit plus :
  // le bas de la conversation (donc la barre de saisie et le début de la
  // réponse en cours) reste hors champ. `collePresBasRef` retient si
  // l'utilisateur était déjà proche du bas AVANT le changement -- on ne
  // force le scroll que dans ce cas, jamais s'il a remonté lire l'historique.
  const conteneurMessagesRef = useRef<HTMLDivElement>(null);
  const finDesMessagesRef = useRef<HTMLDivElement>(null);
  const collePresBasRef = useRef(true);
  const { activer: activerNotificationsPush } = useNotificationsPush();
  const [genEnCours, setGenEnCours] = useState(false);
  // Rythme d'affichage du texte de réponse DÉCOUPLÉ de son arrivée
  // réseau (demande Bourama : "le streaming n'est pas contrôlé, si
  // plusieurs textes sont donnés ils s'affichent [tous d'un coup]").
  // Le texte reçu via l'événement "reponse" est mis en attente dans
  // bufferAffichageRef plutôt qu'ajouté directement à content ; un
  // ticker (tickAffichage) le révèle mot par mot à rythme fixe, avec
  // rattrapage si le backend envoie un gros paquet d'un coup (voir plus
  // bas). affichageEnCours reste vrai tant que ce buffer n'est pas vidé,
  // même après la fin du flux réseau (genEnCours) -- sert à activer le
  // fade mot par mot (pluginMotsFade) de BulleMessage.tsx sur le VRAI
  // rythme d'affichage plutôt que sur celui, brut, du réseau.
  const bufferAffichageRef = useRef("");
  const tickerActifRef = useRef(false);
  const tickerIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [affichageEnCours, setAffichageEnCours] = useState(false);
  const [statuts, setStatuts] = useState<{ texte: string; etat: EtatStatut }[]>([]);
  // Raisonnement interne du modèle (24/07, voir RaisonnementBulle.tsx) --
  // enCours est un flag transitoire (vrai seulement pendant que LE
  // dernier message est en train de réfléchir) ; le texte lui-même est
  // stocké directement sur le message concerné (message.raisonnement,
  // voir MessageAffiche dans BulleMessage.tsx) depuis le 26/07 -- corrige
  // un bug où raisonnement/sources disparaissaient dès la question
  // suivante (ils ne vivaient qu'un state séparé rattaché au "dernier"
  // message, jamais persistés sur le message lui-même).
  const [raisonnementEnCours, setRaisonnementEnCours] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    nomLisible: string;
    agentNom?: string | null;
    arguments: Record<string, unknown>;
    etatReprise: unknown;
  } | null>(null);
  const [confirmationEnAttente, setConfirmationEnAttente] = useState(false);
  const [popupFeedback, setPopupFeedback] = useState<{
    type: "positif" | "negatif";
    messageId: number;
    questionMessageId: number | null;
  } | null>(null);

  // Titre d'accueil révélé lettre par lettre (18/08/2026, demande Bourama :
  // "le texte doit s'afficher... lettre par lettre fluidement... comme si
  // il poussait les deux bords"). Le conteneur icône+titre est déjà centré
  // comme un seul bloc (voir plus bas, items-center sur le parent) : faire
  // grandir juste le texte progressivement suffit à obtenir l'effet
  // demandé, l'icône se déplaçant seule vers la gauche à mesure que le
  // bloc entier se recentre.
  const [titreRevele, setTitreRevele] = useState("");
  const idIntervalTitreRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function jouerRevelationTitre() {
    if (idIntervalTitreRef.current) clearInterval(idIntervalTitreRef.current);
    if (!titreAccueil) {
      setTitreRevele("");
      return;
    }
    setTitreRevele("");
    let i = 0;
    idIntervalTitreRef.current = setInterval(() => {
      i++;
      setTitreRevele(titreAccueil.slice(0, i));
      if (i >= titreAccueil.length && idIntervalTitreRef.current) {
        clearInterval(idIntervalTitreRef.current);
        idIntervalTitreRef.current = null;
      }
    }, 35);
  }

  // Relance au montage et à chaque nouveau titreAccueil (nouvelle
  // conversation ou nouvelle heure).
  useEffect(() => {
    jouerRevelationTitre();
    return () => {
      if (idIntervalTitreRef.current) clearInterval(idIntervalTitreRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titreAccueil]);

  // Relance spécifiquement à l'ENTRÉE en plein écran (18/08/2026, demande
  // Bourama) -- ChatIA reste monté en continu entre mini/plein écran pour
  // préserver la conversation (voir ChatFlottant.tsx), donc l'effet
  // ci-dessus ne se redéclenche pas tout seul au changement d'état. Ne se
  // relance PAS en sortant du plein écran (retour au mini) : seule
  // l'entrée est concernée, via le ref qui retient l'état précédent.
  const pleinEcranPrecedentRef = useRef(pleinEcran);
  useEffect(() => {
    const entreEnPleinEcran = pleinEcran && !pleinEcranPrecedentRef.current;
    pleinEcranPrecedentRef.current = pleinEcran;
    if (entreEnPleinEcran) {
      jouerRevelationTitre();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pleinEcran]);

  function majMessages(fabriqueSuivant: (prec: MessageAffiche[]) => MessageAffiche[]) {
    setMessages((prec) => {
      const suivant = fabriqueSuivant(prec);
      onMessagesChange?.(suivant.length);
      return suivant;
    });
  }

  // Découpe le buffer en attente en un "mot" (espaces de tête inclus
  // dans le morceau suivant, jamais révélés seuls) : révéler mot par mot
  // reste lisible tout en limitant le nombre de re-renders par rapport à
  // un caractère par caractère.
  function decouperProchainMot(buffer: string): [string, string] {
    if (buffer.length === 0) return ["", ""];
    let i = 0;
    while (i < buffer.length && /\s/.test(buffer[i])) i++;
    while (i < buffer.length && !/\s/.test(buffer[i])) i++;
    return [buffer.slice(0, i), buffer.slice(i)];
  }

  function tickAffichage() {
    const buffer = bufferAffichageRef.current;
    if (buffer.length === 0) {
      tickerActifRef.current = false;
      setAffichageEnCours(false);
      return;
    }
    // Rattrapage : si le buffer s'accumule (le réseau va plus vite que
    // l'affichage, ou un gros paquet est arrivé d'un coup), on révèle
    // plusieurs mots par tick pour ne jamais laisser un décalage
    // perceptible entre le texte affiché et la vraie réponse déjà reçue.
    // Rattrapage plus doux qu'avant (demande Bourama : "calmement,
    // comme s'il respirait") -- on accepte un peu plus de retard avant
    // d'accélérer, et on n'accélère jamais autant que le rythme de base
    // ne se voie plus.
    const nbMots = buffer.length > 500 ? 4 : buffer.length > 200 ? 2 : 1;
    let morceau = "";
    let reste = buffer;
    for (let i = 0; i < nbMots && reste.length > 0; i++) {
      const [mot, r] = decouperProchainMot(reste);
      morceau += mot;
      reste = r;
    }
    bufferAffichageRef.current = reste;
    majMessages((prec) => {
      const copie = [...prec];
      const dernier = copie[copie.length - 1];
      copie[copie.length - 1] = { ...dernier, content: dernier.content + morceau };
      return copie;
    });
    tickerIdRef.current = setTimeout(tickAffichage, 42);
  }

  function pousserTexteAffichage(texte: string) {
    bufferAffichageRef.current += texte;
    setAffichageEnCours(true);
    if (tickerActifRef.current) return;
    tickerActifRef.current = true;
    tickerIdRef.current = setTimeout(tickAffichage, 42);
  }

  function reinitialiserAffichageControle() {
    if (tickerIdRef.current) clearTimeout(tickerIdRef.current);
    tickerActifRef.current = false;
    bufferAffichageRef.current = "";
    setAffichageEnCours(false);
  }

  // Ajouté 04/09/2026 (bug de cascade signalé par Bourama) : quand le
  // backend bascule sur un autre modèle après avoir déjà streamé du
  // texte "reponse" pour ce message (voir core/main.py, événement SSE
  // "reponse_annulee"), ce texte doit disparaître proprement avant que
  // la vraie tentative suivante ne commence à écrire, plutôt que de
  // s'empiler dessus.
  //
  // repliEnAttenteRef reste vrai entre l'événement "reponse_annulee" et
  // le TOUT PREMIER événement "reponse"/"raisonnement" qui suit -- c'est
  // cet événement suivant (pas un délai arbitraire) qui vide vraiment le
  // contenu, juste avant d'appliquer son propre texte. Volontairement
  // pas de setTimeout ici : un délai fixe pourrait effacer du texte déjà
  // légitimement arrivé du modèle suivant si celui-ci se met à répondre
  // avant l'expiration du délai (l'inférence peut démarrer très vite) --
  // se caler sur l'événement réel élimine ce risque de course.
  // enRepli, lui, passe à true immédiatement pour lancer l'animation de
  // repli (voir BulleMessage.tsx) : le contenu (donc invisible pendant
  // le repli) n'a besoin d'être effacé qu'au moment où du nouveau texte
  // doit apparaître.
  const repliEnAttenteRef = useRef(false);

  function annulerReponseAffichee() {
    reinitialiserAffichageControle();
    repliEnAttenteRef.current = true;
    majMessages((prec) => {
      const copie = [...prec];
      copie[copie.length - 1] = { ...copie[copie.length - 1], enRepli: true };
      return copie;
    });
  }

  useEffect(() => {
    return () => {
      if (tickerIdRef.current) clearTimeout(tickerIdRef.current);
    };
  }, []);

  // Partagé entre l'envoi normal (envoyerMessage) et la reprise après
  // confirmation (repriseApresConfirmation) -- même flux d'événements SSE
  // dans les deux cas (voir core/main.py:chat(), docstring).
  function traiterEvenement(evenement: any) {
    if (evenement.type === "reponse") {
      // Le texte de la réponse arrive : la phase "outils" est terminée,
      // on efface les indicateurs de statut plutôt que de les laisser
      // traîner sous la réponse qui commence à s'afficher. Le raisonnement
      // (s'il y en a eu) se fige/replie ici plutôt que d'être effacé --
      // voir RaisonnementBulle.tsx.
      setStatuts([]);
      setRaisonnementEnCours(false);
      // Relais de cascade juste avant (voir "reponse_annulee" plus haut) :
      // ce texte est le premier du modèle qui prend le relais, et lui
      // n'a émis aucun raisonnement avant -- on vide donc ici le contenu
      // ET le raisonnement du modèle précédent (retiré), et on referme
      // le repli visuel juste avant que ce nouveau texte ne commence à
      // s'écrire.
      if (repliEnAttenteRef.current) {
        repliEnAttenteRef.current = false;
        majMessages((prec) => {
          const copie = [...prec];
          copie[copie.length - 1] = { ...copie[copie.length - 1], content: "", raisonnement: "", enRepli: false };
          return copie;
        });
      }
      pousserTexteAffichage(evenement.texte);
    } else if (evenement.type === "raisonnement") {
      setRaisonnementEnCours(true);
      // Repart à zéro si ce raisonnement est le premier du modèle qui
      // prend le relais après un "reponse_annulee" -- ne pas l'accumuler
      // avec celui, obsolète, du modèle précédent, et refermer le repli
      // visuel puisque du contenu neuf arrive.
      const premierApresRepli = repliEnAttenteRef.current;
      if (premierApresRepli) repliEnAttenteRef.current = false;
      majMessages((prec) => {
        const copie = [...prec];
        const dernier = copie[copie.length - 1];
        copie[copie.length - 1] = {
          ...dernier,
          content: premierApresRepli ? "" : dernier.content,
          enRepli: premierApresRepli ? false : dernier.enRepli,
          raisonnement: (premierApresRepli ? "" : dernier.raisonnement || "") + evenement.texte,
        };
        return copie;
      });
    } else if (evenement.type === "reponse_annulee") {
      annulerReponseAffichee();
    } else if (evenement.type === "meta") {
      // `evenement.modele` = modele_id brut (voir core/main.py --
      // _sauvegarder_echange renvoie desormais ce champ pour TOUTE
      // reponse, Groq/Gemini par defaut inclus). On ne resout un label
      // affichable QUE s'il correspond a un modele premium connu de CET
      // agent (modelesDisponibles) -- un id Groq/Gemini interne ne
      // matche jamais rien ici et reste donc invisible, comme demande.
      const modeleLabel = modelesDisponibles.find((m) => m.modele_id === evenement.modele)?.label ?? null;
      majMessages((prec) => {
        const copie = [...prec];
        const iAssistant = copie.length - 1;
        const iUser = copie.length - 2;
        copie[iAssistant] = {
          ...copie[iAssistant],
          id: evenement.message_id_assistant ?? copie[iAssistant].id,
          created_at: evenement.created_at_assistant ?? copie[iAssistant].created_at,
          qualiteReduite: evenement.modele_qualite_reduite === true,
          modele: modeleLabel,
        };
        if (iUser >= 0) copie[iUser] = { ...copie[iUser], id: evenement.message_id_user };
        return copie;
      });
    } else if (evenement.type === "statut") {
      setStatuts((prec) => [...prec, { texte: evenement.texte, etat: "en_cours" as EtatStatut }]);
    } else if (evenement.type === "statut_termine") {
      // Met à jour le dernier statut "en_cours" plutôt que d'en empiler un
      // nouveau -- voir StatutOutil.tsx, transition douce entre les deux
      // états (jamais un remplacement sec).
      setStatuts((prec) => {
        const copie = [...prec];
        const iDernierEnCours = [...copie].reverse().findIndex((s) => s.etat === "en_cours");
        if (iDernierEnCours === -1) {
          copie.push({ texte: evenement.texte, etat: "termine" });
        } else {
          const i = copie.length - 1 - iDernierEnCours;
          copie[i] = { texte: evenement.texte, etat: evenement.texte.includes("annulée") ? "annule" : "termine" };
        }
        return copie;
      });
    } else if (evenement.type === "sources") {
      // Rattachées à l'entrée outilsResultats CONCERNÉE, pas à un champ
      // séparé du message (26/07, retour Bourama : les sources doivent
      // apparaître juste après le résultat de LEUR outil, pas dans un
      // bloc "Sources" à part en bas -- voir OutilResultatBulle.tsx).
      // Fiable : le backend émet toujours outil_resultat puis sources
      // pour un même appel, l'un juste après l'autre (voir
      // core/main.py:_traiter_appels), donc le dernier élément de
      // outilsResultats à ce moment précis est forcément le bon.
      majMessages((prec) => {
        const copie = [...prec];
        const dernier = copie[copie.length - 1];
        const outils = dernier.outilsResultats || [];
        if (!outils.length) return prec; // sources sans outil_resultat correspondant -- ne devrait pas arriver
        const iDernierOutil = outils.length - 1;
        const existantes = outils[iDernierOutil].sources || [];
        // CORRECTIF 27/08 (Bourama : "les citations n'apparaissent pas
        // toujours dans le texte, c'est le frontend qui ne sait pas
        // l'afficher") -- dédoublonner par `s.url` cassait les sources
        // bibliothèque : plusieurs extraits d'un MÊME fichier (page 4 ET
        // page 7 d'un même PDF, par ex.) partagent la même `url` de base
        // et ne se distinguent que par `url_extrait` -- avec `s.url`
        // comme clé, seul le premier extrait de ce fichier survivait,
        // les suivants étaient silencieusement supprimés. Résultat : le
        // texte contenait bien `[nom, page 7](citation:2)` (le modèle
        // suivait l'instruction), mais `sourcesAplaties[1]` n'existait
        // plus côté frontend une fois ces "doublons" retirés -> le lien
        // ne résolvait plus rien, et `a()` (BulleMessage.tsx) rend alors
        // `null`, sans trace visible ni erreur. D'où l'impression que la
        // citation n'était "jamais" affichée dans le texte, alors que le
        // modèle l'écrivait bien -- ce n'était donc pas lui le problème.
        // Clé de dédoublonnage : `url_extrait` quand il existe (distinct
        // par page/timestamp), sinon `url` (image/note/lien : un seul
        // extrait par fichier, dédoublonnage par url reste correct).
        const cle = (s: { url: string; url_extrait?: string }) => s.url_extrait || s.url;
        const clesExistantes = new Set(existantes.map(cle));
        const nouvelles = (evenement.sources || []).filter(
          (s: { url: string; url_extrait?: string }) => !clesExistantes.has(cle(s)),
        );
        if (!nouvelles.length) return prec;
        const outilsCopie = [...outils];
        outilsCopie[iDernierOutil] = { ...outilsCopie[iDernierOutil], sources: [...existantes, ...nouvelles] };
        copie[copie.length - 1] = { ...dernier, outilsResultats: outilsCopie };
        return copie;
      });
    } else if (evenement.type === "outil_resultat") {
      // Généralisation (26/07, demande Bourama) : un élément par appel
      // d'outil, PAS de dédoublonnage (contrairement à "sources") -- deux
      // appels au même outil dans le même tour (ex: deux recherches
      // distinctes) doivent chacun garder leur propre résultat affiché.
      //
      // 15/08 (demande Bourama : "quand l'IA crée un comportement on ne
      // le voit pas") : en plus de l'affichage dans le fil, on signale
      // à la section comportements de se recharger si elle est déjà
      // montée -- voir lib/evenementsDonnees.ts.
      emettreDonneesModifieesPourOutil(evenement.nom_outil);
      majMessages((prec) => {
        const copie = [...prec];
        const dernier = copie[copie.length - 1];
        const existants = dernier.outilsResultats || [];
        copie[copie.length - 1] = {
          ...dernier,
          outilsResultats: [
            ...existants,
            { nomOutil: evenement.nom_outil, nomLisible: evenement.nom_lisible, resultat: evenement.resultat },
          ],
        };
        return copie;
      });
    } else if (evenement.type === "fichiers_generes") {
      // Bloc "Fichier(s) généré(s)" retiré (04/09/2026, demande Bourama) :
      // évènement toujours émis côté backend mais volontairement ignoré
      // ici -- seul le lien que le modèle écrit lui-même dans sa réponse
      // (rendu par BulleMessage.tsx) est affiché désormais.
    } else if (evenement.type === "confirmation_requise") {
      setConfirmation({
        nomLisible: evenement.nom_lisible,
        agentNom: evenement.agent_nom,
        arguments: evenement.arguments || {},
        etatReprise: evenement.etat_reprise,
      });
    } else if (evenement.type === "limite_outils_atteinte" || evenement.type === "repetition_detectee") {
      // Ajouté 02/09/2026 (voir core/main.py:_agent_groq, docstring de
      // chat()) : le texte expliquant la situation a déjà été streamé
      // dans CE message via les événements "reponse" juste avant --
      // on y attache juste l'état de reprise pour afficher le bon
      // bouton (voir BoutonRepriseAgent).
      majMessages((prec) => {
        const copie = [...prec];
        copie[copie.length - 1] = {
          ...copie[copie.length - 1],
          repriseDisponible: {
            type: evenement.type === "repetition_detectee" ? "repetition" : "limite",
            etatReprise: evenement.etat_reprise,
          },
        };
        return copie;
      });
    }
  }

  // Ajouté 02/09/2026 : reprend un tour arrêté sur limite_outils_atteinte
  // ou repetition_detectee (bouton sous le message concerné). Contrairement
  // à repriseApresConfirmation, aucun outil en attente à finir/annuler --
  // on relance directement l'agent avec un budget neuf ; messages_agent
  // (côté backend) garde déjà tous les résultats d'outils obtenus jusque-là,
  // donc rien n'est perdu ni rejoué. La continuation s'affiche comme un
  // NOUVEAU message assistant (pas ajoutée au précédent), même logique que
  // le bouton "Continuer" de Claude.
  //
  // `messageUtilisateur` optionnel (correction 02/09/2026, signalée par
  // Bourama) : le bouton "Continuer" n'est qu'un raccourci pour éviter de
  // taper ce mot -- si l'utilisateur tape autre chose à la place (un
  // ajustement, "j'arrête"...) PENDANT que ce bouton est affiché, CE texte
  // doit passer par ce même chemin (voir envoyerMessage plus bas, qui
  // redirige ici s'il détecte un état de reprise en attente), pour que le
  // modèle garde tout le contexte déjà accumulé plutôt que de repartir sur
  // une conversation vierge. C'est au modèle de décider quoi faire de ce
  // message (continuer, s'arrêter, s'ajuster), pas au frontend de trancher
  // en amont en effaçant l'état.
  async function reprendreAgent(indexMessage: number, messageUtilisateur?: string) {
    const message = messages[indexMessage];
    const reprise = message?.repriseDisponible;
    if (!reprise) return;

    if (avantEnvoi && !avantEnvoi()) {
      return;
    }

    // L'état devient obsolète dès qu'on l'utilise -- évite un double-clic
    // (ou un double-envoi) qui relancerait deux fois le même état.
    majMessages((prec) => {
      const copie = [...prec];
      copie[indexMessage] = { ...copie[indexMessage], repriseDisponible: null };
      const suite: MessageAffiche[] = messageUtilisateur
        ? [
            { id: null, role: "user", content: messageUtilisateur, created_at: new Date().toISOString() },
            { id: null, role: "assistant", content: "" },
          ]
        : [{ id: null, role: "assistant", content: "" }];
      return copie.concat(suite);
    });
    reinitialiserAffichageControle();
    setGenEnCours(true);
    setStatuts([]);
    setRaisonnementEnCours(false);

    try {
      await appelerApiStream(
        "/api/chat",
        {
          reprise: {
            etat_reprise: reprise.etatReprise,
            type: "continuer_agent",
            message_utilisateur: messageUtilisateur || null,
          },
        },
        (evenement) => traiterEvenement(evenement)
      );
    } catch (e) {
      reinitialiserAffichageControle();
      majMessages((prec) => {
        const copie = [...prec];
        copie[copie.length - 1] = {
          ...copie[copie.length - 1],
          content: "Une erreur est survenue, réessaie dans un instant.",
          erreur: true,
        };
        return copie;
      });
    } finally {
      setGenEnCours(false);
    }
  }

  async function envoyerMessage(
    texte: string,
    longueur: LongueurReponse,
    fichiers: File[],
    localisation: LocalisationJointe = null,
    texteColle: string | null = null,
    rechercheForcee: boolean = false,
    sansEnseignant: boolean = false
  ) {
    // Doit être le tout premier test de la fonction : si le parent
    // bloque (limite invité atteinte), on sort avant de toucher à quoi
    // que ce soit -- pas de message ajouté, pas d'appel réseau, pas de
    // proposition de notifications push.
    if (avantEnvoi && !avantEnvoi()) {
      return;
    }

    // Correction 02/09/2026 (signalée par Bourama) : si un bouton
    // Continuer/Réessayer est affiché sous le dernier message (limite
    // d'étapes atteinte ou répétition détectée) et que l'utilisateur tape
    // un message texte à la place de cliquer dessus, ce message doit
    // repartir dans le MÊME contexte complet (tous les résultats d'outils
    // déjà obtenus), pas sur une conversation vierge reconstruite depuis
    // l'historique affiché -- c'est au modèle de décider quoi en faire
    // (continuer, s'arrêter, s'ajuster). Limité au cas simple (texte
    // seul, sans fichier joint) : reprendreAgent ne gère pas encore
    // l'upload de fichiers sur ce chemin, voir sa docstring.
    const dernierMessage = messages[messages.length - 1];
    if (dernierMessage?.repriseDisponible && fichiers.length === 0 && !texteColle) {
      await reprendreAgent(messages.length - 1, texte);
      return;
    }

    // Demande de Bourama (2026-07-22) : proposer l'activation des
    // notifications push dès la première vraie action (envoyer un
    // message = utiliser l'IA), pas au chargement de la page -- voir
    // proposerNotificationsPushUneFois pour le garde-fou "une seule
    // fois par appareil, jamais si déjà répondu avant".
    proposerNotificationsPushUneFois(activerNotificationsPush);

    const typeDeFichier = (f: File): "image" | "document" | "video" | "audio" =>
      f.type.startsWith("image/") ? "image" : f.type.startsWith("video/") ? "video" : f.type.startsWith("audio/") ? "audio" : "document";

    const messageUtilisateur: MessageAffiche = {
      id: null,
      role: "user",
      content: texte,
      created_at: new Date().toISOString(),
      piecesJointes: fichiers.length
        ? fichiers.map((f) => ({ nom: f.name, type: typeDeFichier(f), previewUrl: URL.createObjectURL(f) }))
        : null,
    };
    const historiquePourApi = messages.map((m) => ({ role: m.role, content: m.content }));

    // Si on arrive ici, soit il n'y avait pas d'état de reprise en
    // attente, soit on est dans le cas de secours (fichier joint,
    // intercepté plus haut) qui bypass le contexte enrichi -- dans les
    // deux cas, on nettoie les éventuels vieux boutons Continuer/Réessayer
    // restants pour ne pas laisser un bouton obsolète affiché.
    majMessages((prec) => [
      ...prec.map((m) => (m.repriseDisponible ? { ...m, repriseDisponible: null } : m)),
      messageUtilisateur,
      { id: null, role: "assistant", content: "" },
    ]);
    reinitialiserAffichageControle();
    setGenEnCours(true);
    setStatuts([]);
    setRaisonnementEnCours(false);
    setConfirmation(null);

    // Upload/traitement des fichiers AVANT le message texte, EN PARALLÈLE
    // (17/08, demande Bourama : "permet l'upload de plusieurs fichiers" --
    // jusque-là un seul fichier possible par message) :
    // - image -> /api/chat a besoin de l'URL finale dans image_url/
    //   image_urls (voir api/chat.py + core/main.py:chat(), branche
    //   image_url -- routage direct vers Gemini, seul modèle multimodal
    //   de la cascade).
    // - PDF/Word/Excel -> texte extrait côté backend (voir
    //   api/uploads.py:uploader_document_chat) et injecté APRÈS le texte
    //   de l'étudiant, jamais à la place -- le cascade Groq habituel le
    //   traite comme du texte normal, aucun changement de modèle requis.
    // - vidéo (2026-07-20) -> traitement combiné : la piste audio est
    //   transcrite (Whisper) et injectée comme texte (comme un document),
    //   les frames image sont envoyées à Gemini (comme des images) --
    //   voir api/uploads.py:uploader_video_chat et core/main.py:chat(),
    //   paramètre images_base64.
    //
    // Chaque fichier est indépendant (Promise.allSettled, pas Promise.all) :
    // demande explicite de Bourama, "les autres partent, erreur juste pour
    // celui qui échoue" -- un PDF scanné sans texte, par exemple, ne doit
    // plus faire échouer tout le message si une image valide l'accompagne.
    const imageUrls: string[] = [];
    const imagesBase64: string[] = [];
    let texteEnrichi = texteColle ? `${texte}\n\n[Texte collé joint]\n${texteColle}` : texte;

    if (fichiers.length) {
      const resultats = await Promise.allSettled(
        fichiers.map(async (fichier) => {
          const type = typeDeFichier(fichier);
          if (type === "image") {
            const url = await uploaderImageChat(fichier);
            // Le lien réel doit aussi être en TEXTE dans le message, pas
            // seulement envoyé à part pour l'analyse visuelle (image_url) --
            // sinon l'IA "voit" l'image via la vision mais n'a jamais son
            // adresse réelle en mémoire, et invente un lien si on la lui
            // redemande plus tard (repéré en test réel, 2026-07-23).
            return { imageUrl: url, texteBloc: `\n\n[Image jointe : ${url}]` };
          }
          if (type === "audio") {
            const { texte: texteAudio, url: urlAudio } = await transcrireAudioChat(fichier);
            const lienAudio = urlAudio ? `\n[Lien réel du fichier : ${urlAudio}]` : "";
            return { texteBloc: `\n\n[Audio joint : ${fichier.name} -- transcription]\n${texteAudio}${lienAudio}` };
          }
          if (type === "video") {
            const { transcript, frames_base64, url: urlVideo } = await uploaderVideoChat(fichier);
            const lienVideo = urlVideo ? `\n[Lien réel du fichier : ${urlVideo}]` : "";
            const texteBloc = transcript
              ? `\n\n[Vidéo jointe : ${fichier.name} -- transcription audio]\n${transcript}${lienVideo}`
              : `\n\n[Vidéo jointe : ${fichier.name} -- pas de son exploitable, images seules]${lienVideo}`;
            return { texteBloc, imagesBase64: frames_base64.length ? frames_base64 : undefined };
          }
          const { texte: texteDocument, tronque, url: urlDocument, url_apercu: urlApercu } = await uploaderDocumentChat(fichier);
          const lienDocument = urlDocument ? `\n[Lien réel du fichier : ${urlDocument}]` : "";
          // Aperçu PDF (25/07) : lien séparé, volontairement en .pdf --
          // FichierChip.tsx détecte l'extension et affiche automatiquement
          // le visualiseur PDF intégré pour ce lien, sans aucun changement
          // nécessaire dans FichierChip.tsx lui-même (voir core/conversion_pdf.py).
          const lienApercu = urlApercu ? `\n[Aperçu visuel du fichier (PDF) : ${urlApercu}]` : "";
          return {
            texteBloc: `\n\n[Document joint : ${fichier.name}${tronque ? " (tronqué)" : ""}]\n${texteDocument}${lienDocument}${lienApercu}`,
          };
        })
      );

      const echecs: { nom: string; typeFichier: "image" | "document" | "video" | "audio"; detail: string }[] = [];
      resultats.forEach((resultat, index) => {
        const fichier = fichiers[index];
        if (resultat.status === "fulfilled") {
          texteEnrichi += resultat.value.texteBloc;
          if (resultat.value.imageUrl) imageUrls.push(resultat.value.imageUrl);
          if (resultat.value.imagesBase64) imagesBase64.push(...resultat.value.imagesBase64);
        } else {
          // Même correction que pour la dictée vocale (2026-07-20) : le
          // message générique masquait la vraie cause (format refusé,
          // fichier trop lourd, erreur serveur précise...) derrière un seul
          // texte, impossible à diagnostiquer depuis le retour utilisateur.
          echecs.push({ nom: fichier.name, typeFichier: typeDeFichier(fichier), detail: messageErreur(resultat.reason) || "erreur inconnue" });
        }
      });

      if (echecs.length) {
        // Marque en erreur, dans la bulle utilisateur déjà affichée, juste
        // les pièces jointes qui ont échoué -- les autres gardent leur
        // aperçu normal, rien n'est retiré silencieusement.
        majMessages((prec) =>
          prec.map((m) =>
            m === messageUtilisateur
              ? {
                  ...m,
                  piecesJointes:
                    m.piecesJointes?.map((p) => {
                      const echec = echecs.find((e) => e.nom === p.nom);
                      return echec ? { ...p, erreur: echec.detail } : p;
                    }) ?? null,
                }
              : m
          )
        );
      }

      if (echecs.length === fichiers.length && !texte.trim() && !texteColle) {
        // Cas limite : absolument aucun fichier n'a pu être traité, et pas
        // de texte à côté pour porter le message quand même -- rien
        // d'utile à envoyer au modèle.
        majMessages((prec) => {
          const copie = [...prec];
          copie[copie.length - 1] = {
            ...copie[copie.length - 1],
            content: "Aucun des fichiers joints n'a pu être traité, réessaie.",
          };
          return copie;
        });
        setGenEnCours(false);
        return;
      }
    }

    try {
      await appelerApiStream(
        "/api/chat",
        {
          message: texteEnrichi,
          agent_id: agentId,
          historique: historiquePourApi,
          conversation_id: conversationId,
          longueur_reponse: longueur,
          image_url: null,
          image_urls: imageUrls.length ? imageUrls : null,
          images_base64: imagesBase64.length ? imagesBase64 : null,
          localisation,
          // Fuseau du navigateur, pas une valeur figée côté code -- voir
          // core/main.py:chat(), paramètre fuseau_horaire.
          fuseau_horaire: Intl.DateTimeFormat().resolvedOptions().timeZone,
          // outil_force / ignorer_suggestion_outils : toujours []/false
          // pour clovis (2026-08-20, nettoyage) -- le menu manuel Outils
          // et le bouton "Aucun" ont été retirés du frontend (morts
          // depuis le kill-switch AFFICHER_BOUTON_OUTILS du 13/08 et le
          // passage de l'agent clovis en routeur_outils_auto=true côté
          // backend). Champs gardés car l'API core/mcp_tools.py:
          // lister_tous_les_outils les attend toujours pour d'autres
          // agents (ex. nucleos) qui utilisent un autre frontend.
          outil_force: [],
          ignorer_suggestion_outils: false,
          // Bouton "Sans enseignant" (06/08/2026, demande Bourama) --
          // uniquement pour les agents à contenu dynamique par matière
          // (Clovis) : force le prompt généraliste pour CE message
          // précis, sans passer par le routeur de matière ni utiliser le
          // contenu d'aucun enseignant, même si l'étudiant a des
          // matières débloquées. Voir core/contenu_dynamique_matiere.py.
          sans_enseignant: sansEnseignant,
          // Appli installée (04/09/2026) -- voir prop `natif` ci-dessus.
          natif,
          // Selecteur de modele premium (02/08/2026) -- null tant que
          // l'agent n'a rien debloque ou que l'utilisateur n'a pas
          // change le defaut, voir modeleSelectionne plus haut. Revalide
          // cote backend avant d'etre honore (api/chat.py:_resoudre_modele_force).
          modele: modeleSelectionne,
        },
        (evenement) => traiterEvenement(evenement)
      );
    } catch (e) {
      reinitialiserAffichageControle();
      majMessages((prec) => {
        const copie = [...prec];
        copie[copie.length - 1] = {
          ...copie[copie.length - 1],
          content: "Une erreur est survenue, réessaie dans un instant.",
          erreur: true,
        };
        return copie;
      });
    } finally {
      setGenEnCours(false);
    }
  }

  function regenererDepuis(index: number) {
    // index = position du message ASSISTANT à régénérer ; on renvoie le
    // message utilisateur juste avant, et on retire les deux de la liste
    // affichée avant de les recréer via envoyerMessage.
    const messageUtilisateur = messages[index - 1];
    if (!messageUtilisateur) return;
    majMessages((prec) => prec.slice(0, index - 1));
    envoyerMessage(messageUtilisateur.content, "moyenne", []);
  }

  function editerMessage(index: number, nouveauTexte: string) {
    // Tronque tout ce qui suit (y compris la réponse assistant concernée)
    // et relance avec le message modifié -- section 3.1.
    majMessages((prec) => prec.slice(0, index));
    envoyerMessage(nouveauTexte, "moyenne", []);
  }

  function expliquerSelection(texteSelectionne: string) {
    // Signal non textuel (sélection de souris/tactile dans une réponse
    // assistant) converti en message texte classique -- pas de nouveau
    // champ backend, juste un prompt construit côté frontend.
    envoyerMessage(`Peux-tu expliquer ce passage : "${texteSelectionne}"`, "moyenne", []);
  }

  async function repriseApresConfirmation(approuve: boolean) {
    if (!confirmation) return;
    setConfirmationEnAttente(true);
    reinitialiserAffichageControle();
    setGenEnCours(true);
    try {
      await appelerApiStream(
        "/api/chat",
        { reprise: { etat_reprise: confirmation.etatReprise, approuve } },
        (evenement) => traiterEvenement(evenement)
      );
    } catch (e) {
      reinitialiserAffichageControle();
      majMessages((prec) => {
        const copie = [...prec];
        copie[copie.length - 1] = {
          ...copie[copie.length - 1],
          content: "Une erreur est survenue, réessaie dans un instant.",
          erreur: true,
        };
        return copie;
      });
    } finally {
      setConfirmation(null);
      setConfirmationEnAttente(false);
      setGenEnCours(false);
    }
  }

  // Marge de tolérance : "proche du bas" plutôt qu'exactement au pixel
  // près, pour rester collé même avec une légère imprécision de mesure
  // (fréquent sur mobile pendant l'animation d'ouverture du clavier).
  function estPresDuBas() {
    const el = conteneurMessagesRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  useEffect(() => {
    if (collePresBasRef.current) {
      finDesMessagesRef.current?.scrollIntoView({ block: "end" });
    }
    // Se redéclenche à chaque octet reçu en streaming (content grandit),
    // pas seulement à l'ajout d'un message -- sinon le scroll se fige dès
    // la première ligne d'une réponse longue.
  }, [messages, statuts, raisonnementEnCours]);

  // Écran de démarrage centré (09/08, demande Bourama : "exact au
  // démarrage" par rapport à Claude -- pas le thème de couleurs, la
  // mise en page). Tant qu'il n'y a aucun message -- que ce soit au tout
  // premier chargement OU après un clic sur "Nouvelle conversation"
  // (messages.length repasse à 0 côté parent, voir page.tsx) -- le titre
  // d'accueil et la barre de saisie sont centrés verticalement au milieu
  // de l'écran, comme sur claude.ai, plutôt qu'affichés en haut d'une
  // zone de messages vide avec la barre de saisie plaquée en bas. Dès
  // l'envoi du premier message, messages.length > 0 et on retombe sur la
  // mise en page normale (liste défilante + barre fixée en bas) plus
  // bas dans ce fichier.
  if (messages.length === 0) {
    return (
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col items-center justify-center px-4">
        <div className="w-full max-w-xl animate-dj-fade-up">
          {titreAccueil ? (
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="flex items-center gap-3">
                <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden">
                  {iconePersonnalisee ? (
                    iconePersonnalisee
                  ) : iconeUrl ? (
                    <Image src={iconeUrl} alt="" fill className="object-cover" sizes="48px" />
                  ) : (
                    <IconeGenerique className="h-9 w-9 text-dj-accent-1-texte" />
                  )}
                </span>
                <h1 className="font-display text-3xl font-bold tracking-[-0.01em] text-dj-texte sm:text-4xl">{titreRevele}</h1>
              </div>
            </div>
          ) : (
            <p className="mb-8 text-center text-base text-dj-texte-muet">Pose ta question à {nomAgent}...</p>
          )}
          <BarreDeSaisie
            onEnvoyer={envoyerMessage}
            desactive={genEnCours || affichageEnCours}
            agentId={agentId}
            modelesDisponibles={modelesDisponibles}
            modeleSelectionne={modeleSelectionne}
            onModeleChange={setModeleSelectionne}
            boutonSansEnseignant={boutonSansEnseignant}
            outilsActifsAgent={outilsActifsAgent}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
      <div
        ref={conteneurMessagesRef}
        onScroll={() => {
          collePresBasRef.current = estPresDuBas();
        }}
        className="flex-1 space-y-5 overflow-y-auto px-4 py-6">
        {messages.map((message, index) => {
          const estDernier = index === messages.length - 1;
          return (
            <div key={index}>
              <BulleMessage
                message={message}
                nomAgent={nomAgent}
              // Rattachés à CE message précis plutôt qu'en bloc séparé plus
              // bas dans la liste (retour Bourama 24/07 : trop loin du
              // message, le raisonnement semblait "disparaître" une fois
              // replié en bas). enAttente : rien reçu encore (ni statut, ni
              // raisonnement, ni texte) -- disparaît dès le premier des
              // trois.
              enAttente={
                estDernier &&
                genEnCours &&
                message.role === "assistant" &&
                message.content === "" &&
                statuts.length === 0 &&
                !message.raisonnement
              }
              estEnCoursDeGeneration={estDernier && affichageEnCours && message.role === "assistant"}
              raisonnement={message.raisonnement}
              raisonnementEnCours={estDernier ? raisonnementEnCours : false}
              outilsResultats={message.outilsResultats}
              onRegenerer={
                message.role === "assistant"
                  ? () => regenererDepuis(index)
                  : () => envoyerMessage(message.content, "moyenne", [])
              }
              onEditer={message.role === "user" ? (texte) => editerMessage(index, texte) : undefined}
              onLike={
                message.role === "assistant"
                  ? () =>
                      message.id
                        ? setPopupFeedback({ type: "positif", messageId: message.id!, questionMessageId: messages[index - 1]?.id ?? null })
                        : alert("Connecte-toi pour noter Clovis.")
                  : undefined
              }
              onDislike={
                message.role === "assistant"
                  ? () =>
                      message.id
                        ? setPopupFeedback({ type: "negatif", messageId: message.id!, questionMessageId: messages[index - 1]?.id ?? null })
                        : alert("Connecte-toi pour noter Clovis.")
                  : undefined
              }
              onExpliquerSelection={message.role === "assistant" ? expliquerSelection : undefined}
              />
              {message.repriseDisponible && (
                <BoutonRepriseAgent
                  type={message.repriseDisponible.type}
                  enAttente={genEnCours}
                  onReprendre={() => reprendreAgent(index)}
                />
              )}
            </div>
          );
        })}

        {statuts.length > 0 && (
          <div className="max-w-[80%]">
            {statuts.map((s, i) => (
              <StatutOutil key={i} texte={s.texte} etat={s.etat} />
            ))}
          </div>
        )}

        {confirmation && (
          <ConfirmationOutil
            nomLisible={confirmation.nomLisible}
            agentNom={confirmation.agentNom}
            arguments={confirmation.arguments}
            enAttente={confirmationEnAttente}
            onConfirmer={() => repriseApresConfirmation(true)}
            onAnnuler={() => repriseApresConfirmation(false)}
          />
        )}
        <div ref={finDesMessagesRef} />
      </div>

      {/* pb via var(--safe-bottom) (2026-07-30, durci tâche 4 le
          30/08/2026) : marge pour la barre d'accueil iOS (encoche du bas)
          en plus du pb-6 existant -- s'additionne, ne le remplace pas
          (viewport-fit=cover posé dans app/layout.tsx rend cette variable
          non nulle sur iPhone, et sur Android via l'injection Capacitor,
          voir app/globals.css).
          Correctif (05/09/2026, Bourama : "l'appli deborde en haut et en
          bas") : l'ajout de --cap-native-navigation-bottom (26/08/2026)
          partait d'une hypothèse fausse -- la barre d'onglets native
          (BarreOngletsNative.tsx) est en fait masquée dès que le chat
          passe en plein écran (hidden: etatChat === "plein_ecran"), donc
          rien à réserver pour elle ici, et cette variable y valait de
          toute façon toujours 0px (voir explication complète dans
          app/globals.css). Retiré : --safe-bottom seul couvre le vrai
          besoin (la zone système du bas). */}
      <div className="px-4 [padding-bottom:calc(var(--safe-bottom)+1.5rem)]">
        <BarreDeSaisie
          onEnvoyer={envoyerMessage}
          desactive={genEnCours || affichageEnCours}
          agentId={agentId}
          modelesDisponibles={modelesDisponibles}
          modeleSelectionne={modeleSelectionne}
          onModeleChange={setModeleSelectionne}
          boutonSansEnseignant={boutonSansEnseignant}
          outilsActifsAgent={outilsActifsAgent}
        />
      </div>

      {popupFeedback && (
        <PopupFeedback
          type={popupFeedback.type}
          conversationId={conversationId}
          messageId={popupFeedback.messageId}
          questionMessageId={popupFeedback.questionMessageId}
          agentId={agentId}
          onFerme={() => setPopupFeedback(null)}
          onEnvoye={() => setPopupFeedback(null)}
        />
      )}
      <VisionneurPositionGlobal />
    </div>
  );
}
