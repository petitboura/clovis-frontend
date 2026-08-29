"use client";

import { useEffect, useRef, useState, useMemo, isValidElement, ReactNode, memo } from "react";
import ReactMarkdown from "react-markdown";
import type { PluggableList } from "unified";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeKatex from "rehype-katex";
import { Copy, RotateCw, Pencil, Volume2, ThumbsUp, ThumbsDown, Check, MessageSquareQuote, FileText, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { formaterHeure } from "@/lib/formatageHeure";
import dynamic from "next/dynamic";
import { BlocCode } from "./BlocCode";
import { Mermaid } from "./Mermaid";
import { CarteMessage } from "./CarteMessage";
import { IndicateurReflexion } from "@/components/IndicateurReflexion";
import { SchemaGeometrique } from "./SchemaGeometrique";
import { WidgetSandbox } from "./WidgetSandbox";
import { ImageMessage } from "./ImageMessage";
import { VisionneuseImage } from "./VisionneuseImage";
import { TableauMessage } from "./TableauMessage";
import { FichierChip, extensionFichier } from "./FichierChip";
import { FichierCode, extensionCode } from "./FichierCode";
import { LecteurMedia, typeMedia } from "./LecteurMedia";
import { NoteTexteChip, estNoteTexteBibliotheque } from "./NoteTexteChip";
import { LinkPreview } from "./LinkPreview";
import { RaisonnementBulle } from "./RaisonnementBulle";
import { OutilResultatBulle } from "./OutilResultatBulle";
import { ouvrirPosition } from "./visionneurPositionEvenement";
import { Skeleton } from "../Skeleton";

// Chargé à la demande (pas en haut du bundle du chat) : recharts ne sert
// que si le message contient effectivement un bloc ```chart, et son
// ResponsiveContainer ne rend rien d'utile côté serveur de toute façon
// (mesures de pixels réelles nécessaires) -- ssr:false assumé.
const GraphiqueDonnees = dynamic(() => import("./GraphiqueDonnees").then((m) => m.GraphiqueDonnees), {
  ssr: false,
  loading: () => <Skeleton className="h-[260px] w-full rounded-xl border border-dj-bordure" />,
});

// Perf (10/08) : listes de plugins ReactMarkdown constantes, sorties du
// composant. Définies inline dans le JSX, elles seraient recréées en
// nouvelle référence à chaque rendu -- donc à chaque chunk reçu en
// streaming pour le message en cours -- alors que leur contenu ne
// change jamais. Même valeurs qu'avant, juste calculées une seule fois.
const PLUGINS_REMARK: PluggableList = [remarkGfm, remarkMath];
// rehype-sanitize retire par défaut tout href dont le "protocole" n'est
// pas dans une liste blanche (http/https/mailto...) -- il faut y ajouter
// "citation" explicitement, sinon [n](citation:n) (26/08, voir a() plus
// bas) se ferait vider de son href AVANT même d'atteindre notre
// composant personnalisé, silencieusement.
const SCHEMA_SANITIZE = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    href: [...(defaultSchema.protocols?.href ?? []), "citation"],
  },
};

const PLUGINS_REHYPE: PluggableList = [rehypeRaw, [rehypeSanitize, SCHEMA_SANITIZE], rehypeKatex];

// Noeud HAST minimal -- on ne type que ce dont pluginMotsFade a besoin,
// pas la forme complète de hast.Node (évite d'ajouter @types/hast comme
// dépendance juste pour ce plugin interne).
type NoeudHastPartiel = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: NoeudHastPartiel[];
};

// Plugin rehype interne (branché UNIQUEMENT sur le message assistant en
// cours de génération, voir estEnCoursDeGeneration dans le composant) :
// parcourt le HAST FINAL -- donc après resolution complète du Markdown
// par remark/rehype (gras, italique, liens, LaTeX déjà en éléments) --
// et enveloppe chaque MOT dans un <span class="dj-mot-fade"> pour qu'il
// fonde en fondu à sa première apparition. `seuil` = nombre de mots déjà
// révélés lors d'un rendu précédent (voir motsDejaAnimesRef dans
// BulleMessage) : en dessous, texte brut, jamais ré-animé.
// `rapporterTotal` reçoit le nombre total de mots vus, pour que le
// composant puisse mettre à jour ce seuil après le rendu.
// Ignore le contenu de <pre>/<code> : les découper casserait
// l'espacement/la coloration syntaxique, et le code arrive de toute
// façon rarement de façon lisible mot par mot.
function pluginMotsFade(options: { seuil: number; rapporterTotal: (n: number) => void }) {
  const { seuil, rapporterTotal } = options;
  let indexGlobal = 0;

  function visiter(noeud: NoeudHastPartiel): NoeudHastPartiel | NoeudHastPartiel[] {
    if (noeud.type === "element" && (noeud.tagName === "pre" || noeud.tagName === "code")) {
      return noeud;
    }
    if (noeud.type === "text" && typeof noeud.value === "string") {
      const morceaux = noeud.value.split(/(\s+)/).filter((p) => p.length > 0);
      if (morceaux.length === 0) return noeud;
      const resultat: NoeudHastPartiel[] = [];
      for (const morceau of morceaux) {
        if (/^\s+$/.test(morceau)) {
          resultat.push({ type: "text", value: morceau });
          continue;
        }
        const monIndex = indexGlobal;
        indexGlobal += 1;
        if (monIndex >= seuil) {
          resultat.push({
            type: "element",
            tagName: "span",
            properties: { className: ["dj-mot-fade"] },
            children: [{ type: "text", value: morceau }],
          });
        } else {
          resultat.push({ type: "text", value: morceau });
        }
      }
      return resultat;
    }
    if (noeud.children) {
      const nouveauxEnfants: NoeudHastPartiel[] = [];
      for (const enfant of noeud.children) {
        const r = visiter(enfant);
        if (Array.isArray(r)) nouveauxEnfants.push(...r);
        else nouveauxEnfants.push(r);
      }
      noeud.children = nouveauxEnfants;
    }
    return noeud;
  }

  return function transformer(tree: NoeudHastPartiel) {
    visiter(tree);
    rapporterTotal(indexGlobal);
  };
}

// Extrait le texte brut d'un enfant React -- nécessaire pour récupérer le
// contenu source d'un bloc de code (```lang ... ```) tel que ReactMarkdown
// le structure : <pre><code className="language-xxx">texte brut</code></pre>.
function texteBrut(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(texteBrut).join("");
  if (isValidElement(node)) return texteBrut((node.props as { children?: ReactNode }).children);
  return "";
}

// Nettoie le markdown avant lecture à voix haute (Web Speech API, voir
// lireAVoixHaute() dans le composant) -- sans ça, la synthèse vocale lit
// les symboles bruts tels quels (dièses, astérisques, syntaxe de lien),
// ce qui donne une lecture pénible à l'oreille. Volontairement simple
// (regex, pas un vrai parseur) : le but est une lecture agréable, pas
// une reconstruction fidèle -- les blocs de code sont carrément sautés
// (lire du code à voix haute n'a pas de sens).
function nettoyerMarkdownPourLecture(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, " ") // blocs de code entiers
    .replace(/`([^`]+)`/g, "$1") // code inline -> juste le texte
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // liens -> juste le libellé
    .replace(/^#{1,6}\s+/gm, "") // titres
    .replace(/\*\*([^*]+)\*\*/g, "$1") // gras
    .replace(/\*([^*]+)\*/g, "$1") // italique
    .replace(/^[-*+]\s+/gm, "") // puces de liste
    .replace(/^\d+\.\s+/gm, "") // listes numérotées
    .trim();
}

// Le modèle mélange parfois du HTML brut dans son Markdown (le plus
// courant : "<br>" pour forcer un retour à la ligne dans une liste ou une
// cellule de tableau -- signalé par Bourama, ça s'affichait juste comme
// du texte littéral "<br>-"). Sans plugin dédié, remark/react-markdown
// n'interprète JAMAIS le HTML brut du Markdown source : il l'échappe et
// l'affiche tel quel, par sécurité. rehype-raw le fait redevenir de
// vraies balises ; rehype-sanitize passe juste derrière pour retirer tout
// ce qui serait dangereux (<script>, attributs on*...) si jamais le
// modèle en générait -- le schéma par défaut (celui de GitHub) autorise
// déjà <br>, les tableaux, listes, etc.

// Le modèle (GPT-OSS/Groq) écrit ses formules avec les délimiteurs
// \( \) et \[ \] (convention OpenAI-like). Mais en Markdown (CommonMark,
// ce que suit remark), un backslash suivi de ponctuation ( \( \) \[ \] )
// est traité comme un caractère ÉCHAPPÉ : le backslash est supprimé AVANT
// même que remark-math ne voie le texte, ce qui laisse des crochets/
// parenthèses nus et casse tout rendu LaTeX (même bug que dans l'ancien
// chat.py Streamlit, voir _normaliser_latex -- même cause, même remède,
// juste porté ici côté JS). On convertit donc systématiquement vers les
// délimiteurs $ $ / $$ $$, que remark-math sait consommer directement et
// que CommonMark ne touche pas (le $ n'a pas de sens spécial pour lui).
function normaliserLatex(texte: string): string {
  return texte
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, formule) => `$$${formule}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, formule) => `$${formule}$`);
}

export interface MessageAffiche {
  id: number | null; // id historique_conversations (null tant que non persisté, ex: pendant le streaming)
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  // Ajouté 2026-07-20 (bug trouvé par Bourama : aucun aperçu du fichier
  // envoyé, ni avant ni après envoi) -- previewUrl est une URL locale
  // (URL.createObjectURL, voir BarreDeSaisie.tsx) pour une image, donc
  // valable seulement le temps de la session ; pas besoin de la faire
  // survivre à un rechargement de page, juste de montrer ce qui a été
  // envoyé dans le fil de la conversation en cours.
  // Devenu un TABLEAU le 17/08 (demande Bourama : "permet l'upload de
  // plusieurs fichiers dans le chat") -- un message peut désormais avoir
  // zéro, un ou plusieurs fichiers joints. `erreur` (même date) : nom
  // affiché avec un état "échec" plutôt que retiré silencieusement, pour
  // le cas où un fichier précis n'a pas pu être uploadé/lu alors que les
  // autres, eux, sont bien partis (voir ChatIA.tsx:envoyerMessage).
  piecesJointes?: { nom: string; type: "image" | "document" | "video" | "audio"; previewUrl?: string; erreur?: string }[] | null;
  // Ajouté 2026-07-26 (demande Bourama) : true quand cette réponse précise
  // a été générée par un modèle de secours de qualité nettement réduite
  // (llama-3.1-8b-instant, tout dernier recours Groq avant Gemini -- voir
  // MODELES_QUALITE_REDUITE dans core/main.py) plutôt que par le modèle
  // principal. Affiché comme petit indice discret sous le message pour que
  // l'utilisateur ne juge pas la qualité habituelle de la plateforme
  // là-dessus.
  qualiteReduite?: boolean;
  // Ajoute le 02/08/2026 (Bourama : "on va ajouter Claude, GPT et
  // DeepSeek" -- feature modeles premium, voir core/fournisseurs_llm.py).
  // LABEL lisible (ex: "Claude Sonnet 5"), pas le modele_id technique --
  // deja resolu cote ChatIA.tsx via la liste modelesDisponibles de
  // l'agent. undefined/null = pas affiche du tout : NI pour les reponses
  // Groq/Gemini par defaut (jamais montrees a l'utilisateur, demande
  // explicite de Bourama "les autres non"), NI pour un vieux message
  // d'avant cette feature (colonne modele NULL en base).
  modele?: string | null;
  // Ajouté 2026-07-26 (bug trouvé par Bourama : le raisonnement et les
  // sources disparaissaient dès qu'on posait la question suivante --
  // avant ce fix, ils vivaient uniquement dans un state séparé de
  // ChatIA.tsx rattaché au "dernier" message, donc plus rien ne les
  // affichait une fois ce message relégué au second plan. Désormais
  // attachés DIRECTEMENT au message concerné, comme n'importe quel autre
  // champ de son contenu -- persistent tant que la conversation reste
  // affichée (pas encore sauvegardés en base, voir limite plus bas).
  raisonnement?: string;
  // Généralisation (26/07, demande Bourama) : ce que CHAQUE outil utilisé
  // a concrètement exécuté/retourné, dans l'ordre chronologique réel des
  // appels -- distinct du raisonnement libre du modèle. Les sources
  // d'une recherche sont attachées à SON entrée précise (pas à un champ
  // séparé du message) : elles doivent apparaître juste après le
  // résultat de leur outil, pas dans un bloc "Sources" à part à la fin
  // -- voir OutilResultatBulle.tsx.
  outilsResultats?: { nomOutil: string; nomLisible: string; resultat: string; sources?: { titre: string; url: string; extrait?: string; url_extrait?: string; reperage?: string; position_type?: "page" | "timestamp"; position_valeur?: number; type_mime?: string | null }[] }[];
  // Ajouté 2026-07-28 (demande Bourama) : lien(s) de fichier(s) générés
  // par un outil, détectés côté backend de façon garantie (voir
  // core/main.py, événement SSE "fichiers_generes") -- INDÉPENDANT de ce
  // que le modèle écrit dans sa réponse texte, pour ne plus dépendre de
  // sa fidélité à recopier le lien correctement. Affiché en carte fichier
  // (FichierChip.tsx) à la fin du message, une entrée par appel d'outil,
  // dans l'ordre chronologique réel (même logique que outilsResultats).
  fichiersGeneres?: { nomOutil: string; fichiers: { url: string; nom: string }[] }[];
}

// Ajouté le 2026-07-23 (bug repéré par Bourama : en rechargeant un fil de
// conversation depuis l'historique, la bulle utilisateur affichait le
// texte "enrichi" tel quel -- transcription audio/vidéo complète, texte
// extrait d'un document, bloc [Lien réel du fichier : ...] -- au lieu du
// message réellement tapé. Cause : ChatIA.tsx construit ce texte enrichi
// côté client puis l'envoie à /api/chat comme SEUL "message" ; le backend
// le sauvegarde tel quel (pas de champ séparé pour le texte "propre" vs
// le contexte destiné au modèle). Pendant la session en cours, la bulle
// affichée utilise encore `texte` (la variable propre, jamais écrasée) --
// le problème n'apparaît qu'au rechargement, une fois qu'il ne reste plus
// que le contenu persisté en base à afficher.
//
// Corrige l'AFFICHAGE seul (aucun changement backend) : détecte les 4
// marqueurs injectés par ChatIA.tsx et reconstruit un texte propre + les
// piecesJointes (avec l'URL réelle de chaque fichier, toujours valable
// après rechargement contrairement à previewUrl qui était une URL locale
// éphémère).
//
// Généralisé à PLUSIEURS blocs le 17/08 (upload multi-fichiers, demande
// Bourama) : ChatIA.tsx concatène désormais un bloc "\n\n[Type joint(e) :
// ...]" par fichier envoyé, dans l'ordre. Avant ce changement, seule la
// PREMIÈRE occurrence était reconstruite et tout ce qui suivait (texte
// éventuel + autres fichiers) était perdu -- sans conséquence tant qu'un
// seul fichier par message était possible, mais aurait silencieusement
// tronqué l'affichage dès qu'un deuxième bloc apparaissait.
const MARQUEURS_PIECE_JOINTE: { motif: RegExp; type: "image" | "document" | "video" | "audio" }[] = [
  { motif: /\[Image jointe : /, type: "image" },
  { motif: /\[Audio joint : /, type: "audio" },
  { motif: /\[Vidéo jointe : /, type: "video" },
  { motif: /\[Document joint : /, type: "document" },
];
// Repère le début de CHAQUE bloc pièce jointe dans le texte (peu importe
// le type), pour pouvoir découper le contenu en segments un par un.
const DEBUT_BLOC_PIECE_JOINTE = /\n\n\[(?:Image jointe|Audio joint|Vidéo jointe|Document joint) : /g;

function extraireUneBloc(bloc: string): { nom: string; type: "image" | "document" | "video" | "audio"; previewUrl?: string } | null {
  const correspondance = MARQUEURS_PIECE_JOINTE.find(({ motif }) => motif.test(bloc));
  if (!correspondance) return null;
  const { type } = correspondance;

  // Nom du fichier : entre "jointe/joint : " et le premier "]" ou " -- ".
  // Cas particulier image : le marqueur ne contient que l'URL, pas de nom
  // -- on prend le dernier segment du chemin en repli.
  const nomMatch = /(?:Audio joint|Vidéo jointe|Document joint) : ([^\]\n]+?)(?:\]| -- )/.exec(bloc);
  let nom = nomMatch ? nomMatch[1].trim() : "fichier";
  if (type === "image") {
    const urlImage = /\[Image jointe : (.+?)\]/.exec(bloc)?.[1] ?? "";
    nom = urlImage.split("/").pop()?.split("?")[0] || "image";
  }
  // Retire un éventuel " (tronqué)" laissé par le marqueur document.
  nom = nom.replace(/\s*\(tronqué\)$/, "");

  // URL réelle du fichier : toujours en toute fin de bloc si présente
  // (image : c'est directement le contenu entre crochets ; les 3
  // autres : "[Lien réel du fichier : URL]" en dernière ligne).
  const urlMatch =
    type === "image"
      ? /\[Image jointe : (.+?)\]/.exec(bloc)
      : /\[Lien réel du fichier : (.+?)\]/.exec(bloc);
  const url = urlMatch ? urlMatch[1].trim() : undefined;

  return { nom, type, previewUrl: url };
}

export function nettoyerMessageHistorique(content: string): {
  texte: string;
  piecesJointes: MessageAffiche["piecesJointes"];
} {
  // Texte collé (2026-07-23) : pas un "fichier" comme les 4 marqueurs
  // ci-dessous (pas d'URL, pas de pieceJointe type -- juste un pavé de
  // texte à ne pas réafficher en entier au rechargement, même bug que
  // celui corrigé plus haut pour audio/vidéo/image/document). Repli
  // simple : on le retire du texte affiché, sans reconstruire de puce.
  const collageMotif = /\n\n\[Texte collé joint\]\n[\s\S]*$/;
  content = content.replace(collageMotif, "");

  const debuts = [...content.matchAll(DEBUT_BLOC_PIECE_JOINTE)].map((m) => m.index ?? -1).filter((i) => i >= 0);
  if (debuts.length === 0) {
    return { texte: content, piecesJointes: null };
  }

  const texte = content.slice(0, debuts[0]);
  const piecesJointes: NonNullable<MessageAffiche["piecesJointes"]> = [];
  for (let i = 0; i < debuts.length; i++) {
    const fin = i + 1 < debuts.length ? debuts[i + 1] : content.length;
    const bloc = content.slice(debuts[i], fin);
    const piece = extraireUneBloc(bloc);
    if (piece) piecesJointes.push(piece);
  }

  return { texte, piecesJointes: piecesJointes.length ? piecesJointes : null };
}

// - heure affichée sous le message UTILISATEUR uniquement
// - boutons différents selon le rôle
function BulleMessageInterne({
  message,
  onRegenerer,
  onEditer,
  onLike,
  onDislike,
  onExpliquerSelection,
  nomAgent,
  enAttente,
  estEnCoursDeGeneration,
  raisonnement,
  raisonnementEnCours,
  outilsResultats,
  fichiersGeneres,
}: {
  message: MessageAffiche;
  onRegenerer?: () => void;
  onEditer?: (nouveauTexte: string) => void;
  onLike?: () => void;
  onDislike?: () => void;
  onExpliquerSelection?: (texteSelectionne: string) => void;
  // Ajouté 24/07 (retour Bourama : la bulle "réfléchit"/le raisonnement
  // apparaissaient trop loin du message, comme un bloc séparé en bas de
  // la liste au lieu d'être rattachés à CE message assistant précis).
  // raisonnement/outilsResultats viennent directement du message concerné
  // (persistent pour tous les messages, pas seulement le dernier -- voir
  // MessageAffiche) ; raisonnementEnCours reste le seul flag transitoire,
  // vrai uniquement pour le dernier message en cours de génération.
  nomAgent?: string;
  enAttente?: boolean;
  // Ajouté (demande Bourama) : vrai uniquement pour le dernier message
  // assistant pendant que son affichage (voir ChatIA.tsx : buffer +
  // ticker mot par mot, affichageEnCours) est encore en train de
  // rattraper le texte déjà reçu. Sert à activer pluginMotsFade
  // ci-dessous UNIQUEMENT pour ce message -- jamais pour un message déjà
  // terminé/historique.
  estEnCoursDeGeneration?: boolean;
  raisonnement?: string;
  raisonnementEnCours?: boolean;
  outilsResultats?: { nomOutil: string; nomLisible: string; resultat: string; sources?: { titre: string; url: string; extrait?: string; url_extrait?: string; reperage?: string; position_type?: "page" | "timestamp"; position_valeur?: number; type_mime?: string | null }[] }[];
  fichiersGeneres?: { nomOutil: string; fichiers: { url: string; nom: string }[] }[];
}) {
  const [copie, setCopie] = useState(false);
  const [pieceJointeOuverteIndex, setPieceJointeOuverteIndex] = useState<number | null>(null);
  const [enEdition, setEnEdition] = useState(false);

  // Citations inline dans le texte (26/08, demande Bourama : les sources
  // doivent apparaître à la fois AU FIL DU TEXTE, là où le modèle les
  // utilise, ET dans la liste complète en bas -- pas l'un OU l'autre).
  // Numérotation GLOBALE sur tout le message, dans l'ordre des appels
  // d'outils (identique à celle déjà affichée par SourcesBulle en bas) :
  // le modèle est instrui de placer un marqueur [n](citation:n) dans sa
  // propre réponse -- voir a() plus bas, qui résout "citation:n" contre
  // cette liste pour ouvrir la bonne source au clic, sans jamais afficher
  // le gros aperçu LinkPreview réservé aux vrais liens externes.
  const sourcesAplaties = useMemo(() => {
    const toutes: {
      titre: string;
      url: string;
      extrait?: string;
      url_extrait?: string;
      reperage?: string;
      position_type?: "page" | "timestamp";
      position_valeur?: number;
      type_mime?: string | null;
    }[] = [];
    for (const r of outilsResultats ?? []) {
      for (const s of r.sources ?? []) toutes.push(s);
    }
    return toutes;
  }, [outilsResultats]);
  const [texteEdition, setTexteEdition] = useState(message.content);
  const [enLecture, setEnLecture] = useState(false);
  const [fichiersOuverts, setFichiersOuverts] = useState(false);
  const estUtilisateur = message.role === "user";

  // Fade mot par mot, formatage live conservé (demande explicite de
  // Bourama : l'option "pulsation par bloc" tremblait et ne montrait pas
  // de vrai fondu -- voir historique). Le découpage se fait au niveau du
  // HAST FINAL (après remark/rehype/sanitize/katex, donc gras/italique/
  // liens/LaTeX déjà résolus -- voir pluginMotsFade plus bas et son
  // branchement dans PLUGINS_REHYPE). motsDejaAnimesRef retient combien
  // de mots ont déjà été révélés lors d'un rendu précédent : seuls les
  // mots au-delà de ce seuil reçoivent la classe d'animation pour CE
  // rendu ; totalMotsCourantRef reçoit, pendant le traitement du
  // Markdown, le nombre total de mots vus par le plugin -- l'effet
  // ci-dessous le recopie dans motsDejaAnimesRef une fois le rendu
  // commité, pour que ces mots ne se ré-animent plus au rendu suivant.
  //
  // Limite connue et acceptée (comme chez Streamdown, voir recherche) :
  // un marqueur de mise en forme (ex. "**") qui se ferme EXACTEMENT au
  // moment d'un chunk peut faire réapparaître d'un coup, sans fondu, le
  // passage concerné -- inhérent à l'analyse Markdown incrémentale
  // (impossible de savoir que c'est du gras avant la fermeture du
  // marqueur), pas un bug de notre plugin.
  const motsDejaAnimesRef = useRef(0);
  const totalMotsCourantRef = useRef(0);
  useEffect(() => {
    motsDejaAnimesRef.current = totalMotsCourantRef.current;
  }, [message.content, estEnCoursDeGeneration]);
  useEffect(() => {
    // Nouveau message (bulle vidée puis réutilisée, ex. régénération) :
    // repartir de zéro plutôt que de garder un seuil obsolète.
    if (message.content.length === 0) {
      motsDejaAnimesRef.current = 0;
      totalMotsCourantRef.current = 0;
    }
  }, [message.content.length]);


  // Sélection de texte -> "expliquer ce passage" (2026-07-20). Signal
  // utilisateur non textuel : on capte la sélection native du navigateur
  // dans la bulle assistant, pas un nouveau composant de sélection custom.
  const conteneurRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<{ texte: string; x: number; y: number } | null>(null);

  function gererFinSelection() {
    if (!onExpliquerSelection || estUtilisateur) return;
    const sel = window.getSelection();
    const texte = sel?.toString().trim();
    if (!sel || !texte || sel.rangeCount === 0 || !conteneurRef.current?.contains(sel.anchorNode)) {
      setSelection(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setSelection({ texte, x: rect.left + rect.width / 2, y: rect.top });
  }

  function copier() {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopie(true);
      setTimeout(() => setCopie(false), 1500);
    });
  }

  // Lecture à voix haute (2026-07-23, bouton jusqu'ici un placeholder) --
  // Web Speech API native du navigateur, pas de clé/coût/backend. Toggle :
  // cliquer pendant la lecture l'arrête (speechSynthesis.cancel()) plutôt
  // que de relancer une deuxième lecture par-dessus.
  function lireAVoixHaute() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("La lecture à voix haute n'est pas prise en charge par ce navigateur.");
      return;
    }
    if (enLecture) {
      window.speechSynthesis.cancel();
      setEnLecture(false);
      return;
    }
    // Un seul message lu à la fois sur toute la page -- annule toute
    // lecture en cours (y compris d'un autre message) avant de démarrer.
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(nettoyerMarkdownPourLecture(message.content));
    utterance.lang = "fr-FR";
    utterance.onend = () => setEnLecture(false);
    utterance.onerror = () => setEnLecture(false);
    setEnLecture(true);
    window.speechSynthesis.speak(utterance);
  }

  // Coupe la lecture si la bulle disparaît pendant qu'elle parle (ex:
  // régénération de la réponse, changement de conversation).
  useEffect(() => {
    return () => {
      if (enLecture && typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (enEdition) {
    return (
      <div className="ml-auto max-w-[80%] rounded-cgpt-carte bg-dj-surface p-3">
        <textarea
          value={texteEdition}
          onChange={(e) => setTexteEdition(e.target.value)}
          className="w-full resize-none rounded-lg bg-transparent text-sm text-dj-texte outline-none"
          rows={3}
          autoFocus
        />
        <div className="mt-2 flex justify-end gap-2 text-xs">
          <button
            onClick={() => setEnEdition(false)}
            className="rounded-md px-3 py-1.5 text-dj-texte-muet hover:text-dj-texte"
          >
            Annuler
          </button>
          <button
            onClick={() => {
              setEnEdition(false);
              onEditer?.(texteEdition);
            }}
            className="rounded-md bg-dj-accent-1 px-3 py-1.5 font-semibold text-[#1A0D02]"
          >
            Renvoyer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`group flex flex-col ${estUtilisateur ? "items-end" : "items-start"}`}>
      {/* Raisonnement tout en haut, avant le contenu de la réponse (31/07,
          demande Bourama) -- avant, ce bloc s'affichait après le texte de
          la réponse, ce qui ne reflétait pas l'ordre réel "le modèle
          réfléchit D'ABORD, répond ENSUITE". */}
      {!estUtilisateur && enAttente && (
        <IndicateurReflexion nomAgent={nomAgent ?? "Clovis"} />
      )}
      {!estUtilisateur && raisonnement && (
        <RaisonnementBulle nomAgent={nomAgent ?? "Clovis"} texte={raisonnement} enCours={!!raisonnementEnCours} />
      )}
      <div
        className={
          estUtilisateur
            ? "max-w-[80%] break-words rounded-cgpt-carte bg-dj-surface px-4 py-2.5 text-[15px] text-dj-texte"
            : "max-w-[80%] break-words px-1 py-1 font-lecture text-[16px] leading-relaxed text-dj-texte"
        }
      >
        {message.piecesJointes && message.piecesJointes.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {message.piecesJointes.map((piece, index) =>
              piece.erreur ? (
                // Fichier qui a échoué à l'upload (17/08) : les autres
                // pièces jointes/le message partent quand même, celle-ci
                // affiche juste son erreur au lieu d'être retirée en
                // silence.
                <div
                  key={index}
                  className="flex w-fit items-center gap-2 rounded-xl border border-red-400/40 bg-red-400/10 px-3 py-2 text-xs text-red-400"
                  title={piece.erreur}
                >
                  <FileText size={14} />
                  <span className="max-w-[220px] truncate">{piece.nom} -- {piece.erreur}</span>
                </div>
              ) : piece.type === "image" && piece.previewUrl ? (
                <button
                  key={index}
                  onClick={() => setPieceJointeOuverteIndex(index)}
                  aria-label="Agrandir l'image"
                  className="block max-h-48 overflow-hidden rounded-xl border border-dj-bordure"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (URL.createObjectURL), pas un asset à optimiser */}
                  <img src={piece.previewUrl} alt={piece.nom} className="max-h-48 w-auto" />
                </button>
              ) : (piece.type === "video" || piece.type === "audio") && piece.previewUrl ? (
                // Lecteur jouable directement dans le message envoyé
                // (2026-07-23) -- avant, seul un nom de fichier cliquable qui
                // ouvrait un nouvel onglet, aucun moyen d'écouter/regarder
                // sans quitter le chat.
                <div key={index} className="w-full max-w-xs">
                  <LecteurMedia href={piece.previewUrl} type={piece.type} />
                </div>
              ) : (
                <button
                  key={index}
                  onClick={() => piece.previewUrl && window.open(piece.previewUrl, "_blank")}
                  aria-label="Ouvrir le fichier"
                  className="flex w-fit items-center gap-2 rounded-xl border border-dj-bordure bg-dj-fond/40 px-3 py-2 text-xs text-dj-texte-muet hover:text-dj-texte"
                >
                  <FileText size={14} />
                  <span className="max-w-[220px] truncate">{piece.nom}</span>
                </button>
              )
            )}
          </div>
        )}
        {/* Rendu Markdown unique et cohérent (gras/liens/tableaux/listes en
            une seule fois) : ceci règle définitivement le bug hérité de
            Streamlit (bloc HTML brut qui empêchait toute transformation
            Markdown). Couleur des liens fixée sur l'accent de la charte,
            jamais bleu. */}
        <div
          ref={conteneurRef}
          onMouseUp={gererFinSelection}
          className="dj-markdown [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 last:[&_p]:mb-0 [&_h1]:font-lecture [&_h1]:font-semibold [&_h1]:tracking-[-0.01em] [&_h1]:text-dj-texte [&_h1]:text-xl [&_h1]:mb-2 [&_h1]:mt-3 [&_h2]:font-lecture [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:text-dj-texte [&_h2]:text-lg [&_h2]:mb-2 [&_h2]:mt-3 [&_h3]:font-lecture [&_h3]:font-semibold [&_h3]:tracking-[-0.01em] [&_h3]:text-dj-texte [&_h3]:text-base [&_h3]:mb-1.5 [&_h3]:mt-2"
        >
          {/* remarkGfm (tableaux/gras/liens) + remarkMath/rehypeKatex
              (LaTeX) tournent dans LA MÊME passe de parsing -- c'est ça
              qui évite le jeu de whack-a-mole où corriger le gras/les
              tableaux à la main cassait le LaTeX (ou l'inverse) : un seul
              moteur, cohérent, jamais de manipulation du texte brut à
              part la normalisation des délimiteurs ci-dessus. */}
          <ReactMarkdown
            remarkPlugins={PLUGINS_REMARK}
            rehypePlugins={
              // pluginMotsFade UNIQUEMENT pour le message en cours de
              // génération (voir estEnCoursDeGeneration) -- pour tous
              // les autres (messages déjà terminés/historique), on garde
              // la référence stable PLUGINS_REHYPE (voir le commentaire
              // "Perf 10/08" plus haut : recréer ce tableau à chaque
              // rendu a un coût, donc on ne le paie que là où c'est
              // nécessaire).
              estEnCoursDeGeneration
                ? [
                    ...PLUGINS_REHYPE,
                    [
                      pluginMotsFade,
                      {
                        seuil: motsDejaAnimesRef.current,
                        rapporterTotal: (n: number) => {
                          totalMotsCourantRef.current = n;
                        },
                      },
                    ],
                  ]
                : PLUGINS_REHYPE
            }
            components={{
              // Bloc de code (```lang ... ```) : ReactMarkdown structure ça
              // en <pre><code className="language-xxx">...</code></pre> --
              // on intercepte au niveau `pre` pour router selon le langage
              // déclaré AVANT toute coloration syntaxique, pendant qu'on a
              // encore le texte source intact (nécessaire pour Mermaid/
              // Chart/Carte/Widget, qui ont besoin du texte brut, pas
              // d'un HTML déjà transformé).
              pre({ children }) {
                const enfant = Array.isArray(children) ? children[0] : children;
                if (!isValidElement(enfant)) return <pre>{children}</pre>;

                const props = enfant.props as { className?: string; children?: ReactNode };
                const langage = (props.className || "").replace("language-", "").trim();
                const code = texteBrut(props.children).replace(/\n$/, "");

                switch (langage) {
                  case "mermaid":
                    return <Mermaid definition={code} />;
                  case "chart":
                    return <GraphiqueDonnees code={code} />;
                  case "carte":
                    return <CarteMessage code={code} />;
                  case "geometrie":
                    return <SchemaGeometrique code={code} />;
                  case "widget":
                  case "html":
                    return <WidgetSandbox code={code} />;
                  default:
                    return <BlocCode langage={langage} code={code} />;
                }
              },
              // Code inline (`texte`) : ne passe jamais par `pre` ci-dessus
              // -- juste un style discret, pas de coloration (pas assez de
              // contexte pour un langage sur un fragment isolé).
              code({ children }) {
                return (
                  <code className="rounded bg-dj-surface-haute px-1.5 py-0.5 font-mono text-[13px] text-dj-texte">
                    {children}
                  </code>
                );
              },
              img({ src, alt }) {
                return <ImageMessage src={typeof src === "string" ? src : undefined} alt={alt} />;
              },
              table({ children }) {
                return <TableauMessage>{children}</TableauMessage>;
              },
              // Lien : bascule vers une carte fichier, un lecteur média, ou
              // un aperçu (LinkPreview) selon ce que l'URL justifie -- le
              // lien texte brut est désormais le CAS DE REPLI, plus le
              // défaut (demande de Bourama, 2026-07-20 : un aperçu partout,
              // comme sur les autres plateformes, le lien nu seulement si
              // rien d'autre n'est exploitable).
              a({ href, children }) {
                if (!href) return <>{children}</>;
                // Citation inline (26/08) : le modèle écrit [n](citation:n)
                // au fil de sa réponse, juste après le passage concerné,
                // en plus de la liste complète déjà affichée en bas par
                // OutilResultatBulle/SourcesBulle -- même numérotation
                // globale des deux côtés (voir sourcesAplaties ci-dessus).
                // Volontairement PAS un lien classique (pas de LinkPreview
                // ici) : juste un petit texte cliquable qui ouvre la
                // source, pour rester léger au milieu d'une phrase.
                //
                // Affiche le NOM du fichier + le repérage ("page 4"/"à
                // 02:15") en clair (26/08, retour Bourama : "un chiffre
                // nu, on n'y comprend rien") -- jamais juste "[n]". Pour
                // un PDF/audio, ouvre le visionneur EN APP à la bonne
                // position plutôt qu'un lien externe (même raison que
                // SourcesBulle.tsx : le fragment #page=/#t= est ignoré une
                // fois hors de l'app).
                const matchCitation = /^citation:(\d+)$/.exec(href);
                if (matchCitation) {
                  const numero = parseInt(matchCitation[1], 10);
                  const source = sourcesAplaties[numero - 1];
                  // CORRECTIF 27/08 (Bourama : "c'est le frontend qui ne
                  // sait pas l'afficher, pas un problème du modèle") --
                  // avant : `if (!source) return null`, donc si la
                  // résolution échouait pour une raison quelconque
                  // (dédoublonnage par url trop agressif entre plusieurs
                  // extraits d'un même fichier, corrigé dans
                  // ChatIA.tsx -- ou toute autre cause), la citation
                  // disparaissait purement et simplement du texte, sans
                  // aucune trace ni erreur visible : impossible à
                  // distinguer d'un marqueur que le modèle n'aurait
                  // jamais écrit. Après : le texte des enfants (ce que le
                  // modèle a écrit comme libellé du lien) reste TOUJOURS
                  // visible, même si la source ne résout pas -- juste
                  // sans interactivité dans ce cas précis.
                  if (!source) return <span className="text-dj-accent-1">{children}</span>;
                  const libelle = source.reperage ? `${source.titre}, ${source.reperage}` : source.titre;
                  // CORRECTIF 2026-08-27 (demande Bourama : "que tout
                  // reste en popup interne, meme les sites") : toujours
                  // le visionneur en app, plus jamais de <a
                  // target="_blank"> en repli -- voir SourcesBulle.tsx,
                  // même logique.
                  return (
                    <button
                      type="button"
                      onClick={() =>
                        ouvrirPosition({
                          url: source.url,
                          titre: libelle,
                          positionType: source.position_type,
                          positionValeur: source.position_valeur,
                          typeMime: source.type_mime,
                        })
                      }
                      title={libelle}
                      className="mx-0.5 rounded border border-dj-bordure px-1.5 py-0.5 align-middle text-[11px] font-medium text-dj-accent-1 no-underline hover:underline"
                    >
                      {libelle}
                    </button>
                  );
                }
                const media = typeMedia(href);
                if (media) return <LecteurMedia href={href} type={media} />;
                if (estNoteTexteBibliotheque(href)) {
                  return <NoteTexteChip href={href} nom={texteBrut(children) || href} />;
                }
                if (extensionCode(href)) {
                  return <FichierCode href={href} nom={texteBrut(children) || href} />;
                }
                if (extensionFichier(href)) {
                  return <FichierChip href={href} nom={texteBrut(children) || href} />;
                }
                if (/^https?:\/\//i.test(href)) {
                  return <LinkPreview href={href} texteLien={texteBrut(children) || href} compact={estUtilisateur} />;
                }
                // mailto:/tel:/ancres internes -- un aperçu n'a pas de sens ici.
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-dj-texte-muet underline hover:text-dj-texte"
                  >
                    {children}
                  </a>
                );
              },
            }}
          >
            {normaliserLatex(message.content)}
          </ReactMarkdown>
        </div>

        {/* Bulle flottante "Expliquer" -- apparaît uniquement sur une
            sélection de texte dans une réponse assistant. position:fixed,
            calée sur la sélection native du navigateur. */}
        {selection && (
          <button
            onClick={() => {
              onExpliquerSelection?.(selection.texte);
              setSelection(null);
              window.getSelection()?.removeAllRanges();
            }}
            style={{ left: selection.x, top: selection.y - 40 }}
            className="fixed z-20 -translate-x-1/2 flex items-center gap-1.5 rounded-cgpt-bouton bg-dj-accent-1 px-3 py-1.5 text-xs font-semibold text-[#1A0D02] shadow-lg"
          >
            <MessageSquareQuote size={13} />
            Expliquer
          </button>
        )}
      </div>

      {!estUtilisateur && outilsResultats && outilsResultats.length > 0 && (
        <OutilResultatBulle resultats={outilsResultats} />
      )}
      {/* Fichiers générés (28/07, demande Bourama) : lien(s) détecté(s) côté
          backend de façon garantie (voir core/main.py, événement SSE
          "fichiers_generes"), indépendant de ce que le modèle a écrit dans
          sa réponse -- réutilise FichierChip.tsx tel quel, même rendu que
          les liens que le modèle écrit correctement lui-même (PDF en aperçu
          intégré, autre type en carte de téléchargement).

          Repliable, fermé par défaut (2026-07-30, demande Bourama) : la
          réponse du modèle n'est plus filtrée/masquée côté backend (round-
          trip standard rétabli, voir core/main.py) -- si le modèle recopie
          ou casse un lien, sa réponse s'affiche telle quelle, SANS y
          toucher. Ce menu sert de filet fiable et discret : le résultat
          garanti par le backend (URL correcte à coup sûr) reste disponible
          juste en dessous, quel que soit ce que le modèle a écrit. */}
      {!estUtilisateur && fichiersGeneres && fichiersGeneres.length > 0 && (
        <div className="my-1.5 flex max-w-[85%] flex-col gap-1">
          <button
            onClick={() => setFichiersOuverts((prec) => !prec)}
            className="flex items-center gap-1.5 text-[13px] text-dj-texte-muet transition-colors hover:text-dj-texte"
          >
            <FileText size={13} />
            <span>
              {fichiersGeneres.reduce((total, appel) => total + appel.fichiers.length, 0) > 1
                ? "Fichiers générés"
                : "Fichier généré"}
            </span>
            {fichiersOuverts ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          <div
            className={`grid transition-[grid-template-rows] duration-300 ease-out ${
              fichiersOuverts ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="overflow-hidden">
              <div className="mt-1.5 flex flex-col gap-1">
                {fichiersGeneres.flatMap((appel) =>
                  appel.fichiers.map((f) => <FichierChip key={f.url} href={f.url} nom={f.nom} />)
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {!estUtilisateur && message.qualiteReduite && (
        <div className="my-1.5 flex w-fit items-start gap-2 rounded-lg border border-dj-accent-2/40 bg-dj-accent-2/10 px-3 py-2 text-[13px] text-dj-texte">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-dj-accent-2" />
          <span>
            <strong>Réponse un peu plus lente à arriver</strong> (forte demande en ce moment). La
            qualité peut être légèrement différente de d&apos;habitude.
          </span>
        </div>
      )}


      {/* Heure : uniquement sous le message utilisateur (correction du
          2026-07-15 -- pas sous l'assistant, voir section 3.1). */}
      {estUtilisateur && message.created_at && (
        <span className="mt-1 text-[11px] text-dj-inactif">{formaterHeure(message.created_at)}</span>
      )}

      {/* Boutons d'action (31/07, demande Bourama) : pour l'assistant,
          n'apparaissent qu'une fois la génération VRAIMENT terminée --
          message.id reste null tant que la réponse est en cours de
          streaming (voir le commentaire sur ce champ plus haut) et n'est
          rempli qu'après coup par l'événement "meta", que le backend
          n'émet qu'APRÈS avoir sauvegardé la réponse complète (voir
          core/main.py:chat()). Avant, ces boutons (copier, régénérer...)
          étaient cliquables pendant que le texte s'écrivait encore.
          Côté utilisateur, pas de streaming à attendre -- toujours
          affichés au survol comme avant. */}
      {(estUtilisateur || message.id !== null) && (
        <div className="mt-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button onClick={copier} aria-label="Copier" className="rounded-md p-1.5 text-dj-texte-muet hover:text-dj-texte">
            {copie ? <Check size={14} /> : <Copy size={14} />}
          </button>

          {estUtilisateur ? (
            <>
              <button onClick={onRegenerer} aria-label="Renvoyer" className="rounded-md p-1.5 text-dj-texte-muet hover:text-dj-texte">
                <RotateCw size={14} />
              </button>
              <button
                onClick={() => setEnEdition(true)}
                aria-label="Éditer"
                className="rounded-md p-1.5 text-dj-texte-muet hover:text-dj-texte"
              >
                <Pencil size={14} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={lireAVoixHaute}
                aria-label={enLecture ? "Arrêter la lecture" : "Lire à voix haute"}
                className={`rounded-md p-1.5 hover:text-dj-texte ${enLecture ? "text-dj-accent-1" : "text-dj-texte-muet"}`}
              >
                <Volume2 size={14} />
              </button>
              <button onClick={onLike} aria-label="Retour positif" className="rounded-md p-1.5 text-dj-texte-muet hover:text-dj-texte">
                <ThumbsUp size={14} />
              </button>
              <button onClick={onDislike} aria-label="Retour négatif" className="rounded-md p-1.5 text-dj-texte-muet hover:text-dj-texte">
                <ThumbsDown size={14} />
              </button>
              <button onClick={onRegenerer} aria-label="Régénérer" className="rounded-md p-1.5 text-dj-texte-muet hover:text-dj-texte">
                <RotateCw size={14} />
              </button>
            </>
          )}
        </div>
      )}

      {pieceJointeOuverteIndex !== null && message.piecesJointes?.[pieceJointeOuverteIndex]?.previewUrl && (
        // Consolidé (audit 25/08/2026) dans VisionneuseImage.tsx -- corrige
        // au passage le bouton "Fermer" qui n'avait aucun onClick propre.
        <VisionneuseImage
          src={message.piecesJointes[pieceJointeOuverteIndex].previewUrl!}
          onFermer={() => setPieceJointeOuverteIndex(null)}
        />
      )}
    </div>
  );
}

// Perf (10/08, demande Bourama : accélérer le rendu du chat) : sans ça,
// CHAQUE bulle de la conversation entière se re-rendait -- et reparsait
// tout son markdown (remark-gfm/remark-math + rehype-raw/sanitize/katex,
// pas gratuit) -- à CHAQUE morceau de texte reçu en streaming pour le
// DERNIER message, simplement parce que ChatIA.tsx re-render fait
// tourner .map() sur toute la liste. Pour tous les messages SAUF celui
// en cours de génération, `message` garde la même référence d'un rendu
// à l'autre (voir majMessages dans ChatIA.tsx : seul le dernier élément
// est remplacé pendant le streaming, les autres sont juste recopiés
// tels quels) -- donc comparer `message` par référence suffit à savoir
// si CETTE bulle a vraiment quelque chose de nouveau à afficher.
//
// Les callbacks (onRegenerer, onEditer, onLike...) sont volontairement
// EXCLUS de cette comparaison : ChatIA.tsx les recrée en fonctions
// inline à chaque rendu (une par position dans la liste), donc leur
// référence change tout le temps même quand rien de visible n'a changé
// pour cette bulle précise -- les comparer aurait annulé tout le
// bénéfice du memo. Sans risque : ils ferment sur `index`/`message.id`
// pour CETTE position, qui ne varie pas indépendamment de `message`.
function memeApparence(
  precedent: Parameters<typeof BulleMessageInterne>[0],
  suivant: Parameters<typeof BulleMessageInterne>[0]
) {
  return (
    precedent.message === suivant.message &&
    precedent.nomAgent === suivant.nomAgent &&
    precedent.enAttente === suivant.enAttente &&
    precedent.estEnCoursDeGeneration === suivant.estEnCoursDeGeneration &&
    precedent.raisonnement === suivant.raisonnement &&
    precedent.raisonnementEnCours === suivant.raisonnementEnCours &&
    precedent.outilsResultats === suivant.outilsResultats &&
    precedent.fichiersGeneres === suivant.fichiersGeneres
  );
}

export const BulleMessage = memo(BulleMessageInterne, memeApparence);
