"use client";

import { useEffect, useRef, useState } from "react";
import { Pin, Mic, Square, AudioLines, ArrowUp, X, MapPin, Github, FileText, Maximize2, Minimize2, Search, Code, PenLine, Wrench, FileSearch, Globe, Map, FileType, FileSpreadsheet, Presentation, FolderSearch, Package, Archive, Download, Image as IconImage, Bell, FolderTree, FileCode, Edit3, Sigma, Check, LayoutGrid, ChevronDown, Plus, SlidersHorizontal, UserX } from "lucide-react";
import { transcrireAudioChat, statutConnexion, demarrerConnexion, depotsGithub, pagesNotion, lignesBaseNotion, creerPageNotion, extraireFormuleImage, lireOutilsChatAgent } from "@/lib/api";
import { APPLIS_DISPONIBLES, useOutilsRegistre } from "@/lib/outils";
import { IconeNotion } from "@/components/icons/IconeNotion";
import { LecteurMedia } from "./LecteurMedia";
import { CanvasDessin } from "./CanvasDessin";
import { VisionneuseImage } from "./VisionneuseImage";
import dynamic from "next/dynamic";
import { BlocCode } from "./BlocCode";
import hljs from "@/lib/coloration";
import katex from "katex";
import { messageErreur } from "@/lib/erreurs";
import { Skeleton } from "../Skeleton";
import { PanneauFlottant } from "@/components/PanneauFlottant";
import { useFermetureAnimee } from "@/lib/useFermetureAnimee";

// EditeurMathsRiche (tiptap + mathlive) et EditeurFormule (mathlive) ne
// montent que quand leur modale respective s'ouvre (voir
// editeurMathsRicheOuvert/editeurFormuleOuvert plus bas) -- next/dynamic
// les sort du bundle initial de la barre de saisie, chargées uniquement
// au clic sur les boutons correspondants. katex, lui, reste en import
// statique ci-dessus : rendreFormuleKatex() (aperçu LaTeX en direct
// pendant la frappe, plus bas) l'appelle de façon synchrone à chaque
// rendu du texte -- le rendre lazy demanderait de refondre ce chemin en
// asynchrone, risqué sur une fonctionnalité aussi visible/fréquente pour
// un gain modeste (katex est plus léger que tiptap+mathlive).
const EditeurMathsRiche = dynamic(() => import("./EditeurMathsRiche").then((m) => m.EditeurMathsRiche), {
  ssr: false,
});
const EditeurFormule = dynamic(() => import("./EditeurFormule").then((m) => m.EditeurFormule), {
  ssr: false,
});

export type LongueurReponse = "courte" | "moyenne" | "longue";

// Regroupement du selecteur de modele premium par distributeur (02/08/2026,
// voir ModelesPremiumAgent.tsx cote dashboard pour le meme mapping) --
// ordre d'affichage volontairement identique a la hierarchie backend
// (core/fournisseurs_llm.py:ORDRE_DISTRIBUTEURS).
const ORDRE_DISTRIBUTEURS_AFFICHAGE = ["claude", "gpt", "gemini", "deepseek"];
const LABELS_DISTRIBUTEUR: Record<string, string> = {
  claude: "Claude",
  gpt: "GPT",
  gemini: "Gemini",
  deepseek: "DeepSeek",
};

const LABELS_LONGUEUR: Record<LongueurReponse, string> = {
  courte: "Courte",
  moyenne: "Moyenne",
  longue: "Longue",
};
export type LocalisationJointe = { latitude: number; longitude: number } | null;

// Listes OUTILS_DISPONIBLES / ONGLETS_OUTILS / APPLIS_DISPONIBLES
// extraites dans lib/outils.ts le 01/08 (Bourama : "est-ce que ça
// varie en fonction de quel outil est ajouté ou enlevé" -- source
// unique désormais, ne plus les redéfinir ici).

// Détection de langage pour un collage de code (2026-07-25, demande de
// Bourama : coller du code aujourd'hui atterrit comme texte brut, sans
// aucun traitement). Testé manuellement le 25/07 : s'appuyer uniquement
// sur `hljs.highlightAuto(...).relevance` pour décider "est-ce du code ?"
// ne fonctionne PAS -- un énoncé de maths en français obtient un score
// PLUS élevé (8) qu'un vrai extrait JavaScript (5), et hljs se trompe
// aussi de langage sur des extraits courts (JS détecté "ada", Java
// détecté "csharp"). Approche retenue à la place : des motifs de syntaxe
// propres à chaque langage (accolades+mots-clés, pas de simple score de
// probabilité), hljs.highlightAuto seulement en dernier recours si rien
// de spécifique n'a matché mais que ça ressemble quand même à du code.
const REGEX_LATEX = /\\(begin|end)\{|\\frac|\\int|\\sum|\\sqrt|\\alpha|\\beta|\$\$/;
const PATTERNS_LANGAGE: [string, RegExp][] = [
  ["python", /\bdef\s+\w+\s*\(.*\)\s*:/],
  ["python", /^\s*import\s+\w+(\s+as\s+\w+)?\s*$/m],
  ["javascript", /\bconsole\.log\s*\(/],
  ["javascript", /=>\s*\{/],
  ["javascript", /\b(const|let|var)\s+\w+\s*=/],
  ["java", /\bpublic\s+static\s+void\s+main\b/],
  ["java", /\bpublic\s+(static\s+)?class\b/],
  ["cpp", /^\s*#include\s*</m],
  ["php", /<\?php/],
];
// Signal générique "ressemble à du code" mais sans langage identifiable
// directement -- hljs sert alors juste à deviner un nom, en dernier recours.
const PATTERNS_CODE_GENERIQUE = [/;\s*$/m, /^\s*\}\s*;?\s*$/m];
const SEUIL_RELEVANCE_CODE = 6;
const NOMS_LANGAGE: Record<string, string> = {
  python: "Python", javascript: "JavaScript", typescript: "TypeScript",
  java: "Java", cpp: "C++", php: "PHP", latex: "LaTeX",
};

function libellePieceJointe(langageDetecte: string | null, texteColle: string): string {
  if (langageDetecte === "latex") return "Formule collée, LaTeX";
  if (langageDetecte) return `Code collé, ${NOMS_LANGAGE[langageDetecte] || langageDetecte}`;
  return `Texte collé, ${texteColle.length.toLocaleString("fr-FR")} caractères`;
}

function detecterLangageCode(texte: string): string | null {
  // Un extrait de code fait rarement une seule ligne -- évite de
  // convertir "x = 5" ou une simple formule collée en pièce jointe.
  if (texte.trim().split("\n").length < 3) return null;
  if (REGEX_LATEX.test(texte)) return "latex";
  for (const [langage, motif] of PATTERNS_LANGAGE) {
    if (motif.test(texte)) return langage;
  }
  if (PATTERNS_CODE_GENERIQUE.some((p) => p.test(texte))) {
    try {
      const resultat = hljs.highlightAuto(texte);
      if (resultat.language && resultat.relevance >= SEUIL_RELEVANCE_CODE) {
        return resultat.language;
      }
    } catch {
      // Détection auto peut échouer sur du texte inhabituel -- traité
      // comme "pas du code" plutôt que de faire planter le collage.
    }
  }
  return null;
}

const REGEX_URL = /(https?:\/\/[^\s]+)/g;

// Découpe le texte en segments {texte, lien} pour le calque de
// superposition -- coloration/soulignement des liens PENDANT la frappe
// (avant envoi), demande explicite de Bourama (2026-07-23) : un
// <textarea> natif ne peut pas colorer une sous-partie de son propre
// texte, donc on superpose un calque en lecture seule qui, lui, peut
// styler chaque morceau, pendant que le vrai <textarea> (texte rendu
// invisible via text-transparent) reste en dessous pour la saisie/le
// curseur/la sélection réels. Voir le rendu plus bas pour la
// synchronisation de défilement entre les deux calques.
function segmenterTexteAvecLiens(texte: string): { texte: string; lien: boolean }[] {
  const segments: { texte: string; lien: boolean }[] = [];
  let dernierIndex = 0;
  for (const trouve of texte.matchAll(REGEX_URL)) {
    const index = trouve.index ?? 0;
    if (index > dernierIndex) segments.push({ texte: texte.slice(dernierIndex, index), lien: false });
    segments.push({ texte: trouve[0], lien: true });
    dernierIndex = index + trouve[0].length;
  }
  if (dernierIndex < texte.length) segments.push({ texte: texte.slice(dernierIndex), lien: false });
  return segments;
}

// Aperçu formules (2026-07-27, demande de Bourama : le champ de saisie
// reste un <textarea> brut -- LaTeX visible tel quel ($...$) pendant la
// frappe -- mais un aperçu séparé au-dessus affiche le même texte avec
// les formules rendues via KaTeX, mis à jour en direct à chaque frappe.
// Alternative volontairement plus légère qu'un vrai éditeur riche
// (contenteditable) : celui-ci demanderait de refaire toute la gestion
// du curseur/de la sélection déjà en place (insertion à la position du
// curseur, sélection -> "Expliquer", détection de collage, etc.) --
// voir échange avec Bourama à ce sujet. `$$...$$` est traité avant
// `$...$` pour ne pas couper un bloc display au milieu.
const REGEX_FORMULE = /\$\$([^$]+)\$\$|\$([^$\n]+)\$/g;

function segmenterTexteAvecFormules(texte: string): { texte: string; formule: boolean; bloc?: boolean }[] {
  const segments: { texte: string; formule: boolean; bloc?: boolean }[] = [];
  let dernierIndex = 0;
  for (const trouve of texte.matchAll(REGEX_FORMULE)) {
    const index = trouve.index ?? 0;
    if (index > dernierIndex) segments.push({ texte: texte.slice(dernierIndex, index), formule: false });
    const estBloc = trouve[1] !== undefined;
    segments.push({ texte: estBloc ? trouve[1] : trouve[2], formule: true, bloc: estBloc });
    dernierIndex = index + trouve[0].length;
  }
  if (dernierIndex < texte.length) segments.push({ texte: texte.slice(dernierIndex), formule: false });
  return segments;
}

function rendreFormuleKatex(latex: string, bloc: boolean): string {
  try {
    return katex.renderToString(latex, { throwOnError: false, displayMode: bloc });
  } catch {
    return latex;
  }
}

// Types acceptés par le sélecteur de fichier -- élargi le 2026-07-20 pour
// couvrir images (Gemini vision), documents PDF/Word/Excel (extraction
// texte) ET vidéo (audio transcrit + frames analysées par Gemini), voir
// api/uploads.py.
const TYPES_FICHIERS_ACCEPTES =
  "image/jpeg,image/png,image/webp," +
  "application/pdf," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet," +
  "video/mp4,video/webm,video/quicktime," +
  // Upload d'un vrai fichier audio (2026-07-22, préparé par Bourama --
  // distinct de la dictée micro juste en dessous, qui passe par le même
  // endpoint /audio-chat mais un chemin de code différent, voir
  // ChatIA.tsx:envoyerMessage).
  "audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/x-m4a,audio/aac";

export function BarreDeSaisie({
  onEnvoyer,
  desactive,
  agentId,
  modelesDisponibles = [],
  modeleSelectionne = null,
  onModeleChange,
  boutonSansEnseignant = false,
  outilsActifsAgent = null,
}: {
  onEnvoyer: (
    texte: string,
    longueur: LongueurReponse,
    fichiers: File[],
    localisation: LocalisationJointe,
    texteColle: string | null,
    rechercheForcee: boolean,
    sansEnseignant: boolean
  ) => void;
  desactive?: boolean;
  agentId?: string;
  // Selecteur de modele premium (02/08/2026, voir ChatIA.tsx et
  // core/fournisseurs_llm.py) -- liste vide = agent sans abonnement
  // premium debloque, AUCUN bouton affiche (comportement identique a
  // avant cette feature, jamais de selecteur pour un agent qui n'a rien
  // debloque). Controle par le PARENT (ChatIA.tsx) plutot qu'en state
  // local ici, contrairement a rechercheForcee -- la valeur
  // doit survivre au closure de envoyerMessage sans passer par
  // onEnvoyer (deja tres charge), voir ChatIA.tsx:modeleSelectionne.
  modelesDisponibles?: { modele_id: string; label: string; distributeur: string; palier: string }[];
  modeleSelectionne?: string | null;
  onModeleChange?: (modeleId: string | null) => void;
  // Agent "Clovis" / contenu dynamique par matière (06/08/2026, demande
  // Bourama) -- affiche le bouton "Sans enseignant" (voir sansEnseignant
  // plus bas), qui force le prompt généraliste pour le prochain message,
  // sans utiliser le contenu d'aucun enseignant même si des matières
  // sont débloquées. Absent pour tous les autres agents.
  boutonSansEnseignant?: boolean;
  // Outils autorisés pour cet agent (14/08, demande Bourama) -- fourni
  // par le parent (ChatIA -> page.tsx), chargé pendant l'écran de
  // chargement plein écran initial. Ce composant ne va plus le chercher
  // lui-même après son montage : plus de bouton "Utilitaires" ou de
  // slots d'outils récents qui apparaissent après coup, ils sont déjà
  // là dès le premier rendu de la barre.
  outilsActifsAgent?: { outils: string[]; actions_locales: string[] } | null;
}) {
  const [texte, setTexte] = useState("");
  const [longueur, setLongueur] = useState<LongueurReponse>("moyenne");
  // Devenu un TABLEAU le 17/08 (demande Bourama : "permet l'upload de
  // plusieurs fichiers dans le chat" -- avant, un seul fichier possible
  // par message). Chaque entrée garde son propre aperçu (image only, même
  // logique qu'avant) et un id stable pour la clé React / le retrait
  // individuel.
  const [fichiers, setFichiers] = useState<{ id: string; fichier: File; apercu: string | null }[]>([]);
  const [imageAgrandieId, setImageAgrandieId] = useState<string | null>(null);
  // Icône de recherche web (2026-07-23, demande de Bourama : "une icône
  // dans la barre de saisie mais peut s'activer automatiquement") --
  // forçage manuel EN PLUS de l'activation automatique déjà possible
  // (le modèle décide seul d'utiliser Tavily via le tool-calling normal,
  // dès lors que le serveur est activé pour l'agent, voir
  // core/registre_outils.py). Un clic garantit la recherche pour LE
  // PROCHAIN message envoyé, puis se désactive (pas un mode permanent).
  const [rechercheForcee, setRechercheForcee] = useState(false);
  // Bouton "Sans enseignant" (06/08/2026, demande Bourama) -- même
  // pattern que rechercheForcee ci-dessus : un clic force le prompt
  // généraliste pour LE PROCHAIN message uniquement (voir
  // core/contenu_dynamique_matiere.py côté backend), puis se désactive
  // -- pas un mode permanent. Uniquement affiché si
  // boutonSansEnseignant (Clovis).
  const [sansEnseignant, setSansEnseignant] = useState(false);
  // Bouton "Outils" (2026-07-25, étendu à la MULTI-sélection le 26/07 --
  // voir core/mcp_tools.py:lister_tous_les_outils). AUCUN outil n'est
  // envoyé au modèle par défaut, sur aucun agent : il faut en
  // sélectionner un ou plusieurs manuellement ici pour qu'ils soient
  // disponibles pour le prochain message. Sélection cumulative (clic sur
  // un outil déjà actif le retire, clic sur un autre l'ajoute à la liste
  // sans désélectionner le reste) -- demande explicite de Bourama, la
  // sélection unique précédente ne permettait pas de combiner par ex.
  // recherche web + GitHub sur un même message.

  // CORRECTION (2026-07-30, re-appliqué après écrasement accidentel par
  // d053181 qui repartait d'une copie locale périmée du fichier) : droits
  // réels de CET agent (flux 1 -> flux 2), via GET
  // /api/agents/{id}/outils-disponibles (réutilise
  // lister_outils_autorises_pour_agent côté backend, donc déjà la liste
  // PLATE et expansée des vrais noms d'outils, ex. tavily_search,
  // explorer_depot_github inclus directement) + les actions locales
  // (préfixe "ui_", catégorie 4, invisibles pour cette fonction backend
  // puisque ce ne sont pas des outils LLM). `null` tant que pas encore
  // chargé -> AUCUN bouton d'outil backend affiché (fail closed) plutôt
  // que de risquer d'afficher un bouton pour un outil désactivé le temps
  // du chargement.
  function outilAutorisePourAgent(outil: { nom: string }): boolean {
    if (!outilsActifsAgent) return false;
    if (outil.nom.startsWith("ui_")) return outilsActifsAgent.actions_locales.includes(outil.nom);
    return outilsActifsAgent.outils.includes(outil.nom);
  }

  // Listes réellement proposables pour CET agent (flux 2) -- toute la
  // suite de ce composant (menus + slots, desktop et mobile) doit
  // utiliser CES listes filtrées, jamais OUTILS_DISPONIBLES /
  // APPLIS_DISPONIBLES brutes.
  // outilsDisponibles (2026-08-15) : registre vivant chargé depuis le
  // backend (voir lib/outils.ts:useOutilsRegistre) -- remplace l'ancienne
  // liste statique OUTILS_DISPONIBLES pour cette source de filtrage,
  // afin qu'un nouvel outil ajouté côté backend apparaisse ici sans rien
  // toucher dans ce dépôt.
  const { outils: outilsDisponibles } = useOutilsRegistre();
  const outilsPourAgent = outilsDisponibles.filter((o) => outilAutorisePourAgent(o));
  // Une appli (ex. GitHub) est autorisée si au moins une de ses actions
  // (ex. explorer_depot_github) fait partie des outils autorisés.
  const applisPourAgent = APPLIS_DISPONIBLES.filter((a) => outilsPourAgent.some((o) => o.appli === a.nom));
  // Bouton "Utilitaires" (2026-08-01, demande Bourama : "seront un autre
  // bouton à part, plus dans outils") -- ex-onglet "utilitaires" du menu
  // Outils, sorti dans son propre bouton dédié. Même liste/filtre agent
  // que les autres (outilAutorisePourAgent), juste un sous-ensemble de
  // outilsPourAgent au lieu d'un onglet parmi d'autres.
  const outilsUtilitairesPourAgent = outilsPourAgent.filter((o) => o.onglet === "utilitaires");

  // Interrupteur (13/08/2026, demande Bourama) -- désactive l'AFFICHAGE du
  // bouton "Applications" (menu complet, slots fixes, raccourci "dernier
  // utilisé") sans toucher au reste du code (state, effets, appels API,
  // logique de sélection). Remettre à true pour le réactiver.
  // Le menu déroulant "Outils" (sélection manuelle d'un outil backend
  // forcé) a été retiré entièrement (2026-08-20, demande Bourama) : mort
  // depuis son kill-switch du 13/08, jamais réactivé, remplacé par le
  // routeur automatique (routeur_outils_auto) côté backend pour l'agent
  // clovis. Seul le bouton Utilitaires (ex-onglet de ce menu, sorti à
  // part le 01/08) reste actif -- voir estOutilActif/executerActionOutil
  // plus haut, désormais limités aux entrées "ui_*".
  const AFFICHER_BOUTON_APPLICATIONS = false;

  const appliButtonVisible = AFFICHER_BOUTON_APPLICATIONS && applisPourAgent.length > 1;
  const appliSlotUnique = AFFICHER_BOUTON_APPLICATIONS && applisPourAgent.length === 1 ? applisPourAgent[0] : null;
  // Menus custom pour les selecteurs modele premium / longueur de reponse
  // (02/08/2026, Bourama : "ce style d'affichage n'est pas propre a ma
  // plateforme" -- <select> natif remplace par le meme pattern
  // bouton+panneau flottant que menuAppliOuvert juste en dessous, pour
  // rester coherent avec le reste de l'UI).
  const [menuModeleOuvert, setMenuModeleOuvert] = useState(false);
  const boutonModeleRef = useRef<HTMLButtonElement>(null);
  const menuModeleRef = useRef<HTMLDivElement>(null);
  const [menuLongueurOuvert, setMenuLongueurOuvert] = useState(false);
  const boutonLongueurRef = useRef<HTMLButtonElement>(null);
  const menuLongueurRef = useRef<HTMLDivElement>(null);
  // Menu du bouton "Utilitaires" (2026-08-01) -- multi-sélection cumulative
  // via estOutilActif/executerActionOutil déjà génériques, pas d'onglets :
  // une seule liste plate (outilsUtilitairesPourAgent).
  const [menuUtilitairesOuvert, setMenuUtilitairesOuvert] = useState(false);
  const menuUtilitairesRef = useRef<HTMLDivElement>(null);
  const menuUtilitairesMobileRef = useRef<HTMLDivElement>(null);
  const boutonUtilitairesRef = useRef<HTMLButtonElement>(null);

  // Slots variables (2026-07-28, refonte barre de saisie ; révisé le
  // 2026-08-01 suite retours Bourama) -- 3 emplacements "derniers
  // outils/utilitaires utilisés" (desktop) + 1 emplacement "dernière
  // appli utilisée" (desktop, visible seulement si l'agent a PLUSIEURS
  // applis actives -- voir appliButtonVisible plus haut ; si une seule
  // appli, elle reste fixe et ne varie jamais, voir appliSlotUnique,
  // inchangé) + 1 slot unique mobile qui fusionne les trois catégories.
  //
  // Historique UNIQUE {type, nom}[], le plus récent en tête, dont on
  // dérive tout le reste par filtre à l'affichage :
  // - type "outil" couvre à la fois le menu Outils ET le bouton
  //   Utilitaires (les deux appellent enregistrerUtilisationOutil via
  //   executerActionOutil) -- demande Bourama "les utilitaires sont
  //   inclus dans les slots variables des outils, donc les trois [3
  //   slots desktop]".
  // - type "appli" ne sert que quand appliButtonVisible (>1 appli) ;
  //   si une seule appli, ce type n'est pas utilisé pour ce slot-là
  //   (appliSlotUnique fixe reste indépendant), mais reste utile pour
  //   le slot combiné mobile ci-dessous.
  //
  // Persisté dans localStorage (demande Bourama 01/08 : "ils doivent
  // rester et continuer à varier plutôt que de reprendre à chaque fois
  // que t'ouvres l'app") -- global au navigateur, pas scindé par agent
  // (les slots sont de toute façon refiltrés par agent à l'affichage,
  // donc un outil non autorisé pour l'agent courant est simplement
  // ignoré sans avoir besoin d'un historique séparé par agent).
  type RecentSlot = { type: "outil" | "appli"; nom: string };
  const CLE_LS_RECENTS = "dj_barre_recents_v1";
  const NB_SLOTS_OUTILS_RECENTS = 3;
  const [recentsCombines, setRecentsCombines] = useState<RecentSlot[]>([]);

  useEffect(() => {
    try {
      const brut = window.localStorage.getItem(CLE_LS_RECENTS);
      if (!brut) return;
      const parsed = JSON.parse(brut);
      if (Array.isArray(parsed)) setRecentsCombines(parsed);
    } catch {
      // localStorage indisponible (navigation privée, quota dépassé...)
      // -- tant pis, les slots repartent de zéro pour cette session,
      // ce n'est pas bloquant pour le reste de la barre.
    }
  }, []);

  function enregistrerRecent(type: "outil" | "appli", nom: string) {
    setRecentsCombines((prec) => {
      const suivant = [{ type, nom }, ...prec.filter((r) => !(r.type === type && r.nom === nom))].slice(0, 10);
      try {
        window.localStorage.setItem(CLE_LS_RECENTS, JSON.stringify(suivant));
      } catch {
        // idem, non bloquant
      }
      return suivant;
    });
  }

  // Dérivés utilisés par le rendu (desktop 3 slots outils/utilitaires,
  // desktop 1 slot appli variable) :
  // Défaut (02/08, demande Bourama, corrigé après clarification : "par
  // défaut, pas épingler") : le clavier LaTeX (ui_formule) n'apparaît que
  // tant qu'il n'y a AUCUN historique -- ce qui couvre l'ouverture par un
  // nouvel utilisateur qui n'a encore rien utilisé. Dès qu'un outil a été
  // utilisé au moins une fois, les slots redeviennent entièrement
  // dynamiques (ui_formule peut en sortir comme n'importe quel autre).
  const OUTIL_SLOT_FIXE = "ui_formule";
  const outilsRecentsBruts = recentsCombines.filter((r) => r.type === "outil").map((r) => r.nom);
  const outilsRecents = (outilsRecentsBruts.length > 0 ? outilsRecentsBruts : [OUTIL_SLOT_FIXE]).slice(
    0,
    NB_SLOTS_OUTILS_RECENTS
  );
  const appliRecente =
    recentsCombines.find((r) => r.type === "appli")?.nom ?? applisPourAgent[0]?.nom ?? null;
  const [menuAppliOuvert, setMenuAppliOuvert] = useState(false);
  const menuAppliRef = useRef<HTMLDivElement>(null);
  const menuAppliMobileRef = useRef<HTMLDivElement>(null);
  const boutonAppliRef = useRef<HTMLButtonElement>(null);

  // Menu du bouton "+" mobile (2026-07-28, refonte mobile demandée par
  // Bourama : "en une ligne, + à gauche, champ, 2 boutons à droite") --
  // regroupe les 3 icônes fixes desktop (Joindre un fichier / Outils /
  // Applications) qui n'ont plus la place d'être affichées côte à côte
  // sur petit écran. Déclenche les MÊMES états que les icônes desktop
  // (setMenuOutilsOuvert / setMenuAppliOuvert) -- pas de logique dupliquée,
  // juste un point d'entrée en plus.
  const [menuPlusOuvert, setMenuPlusOuvert] = useState(false);
  const menuPlusRef = useRef<HTMLDivElement>(null);
  const boutonPlusRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuPlusOuvert) return;
    function gererClicExterieur(e: MouseEvent) {
      const cible = e.target as Node;
      if (menuPlusRef.current?.contains(cible)) return;
      if (boutonPlusRef.current?.contains(cible)) return;
      setMenuPlusOuvert(false);
    }
    document.addEventListener("mousedown", gererClicExterieur);
    return () => document.removeEventListener("mousedown", gererClicExterieur);
  }, [menuPlusOuvert]);

  useEffect(() => {
    if (!menuAppliOuvert) return;
    function gererClicExterieur(e: MouseEvent) {
      const cible = e.target as Node;
      if (menuAppliRef.current?.contains(cible)) return;
      if (boutonAppliRef.current?.contains(cible)) return;
      if (menuAppliMobileRef.current?.contains(cible)) return;
      if (boutonPlusRef.current?.contains(cible)) return;
      setMenuAppliOuvert(false);
    }
    document.addEventListener("mousedown", gererClicExterieur);
    return () => document.removeEventListener("mousedown", gererClicExterieur);
  }, [menuAppliOuvert]);

  useEffect(() => {
    if (!menuModeleOuvert) return;
    function gererClicExterieur(e: MouseEvent) {
      const cible = e.target as Node;
      if (menuModeleRef.current?.contains(cible)) return;
      if (boutonModeleRef.current?.contains(cible)) return;
      setMenuModeleOuvert(false);
    }
    document.addEventListener("mousedown", gererClicExterieur);
    return () => document.removeEventListener("mousedown", gererClicExterieur);
  }, [menuModeleOuvert]);

  useEffect(() => {
    if (!menuLongueurOuvert) return;
    function gererClicExterieur(e: MouseEvent) {
      const cible = e.target as Node;
      if (menuLongueurRef.current?.contains(cible)) return;
      if (boutonLongueurRef.current?.contains(cible)) return;
      setMenuLongueurOuvert(false);
    }
    document.addEventListener("mousedown", gererClicExterieur);
    return () => document.removeEventListener("mousedown", gererClicExterieur);
  }, [menuLongueurOuvert]);

  function enregistrerUtilisationOutil(nom: string) {
    enregistrerRecent("outil", nom);
  }

  function enregistrerUtilisationAppli(nom: string) {
    enregistrerRecent("appli", nom);
  }

  // Certaines entrées de OUTILS_DISPONIBLES (préfixe "ui_") ne sont pas des
  // outils backend forcés mais d'anciennes icônes autonomes de la barre --
  // ces deux fonctions font le routage, que l'entrée soit cliquée depuis le
  // menu "Outils" ou depuis son propre slot variable (même comportement).
  function estOutilActif(nom: string): boolean {
    switch (nom) {
      case "ui_localisation":
        return !!localisation;
      case "ui_recherche":
        return rechercheForcee;
      case "ui_formule":
        return editeurFormuleOuvert;
      case "ui_editeur_maths":
        return editeurMathsRicheOuvert;
      case "ui_dessin":
        return canvasOuvert;
      default:
        return false;
    }
  }

  function executerActionOutil(nom: string) {
    switch (nom) {
      case "ui_localisation":
        toggleLocalisation();
        break;
      case "ui_recherche":
        setRechercheForcee((v) => !v);
        break;
      case "ui_formule":
        setEditeurFormuleOuvert((v) => !v);
        break;
      case "ui_editeur_maths":
        setEditeurMathsRicheOuvert(true);
        break;
      case "ui_dessin":
        setCanvasOuvert(true);
        break;
      case "ui_mode_vocal":
        pasDisponible();
        break;
    }
    enregistrerUtilisationOutil(nom);
  }

  function executerActionAppli(nom: string) {
    switch (nom) {
      case "github":
        cliquerGithub();
        break;
      case "notion":
        cliquerNotion();
        break;
    }
    enregistrerUtilisationAppli(nom);
  }

  useEffect(() => {
    if (!menuUtilitairesOuvert) return;
    function gererClicExterieur(e: MouseEvent) {
      const cible = e.target as Node;
      if (menuUtilitairesRef.current?.contains(cible)) return;
      if (boutonUtilitairesRef.current?.contains(cible)) return;
      if (menuUtilitairesMobileRef.current?.contains(cible)) return;
      if (boutonPlusRef.current?.contains(cible)) return;
      setMenuUtilitairesOuvert(false);
    }
    document.addEventListener("mousedown", gererClicExterieur);
    return () => document.removeEventListener("mousedown", gererClicExterieur);
  }, [menuUtilitairesOuvert]);
  // Collage long -> pièce jointe texte (2026-07-23, demande de Bourama :
  // comportement Claude -- coller un gros pavé de texte ne l'insère pas
  // tel quel dans le champ, ça devient une pièce jointe séparée qu'on
  // peut retirer/relire, comme un fichier joint mais sans upload : le
  // texte est déjà là côté client, pas besoin d'aller-retour serveur).
  const SEUIL_COLLAGE_LONG = 800;
  const [texteColle, setTexteColle] = useState<string | null>(null);
  const [texteColleOuvert, setTexteColleOuvert] = useState(false);
  // 18/08/2026, voir lib/useFermetureAnimee.ts -- une instance par
  // PanneauFlottant de ce fichier, chacun avec sa propre fermeture.
  const { enSortie: texteColleEnSortie, demarrerFermeture: fermerTexteColleAnime } = useFermetureAnimee();
  // Langage détecté si le collage est du code (2026-07-25) -- null pour
  // un collage de texte normal (>800 caractères, comportement existant
  // inchangé), une valeur hljs (ex. "python") sinon.
  const [langageDetecte, setLangageDetecte] = useState<string | null>(null);
  // Plein écran de la saisie (2026-07-23, demande de Bourama : l'agrandissement
  // auto restait trop limité pour écrire un long message confortablement).
  const [pleinEcranSaisie, setPleinEcranSaisie] = useState(false);
  const { enSortie: pleinEcranSaisieEnSortie, demarrerFermeture: fermerPleinEcranSaisieAnime } = useFermetureAnimee();
  // Canvas de dessin (2026-07-25) -- géométrie/graphe/croquis, voir
  // CanvasDessin.tsx. Le résultat rejoint le tableau `fichiers` comme un
  // upload classique (ajouterFichiers), donc suit exactement le même
  // chemin d'envoi/aperçu, aucun état séparé nécessaire pour l'envoi.
  const [canvasOuvert, setCanvasOuvert] = useState(false);
  const { enSortie: canvasEnSortie, demarrerFermeture: fermerCanvasAnime } = useFermetureAnimee();
  // Éditeur de formule maths/chimie (2026-07-25) -- voir EditeurFormule.tsx.
  const [editeurFormuleOuvert, setEditeurFormuleOuvert] = useState(false);
  // Éditeur maths riche à part (01/08) -- voir EditeurMathsRiche.tsx. Un
  // seul point de contact avec l'existant : `setTexte` au moment
  // d'"Insérer dans le message", rien d'autre du textarea/clavier
  // n'est touché ni partagé (demande explicite de Bourama).
  const [editeurMathsRicheOuvert, setEditeurMathsRicheOuvert] = useState(false);
  const { enSortie: editeurMathsEnSortie, demarrerFermeture: fermerEditeurMathsAnime } = useFermetureAnimee();
  // Insertion live (2026-07-27, demande Bourama : "les symboles s'insèrent
  // automatiquement, pas de bouton insérer/effacer") -- plutôt qu'un clic
  // "Insérer" qui pousse le résultat final d'un coup, on garde la trace de
  // la portion de `texte` qui correspond à la formule en cours de
  // construction (`plageFormuleLive`), et on la remplace en entier à
  // chaque frappe dans le champ maths/chimie. `null` = rien en cours de
  // construction -- la prochaine frappe insère une nouvelle formule à la
  // position actuelle du curseur plutôt que d'en remplacer une existante.
  const [plageFormuleLive, setPlageFormuleLive] = useState<{ debut: number; fin: number } | null>(null);
  // OCR ciblé formule (2026-07-26, priorité maths de Bourama) -- image
  // jointe -> LaTeX extrait par Gemini -> ouvert dans EditeurFormule pour
  // relecture/correction avant insertion (jamais inséré tel quel sans
  // passage par l'éditeur, une transcription OCR peut se tromper).
  const [extractionFormuleEnCours, setExtractionFormuleEnCours] = useState(false);
  const [formuleInitiale, setFormuleInitiale] = useState<string | undefined>(undefined);

  async function extraireFormuleDeImage() {
    // Plusieurs fichiers possibles depuis le 17/08 -- on cible la
    // première image jointe (choix par défaut raisonnable, cette action
    // n'a de sens que pour une image ; documenté ici plutôt que deviné en
    // silence si Bourama veut un comportement différent plus tard).
    const premiereImage = fichiers.find((f) => f.fichier.type.startsWith("image/"))?.fichier;
    if (!premiereImage || extractionFormuleEnCours) return;
    setExtractionFormuleEnCours(true);
    try {
      const latex = await extraireFormuleImage(premiereImage);
      setFormuleInitiale(latex);
      setEditeurFormuleOuvert(true);
    } catch (e) {
      alert(e instanceof Error && e.message.includes("Aucune formule") ? "Aucune formule détectée dans cette image." : "Échec de l'extraction, réessaie.");
    } finally {
      setExtractionFormuleEnCours(false);
    }
  }
  const inputFichierRef = useRef<HTMLInputElement>(null);
  const zoneTexteRef = useRef<HTMLTextAreaElement>(null);
  // Ref séparée pour le composeur mobile (2026-07-28) -- même état
  // `texte`, DOM distinct.
  const zoneTexteMobileRef = useRef<HTMLTextAreaElement>(null);
  const calqueRef = useRef<HTMLDivElement>(null);
  // Aperçu formules (2026-07-27, retour Bourama : l'aperçu restait figé
  // à son ancienne position de défilement -- en ajoutant des lignes, ce
  // qu'on venait de taper se retrouvait hors de la zone visible, donnant
  // l'impression que rien ne s'écrivait. Fait défiler automatiquement
  // vers le bas à chaque changement du texte, pour toujours montrer la
  // dernière ligne tapée.
  const apercuFormulesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (apercuFormulesRef.current) {
      apercuFormulesRef.current.scrollTop = apercuFormulesRef.current.scrollHeight;
    }
  }, [texte]);
  // Équivalent mobile (2026-07-30, bug signalé par Bourama : cet aperçu
  // n'existait qu'à l'intérieur du bloc "hidden ... md:block", donc
  // jamais affiché sur mobile malgré `texte.includes("$")` vrai -- même
  // raison de ref séparé que le calque plein écran ci-dessus.
  const apercuFormulesMobileRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (apercuFormulesMobileRef.current) {
      apercuFormulesMobileRef.current.scrollTop = apercuFormulesMobileRef.current.scrollHeight;
    }
  }, [texte]);
  // Calque/textarea séparés pour le plein écran -- reste monté en même
  // temps que le composer compact (juste recouvert par l'overlay), donc
  // impossible de partager les mêmes refs entre les deux.
  const zoneTextePleinEcranRef = useRef<HTMLTextAreaElement>(null);
  const calquePleinEcranRef = useRef<HTMLDivElement>(null);

  // Aperçu des fichiers joints AVANT envoi (2026-07-20, bug trouvé par
  // Bourama : jusqu'ici juste le nom du fichier en texte, aucune vignette).
  // URL.createObjectURL uniquement pour les images -- documents/vidéos
  // gardent le chip icône+nom (une vraie prévisualisation vidéo ou PDF
  // demanderait un lecteur/rendu dédié, hors scope de ce correctif ciblé).
  // Devenu un tableau le 17/08 (demande Bourama : "permet l'upload de
  // plusieurs fichiers dans le chat").
  function ajouterFichiers(nouveaux: File[]) {
    if (!nouveaux.length) return;
    setFichiers((prec) => [
      ...prec,
      ...nouveaux.map((f) => ({
        id: crypto.randomUUID(),
        fichier: f,
        apercu: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
      })),
    ]);
  }

  function retirerFichier(id: string) {
    setFichiers((prec) => {
      const cible = prec.find((f) => f.id === id);
      if (cible?.apercu) URL.revokeObjectURL(cible.apercu);
      return prec.filter((f) => f.id !== id);
    });
    setImageAgrandieId((prec) => (prec === id ? null : prec));
  }

  function viderFichiers() {
    setFichiers((prec) => {
      prec.forEach((f) => f.apercu && URL.revokeObjectURL(f.apercu));
      return [];
    });
  }

  // Auto-agrandissement du textarea (2026-07-20, bug trouvé par Bourama en
  // test réel) -- rows={1} fixait la hauteur à une seule ligne sans aucune
  // logique de croissance : dès qu'on passait à la ligne, le texte
  // défilait DANS cette unique ligne au lieu que le cadre grandisse, donc
  // tout ce qui était au-dessus du curseur sortait du cadre visible.
  // Approche standard (pas de lib) : hauteur remise à "auto" puis fixée à
  // scrollHeight à chaque frappe -- le CSS max-h-40 (voir plus bas) prend
  // le relais au-delà pour repasser en défilement interne plutôt que de
  // grandir indéfiniment.
  function ajusterHauteurTexte() {
    const el = zoneTexteRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => {
    ajusterHauteurTexte();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dictée vocale (2026-07-20) : enregistrement micro réel via
  // MediaRecorder, transcrit par Whisper/Groq (api/uploads.py:
  // uploader_audio_chat) puis ajouté au texte -- pas d'envoi automatique,
  // l'étudiant garde la main pour relire/corriger avant d'envoyer.
  const [dictant, setDictant] = useState(false);
  const [transcriptionEnCours, setTranscriptionEnCours] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // Localisation (2026-07-20) : jointe explicitement via ce bouton, jamais
  // capturée en silence -- voir core/main.py:chat(), paramètre
  // `localisation`, injecté en contexte de prompt système.
  const [localisation, setLocalisation] = useState<LocalisationJointe>(null);
  const [localisationEnCours, setLocalisationEnCours] = useState(false);

  // Connexion GitHub (2026-07-22) : bouton dédié, style de l'app (pas les
  // couleurs de marque GitHub) -- voir connexions/oauth_generique.py et
  // core/serveur_mcp_github.py côté backend. `null` = statut pas encore
  // connu (chargement), évite un flash "non connecté" au premier rendu.
  const [githubConnecte, setGithubConnecte] = useState<boolean | null>(null);
  const [githubEnCours, setGithubEnCours] = useState(false);
  // Sélecteur de dépôts (2026-07-22) : ouvert au clic quand déjà connecté
  // -- cliquer un dépôt insère son lien dans le champ, pas d'envoi
  // automatique (la personne garde la main pour écrire sa question).
  const [depots, setDepots] = useState<{ nom_complet: string; prive: boolean; description: string | null }[] | null>(
    null
  );
  const [selecteurOuvert, setSelecteurOuvert] = useState(false);
  const selecteurRef = useRef<HTMLDivElement>(null);
  // Panneau mobile ajouté séparément du bloc desktop (2026-07-30, voir plus
  // bas) -- exclu ici aussi, sinon tout tap À L'INTÉRIEUR de ce nouveau
  // panneau (ex: choisir un dépôt) serait interprété comme un clic
  // EXTÉRIEUR (il n'est pas contenu dans selecteurRef) et refermerait le
  // sélecteur avant même que choisirDepot() ait pu s'exécuter -- même piège
  // que le bug initial.
  const selecteurMobileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selecteurOuvert) return;
    function gererClicExterieur(e: MouseEvent) {
      const cible = e.target as Node;
      if (selecteurRef.current?.contains(cible)) return;
      if (selecteurMobileRef.current?.contains(cible)) return;
      setSelecteurOuvert(false);
    }
    document.addEventListener("mousedown", gererClicExterieur);
    return () => document.removeEventListener("mousedown", gererClicExterieur);
  }, [selecteurOuvert]);

  useEffect(() => {
    statutConnexion("github")
      .then((r) => setGithubConnecte(r.connecte))
      .catch(() => setGithubConnecte(false));
  }, []);

  // Connexion Notion (01/08, activation complète demandée par Bourama) --
  // même pattern que githubConnecte/selecteurOuvert ci-dessus. Le choix du
  // sélecteur (plutôt que juste activer notion-search) : "Un sélecteur
  // (façon dépôts GitHub) pour choisir une page/base Notion précise à
  // insérer dans le champ", décision explicite de Bourama.
  const [notionConnecte, setNotionConnecte] = useState<boolean | null>(null);
  const [notionEnCours, setNotionEnCours] = useState(false);
  const [pagesNotionListe, setPagesNotionListe] = useState<
    { titre: string; type: "page" | "database"; url: string }[] | null
  >(null);
  // CORRECTION (01/08) : contrairement aux dépôts GitHub (listing complet
  // via /user/repos), notion-search est une recherche sémantique -- son
  // paramètre query est OBLIGATOIRE côté outil MCP (voir api/connexions.py).
  // Un simple "charger au premier clic" comme cliquerGithub ne peut donc
  // pas marcher : il faut une vraie zone de recherche, avec un texte tapé
  // par la personne, débouncé avant chaque appel réseau.
  const [rechercheNotion, setRechercheNotion] = useState("");
  const [selecteurNotionOuvert, setSelecteurNotionOuvert] = useState(false);
  const selecteurNotionRef = useRef<HTMLDivElement>(null);
  const selecteurNotionMobileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selecteurNotionOuvert) return;
    function gererClicExterieur(e: MouseEvent) {
      const cible = e.target as Node;
      if (selecteurNotionRef.current?.contains(cible)) return;
      if (selecteurNotionMobileRef.current?.contains(cible)) return;
      setSelecteurNotionOuvert(false);
    }
    document.addEventListener("mousedown", gererClicExterieur);
    return () => document.removeEventListener("mousedown", gererClicExterieur);
  }, [selecteurNotionOuvert]);

  useEffect(() => {
    statutConnexion("notion")
      .then((r) => setNotionConnecte(r.connecte))
      .catch(() => setNotionConnecte(false));
  }, []);

  // Recherche débouncée (400ms) déclenchée par la frappe, uniquement
  // pendant que le sélecteur est ouvert. Champ vide -> pas d'appel réseau,
  // liste remise à null (affiche l'invite "tape pour chercher").
  useEffect(() => {
    if (!selecteurNotionOuvert) return;
    if (!rechercheNotion.trim()) {
      setPagesNotionListe(null);
      return;
    }
    setNotionEnCours(true);
    const delai = setTimeout(() => {
      pagesNotion(rechercheNotion)
        .then(({ pages }) => setPagesNotionListe(pages))
        .catch((e) => {
          setPagesNotionListe([]);
          alert(messageErreur(e));
        })
        .finally(() => setNotionEnCours(false));
    }, 400);
    return () => clearTimeout(delai);
  }, [rechercheNotion, selecteurNotionOuvert]);

  async function cliquerNotion() {
    if (!notionConnecte) {
      setNotionEnCours(true);
      try {
        const { url } = await demarrerConnexion("notion", agentId);
        window.location.href = url;
      } catch (e) {
        alert(messageErreur(e));
        setNotionEnCours(false);
      }
      return;
    }

    // Déjà connecté : ouvre/ferme simplement le sélecteur -- le
    // chargement se fait désormais via la recherche tapée (voir
    // useEffect ci-dessus), pas au clic.
    setSelecteurNotionOuvert((prec) => !prec);
  }

  function choisirPageNotion(url: string) {
    setTexte((prec) => (prec.trim() ? `${prec} ${url}` : url));
    setSelecteurNotionOuvert(false);
    requestAnimationFrame(ajusterHauteurTexte);
  }

  // Écrans "base" (query-data-sources/query-database-view) et "creer"
  // (create-pages) ajoutés le 02/08 (demande Bourama, scope confirmé) au
  // même sélecteur que la recherche de pages ci-dessus -- pas de nouveau
  // composant, juste un état "écran" en plus dans celui-ci.
  const [ecranNotion, setEcranNotion] = useState<"recherche" | "base" | "creer">("recherche");
  const [baseNotionChoisie, setBaseNotionChoisie] = useState<{ titre: string; url: string } | null>(null);
  const [rechercheLignesBase, setRechercheLignesBase] = useState("");
  const [lignesBaseListe, setLignesBaseListe] = useState<
    { titre: string; url: string | null }[] | null
  >(null);
  const [lignesBaseEnCours, setLignesBaseEnCours] = useState(false);
  const [titreCreationNotion, setTitreCreationNotion] = useState("");
  const [contenuCreationNotion, setContenuCreationNotion] = useState("");
  const [creationNotionEnCours, setCreationNotionEnCours] = useState(false);

  // Referme automatiquement les écrans "base"/"creer" à la fermeture du
  // sélecteur (clic extérieur, envoi du message...) -- sans ça, rouvrir le
  // sélecteur retomberait sur le dernier écran visité au lieu de la
  // recherche.
  useEffect(() => {
    if (!selecteurNotionOuvert) {
      setEcranNotion("recherche");
      setBaseNotionChoisie(null);
    }
  }, [selecteurNotionOuvert]);

  // Charge les lignes de la base dès qu'on entre sur l'écran "base"
  // (contrairement à la recherche de pages, PAS besoin d'attendre une
  // frappe -- voir lignes_base_notion côté backend, la base entière est
  // chargée puis filtrée par rechercheLignesBase, debounced 400ms comme
  // pour rechercheNotion ci-dessus).
  useEffect(() => {
    if (ecranNotion !== "base" || !baseNotionChoisie) return;
    setLignesBaseEnCours(true);
    const delai = setTimeout(() => {
      lignesBaseNotion(baseNotionChoisie.url, rechercheLignesBase)
        .then(({ lignes }) => setLignesBaseListe(lignes))
        .catch((e) => {
          setLignesBaseListe([]);
          alert(messageErreur(e));
        })
        .finally(() => setLignesBaseEnCours(false));
    }, 400);
    return () => clearTimeout(delai);
  }, [rechercheLignesBase, ecranNotion, baseNotionChoisie]);

  // Remplace choisirPageNotion comme handler de clic sur un résultat de
  // /notion/pages : une base ouvre l'écran "base" (query) au lieu d'insérer
  // directement son URL, une page garde l'ancien comportement.
  function choisirResultatNotion(p: { titre: string; type: "page" | "database"; url: string }) {
    if (p.type === "database") {
      setBaseNotionChoisie({ titre: p.titre, url: p.url });
      setLignesBaseListe(null);
      setRechercheLignesBase("");
      setEcranNotion("base");
      return;
    }
    choisirPageNotion(p.url);
  }

  function retourRechercheNotion() {
    setEcranNotion("recherche");
    setBaseNotionChoisie(null);
    setLignesBaseListe(null);
    setRechercheLignesBase("");
  }

  function choisirLigneBase(url: string | null, titre: string) {
    const valeur = url ?? titre;
    setTexte((prec) => (prec.trim() ? `${prec} ${valeur}` : valeur));
    setSelecteurNotionOuvert(false);
    requestAnimationFrame(ajusterHauteurTexte);
  }

  function ouvrirCreationNotion() {
    setTitreCreationNotion("");
    setContenuCreationNotion("");
    setEcranNotion("creer");
  }

  async function soumettreCreationNotion() {
    if (!titreCreationNotion.trim()) return;
    setCreationNotionEnCours(true);
    try {
      const { url } = await creerPageNotion(titreCreationNotion.trim(), contenuCreationNotion);
      setTexte((prec) => (prec.trim() ? `${prec} ${url}` : url));
      setSelecteurNotionOuvert(false);
      requestAnimationFrame(ajusterHauteurTexte);
    } catch (e) {
      alert(messageErreur(e));
    } finally {
      setCreationNotionEnCours(false);
    }
  }

  // Contenu partagé des 3 rendus du sélecteur Notion (mono-appli desktop,
  // multi-appli desktop, mobile -- même contrainte de duplication que le
  // reste du fichier, voir les 3 sites d'appel). `fondChamp`/`fondHover`
  // reprennent exactement les classes déjà utilisées à chaque site avant
  // cet ajout (bg-dj-surface côté desktop, bg-dj-surface-haute côté
  // mobile), pour ne rien changer visuellement à l'écran "recherche".
  function contenuSelecteurNotion(fondChamp: string, fondHover: string) {
    if (ecranNotion === "creer") {
      return (
        <div className="p-2">
          <button
            type="button"
            onClick={retourRechercheNotion}
            className="mb-2 text-xs text-dj-texte-muet transition-colors hover:text-dj-texte"
          >
            ← Retour
          </button>
          <input
            type="text"
            autoFocus
            value={titreCreationNotion}
            onChange={(e) => setTitreCreationNotion(e.target.value)}
            placeholder="Titre de la page"
            className={`mb-1 w-full rounded-lg border border-dj-bordure ${fondChamp} px-3 py-2 text-sm text-dj-texte outline-none placeholder:text-dj-texte-muet`}
          />
          <textarea
            value={contenuCreationNotion}
            onChange={(e) => setContenuCreationNotion(e.target.value)}
            placeholder="Contenu (optionnel)"
            rows={4}
            className={`mb-2 w-full rounded-lg border border-dj-bordure ${fondChamp} px-3 py-2 text-sm text-dj-texte outline-none placeholder:text-dj-texte-muet`}
          />
          <button
            type="button"
            onClick={soumettreCreationNotion}
            disabled={creationNotionEnCours || !titreCreationNotion.trim()}
            className="w-full rounded-lg bg-dj-accent-1 px-3 py-2 text-sm text-white transition-opacity disabled:opacity-50"
          >
            {creationNotionEnCours ? "Création..." : "Créer la page"}
          </button>
        </div>
      );
    }

    if (ecranNotion === "base" && baseNotionChoisie) {
      return (
        <div>
          <div className="flex items-center gap-1 px-2 pb-1 pt-1">
            <button
              type="button"
              onClick={retourRechercheNotion}
              className="text-xs text-dj-texte-muet transition-colors hover:text-dj-texte"
            >
              ← Retour
            </button>
            <span className="truncate text-xs text-dj-texte-muet">{baseNotionChoisie.titre}</span>
          </div>
          <input
            type="text"
            autoFocus
            value={rechercheLignesBase}
            onChange={(e) => setRechercheLignesBase(e.target.value)}
            placeholder="Filtrer les lignes..."
            className={`mb-1 w-full rounded-lg border border-dj-bordure ${fondChamp} px-3 py-2 text-sm text-dj-texte outline-none placeholder:text-dj-texte-muet`}
          />
          <div className="max-h-56 overflow-y-auto">
            {lignesBaseEnCours && (
              <div className="space-y-1.5 px-3 py-2" aria-hidden>
                <Skeleton className="h-3 w-3/4 rounded" />
                <Skeleton className="h-3 w-1/2 rounded" style={{ animationDelay: "120ms" }} />
                <Skeleton className="h-3 w-2/3 rounded" style={{ animationDelay: "240ms" }} />
              </div>
            )}
            {!lignesBaseEnCours && lignesBaseListe?.length === 0 && (
              <p className="px-3 py-2 text-xs text-dj-texte-muet">Aucune ligne trouvée.</p>
            )}
            {lignesBaseListe?.map((l, i) => (
              <button
                key={l.url ?? i}
                type="button"
                onClick={() => choisirLigneBase(l.url, l.titre)}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm text-dj-texte transition-colors hover:${fondHover}`}
              >
                {l.titre}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <>
        <input
          type="text"
          autoFocus
          value={rechercheNotion}
          onChange={(e) => setRechercheNotion(e.target.value)}
          placeholder="Chercher une page ou une base..."
          className={`mb-1 w-full rounded-lg border border-dj-bordure ${fondChamp} px-3 py-2 text-sm text-dj-texte outline-none placeholder:text-dj-texte-muet`}
        />
        <button
          type="button"
          onClick={ouvrirCreationNotion}
          className={`mb-1 block w-full rounded-lg px-3 py-2 text-left text-sm text-dj-accent-1 transition-colors hover:${fondHover}`}
        >
          + Créer une page
        </button>
        <div className="max-h-56 overflow-y-auto">
          {!rechercheNotion.trim() && (
            <p className="px-3 py-2 text-xs text-dj-texte-muet">Tape pour chercher dans ton Notion.</p>
          )}
          {rechercheNotion.trim() && notionEnCours && (
            <p className="px-3 py-2 text-xs text-dj-texte-muet">Recherche...</p>
          )}
          {rechercheNotion.trim() && !notionEnCours && pagesNotionListe?.length === 0 && (
            <p className="px-3 py-2 text-xs text-dj-texte-muet">Aucune page trouvée.</p>
          )}
          {pagesNotionListe?.map((p) => (
            <button
              key={p.url}
              type="button"
              onClick={() => choisirResultatNotion(p)}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm text-dj-texte transition-colors hover:${fondHover}`}
            >
              <span className="flex items-center gap-1.5">
                {p.titre}
                {p.type === "database" && (
                  <span className={`rounded ${fondHover} px-1.5 py-0.5 text-[10px] text-dj-texte-muet`}>
                    base
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </>
    );
  }

  async function cliquerGithub() {
    if (!githubConnecte) {
      setGithubEnCours(true);
      try {
        const { url } = await demarrerConnexion("github", agentId);
        window.location.href = url;
      } catch (e) {
        // Corrigé le 2026-07-23, puis le 2026-07-31 (demarrerConnexion lève
        // maintenant une vraie erreur au lieu de renvoyer {url: null,
        // erreur: "..."}) : masquait la vraie cause (erreur réseau,
        // 401/500 côté backend, session expirée...) derrière le même
        // texte générique à chaque fois -- même correction que pour la
        // dictée vocale et l'upload de fichiers plus tôt dans la session.
        alert(messageErreur(e));
        setGithubEnCours(false);
      }
      return;
    }

    // Déjà connecté : ouvre/ferme le sélecteur de dépôts, en chargeant la
    // liste au premier clic seulement (pas re-fetché à chaque ouverture).
    setSelecteurOuvert((prec) => !prec);
    if (depots === null) {
      setGithubEnCours(true);
      try {
        const { depots: liste } = await depotsGithub();
        setDepots(liste);
      } catch (e) {
        setDepots([]);
        alert(messageErreur(e));
      } finally {
        setGithubEnCours(false);
      }
    }
  }

  function choisirDepot(nomComplet: string) {
    setTexte((prec) => (prec.trim() ? `${prec} https://github.com/${nomComplet}` : `https://github.com/${nomComplet}`));
    setSelecteurOuvert(false);
    requestAnimationFrame(ajusterHauteurTexte);
  }

  function pasDisponible() {
    alert("Pas disponible pour le moment.");
  }

  // Mise à jour live de la formule en construction (2026-07-27, "les
  // symboles s'insèrent automatiquement, pas de bouton insérer/effacer").
  // `contenuAffiche` est déjà le texte final ($...$) à placer -- si une
  // portion est déjà en cours de construction (plageFormuleLive), on la
  // remplace entièrement ; sinon on insère à la position actuelle du
  // curseur et on commence à la suivre. Ne touche jamais le focus/la
  // sélection du textarea -- le focus reste dans le champ MathLive/chimie
  // pendant que la personne tape, sans quoi chaque frappe lui volerait le
  // clavier.
  function mettreAJourFormuleLive(contenuAffiche: string) {
    if (plageFormuleLive) {
      const nouveauTexte = texte.slice(0, plageFormuleLive.debut) + contenuAffiche + texte.slice(plageFormuleLive.fin);
      setTexte(nouveauTexte);
      setPlageFormuleLive(contenuAffiche ? { debut: plageFormuleLive.debut, fin: plageFormuleLive.debut + contenuAffiche.length } : null);
    } else if (contenuAffiche) {
      const ref = pleinEcranSaisie ? zoneTextePleinEcranRef : zoneTexteRef;
      const el = ref.current;
      const debut = el?.selectionStart ?? texte.length;
      const fin = el?.selectionEnd ?? texte.length;
      const nouveauTexte = texte.slice(0, debut) + contenuAffiche + texte.slice(fin);
      setTexte(nouveauTexte);
      setPlageFormuleLive({ debut, fin: debut + contenuAffiche.length });
    }
    setFormuleInitiale(undefined);
    requestAnimationFrame(ajusterHauteurTexte);
  }

  // Arrête de suivre la portion en cours (changement d'onglet Maths<->
  // Chimie, ou fermeture du panneau) -- le texte déjà inséré reste tel
  // quel, mais une frappe suivante commencera une NOUVELLE formule
  // ailleurs plutôt que de continuer à réécrire par-dessus celle-ci.
  function finaliserFormuleLive() {
    setPlageFormuleLive(null);
  }

  function gererCollage(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const texteColleBrut = e.clipboardData.getData("text/plain");
    const langage = detecterLangageCode(texteColleBrut);

    // LaTeX (2026-07-27, corrige un conflit signalé par Bourama) : ne
    // part plus vers la pièce jointe "Formule collée" -- ça empêchait
    // l'aperçu en direct au-dessus du champ (segmenterTexteAvecFormules)
    // de jamais voir cette formule, puisqu'elle n'atteignait jamais
    // `texte`, les deux mécanismes se marchant dessus. Un collage LaTeX
    // s'insère maintenant normalement dans le champ, entouré de $$...$$
    // s'il ne l'était pas déjà, pour que l'aperçu le rende tout de suite.
    if (langage === "latex") {
      e.preventDefault();
      const contenuDelimite = /\$/.test(texteColleBrut) ? texteColleBrut : `$$${texteColleBrut.trim()}$$`;
      const ref = pleinEcranSaisie ? zoneTextePleinEcranRef : zoneTexteRef;
      const el = ref.current;
      const debut = el?.selectionStart ?? texte.length;
      const fin = el?.selectionEnd ?? texte.length;
      const nouveauTexte = texte.slice(0, debut) + contenuDelimite + texte.slice(fin);
      setTexte(nouveauTexte);
      requestAnimationFrame(() => {
        el?.focus();
        const pos = debut + contenuDelimite.length;
        el?.setSelectionRange(pos, pos);
        ajusterHauteurTexte();
      });
      return;
    }

    if (texteColleBrut.length > SEUIL_COLLAGE_LONG || langage) {
      e.preventDefault();
      setTexteColle(texteColleBrut);
      setLangageDetecte(langage);
    }
  }

  function envoyer() {
    if ((!texte.trim() && !texteColle) || desactive) return;
    onEnvoyer(
      texte,
      longueur,
      fichiers.map((f) => f.fichier),
      localisation,
      texteColle,
      rechercheForcee,
      sansEnseignant
    );
    setTexte("");
    viderFichiers();
    setLocalisation(null);
    setTexteColle(null);
    setLangageDetecte(null);
    setRechercheForcee(false);
    setSansEnseignant(false);
    requestAnimationFrame(ajusterHauteurTexte);
  }

  async function demarrerDictee() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((piste) => piste.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setTranscriptionEnCours(true);
        try {
          const fichierAudio = new File([blob], "dictee.webm", { type: blob.type });
          const { texte: transcrit } = await transcrireAudioChat(fichierAudio);
          setTexte((prec) => (prec.trim() ? `${prec} ${transcrit}` : transcrit));
          requestAnimationFrame(ajusterHauteurTexte);
        } catch (e) {
          // Message générique remplacé le 2026-07-20 : masquait la vraie
          // cause (non connecté / audio vide-silencieux / vraie erreur
          // serveur) derrière un seul texte, impossible à diagnostiquer
          // depuis le retour utilisateur.
          alert(messageErreur(e));
        } finally {
          setTranscriptionEnCours(false);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setDictant(true);
    } catch {
      alert("Micro indisponible ou refusé.");
    }
  }

  function arreterDictee() {
    mediaRecorderRef.current?.stop();
    setDictant(false);
  }

  function toggleLocalisation() {
    if (localisation) {
      setLocalisation(null);
      return;
    }
    if (!navigator.geolocation) {
      alert("Géolocalisation non disponible sur cet appareil.");
      return;
    }
    setLocalisationEnCours(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocalisation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocalisationEnCours(false);
      },
      () => {
        alert("Position refusée ou indisponible.");
        setLocalisationEnCours(false);
      }
    );
  }

  return (
    <div className="w-full">
      {/* Vignettes d'aperçu (fichiers joints / position jointe), avant envoi. */}
      {(fichiers.length > 0 || localisation || texteColle) && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {fichiers.map(({ id, fichier, apercu }) =>
            apercu ? (
              <div key={id} className="relative w-fit">
                <button
                  onClick={() => setImageAgrandieId(id)}
                  aria-label="Agrandir l'image"
                  className="block h-16 w-16 overflow-hidden rounded-xl border border-dj-bordure"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (URL.createObjectURL) */}
                  <img src={apercu} alt={fichier.name} className="h-full w-full object-cover" />
                </button>
                <button
                  onClick={() => retirerFichier(id)}
                  aria-label="Retirer le fichier"
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-dj-fond text-dj-texte-muet hover:text-dj-texte"
                >
                  <X size={12} />
                </button>
                {/* OCR ciblé formule (2026-07-26) -- extrait le LaTeX de
                    l'image et l'ouvre dans EditeurFormule pour relecture
                    avant insertion, plutôt que d'envoyer l'image telle
                    quelle et espérer que Nucleos la lise correctement.
                    Cible toujours la première image du tableau (voir
                    extraireFormuleDeImage), donc affiché seulement sur
                    cette vignette-là pour ne pas laisser croire qu'il agit
                    sur une image précise parmi plusieurs. */}
                {fichiers.find((f) => f.apercu)?.id === id && (
                  <button
                    onClick={extraireFormuleDeImage}
                    disabled={extractionFormuleEnCours}
                    aria-label="Extraire la formule de cette image"
                    title="Extraire la formule"
                    className="absolute -bottom-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-dj-surface-haute text-dj-texte disabled:opacity-60"
                  >
                    <Sigma size={11} className={extractionFormuleEnCours ? "animate-pulse" : ""} />
                  </button>
                )}
              </div>
            ) : fichier.type.startsWith("video/") || fichier.type.startsWith("audio/") ? (
              // Aperçu jouable avant envoi (2026-07-23, demande de Bourama :
              // avant on ne voyait qu'un nom de fichier cliquable, aucun
              // moyen d'écouter/regarder avant d'envoyer) -- même lecteur
              // que celui utilisé pour un lien reçu, sur une URL locale
              // (blob), pas encore uploadée.
              <div key={id} className="relative w-full max-w-xs">
                <LecteurMedia
                  href={URL.createObjectURL(fichier)}
                  type={fichier.type.startsWith("video/") ? "video" : "audio"}
                />
                <button
                  onClick={() => retirerFichier(id)}
                  aria-label="Retirer le fichier"
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-dj-fond text-dj-texte-muet hover:text-dj-texte"
                >
                  <X size={12} />
                </button>
              </div>
            ) : fichier.type === "application/pdf" ? (
              // 17/08 (Bourama : "regarde partout où on upload") -- avant,
              // un PDF choisi ici tombait dans le cas générique juste en
              // dessous (ouverture en nouvel onglet). Ici le blob est
              // forcément local (le fichier choisi par l'utilisateur sur
              // sa machine, pas encore envoyé) donc intrinsèquement sûr à
              // afficher en iframe, contrairement à FichierChip où
              // estOrigineDeConfiance protège contre un lien externe
              // arbitraire -- cette vérification n'a pas lieu d'être ici.
              <div key={id} className="relative w-full max-w-xs">
                <iframe
                  src={URL.createObjectURL(fichier)}
                  className="h-64 w-full rounded-xl border border-dj-bordure"
                  title={fichier.name}
                />
                <button
                  onClick={() => retirerFichier(id)}
                  aria-label="Retirer le fichier"
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-dj-fond text-dj-texte-muet hover:text-dj-texte"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div key={id} className="flex w-fit items-center gap-2 rounded-xl border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-xs text-dj-texte-muet">
                <button
                  onClick={() => window.open(URL.createObjectURL(fichier), "_blank")}
                  aria-label="Ouvrir le fichier"
                  className="flex items-center gap-2 hover:text-dj-texte"
                >
                  <FileText size={14} />
                  <span className="max-w-[180px] truncate">{fichier.name}</span>
                </button>
                <button onClick={() => retirerFichier(id)} aria-label="Retirer le fichier" className="hover:text-dj-texte">
                  <X size={14} />
                </button>
              </div>
            )
          )}
          {localisation && (
            <div className="flex w-fit items-center gap-2 rounded-xl border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-xs text-dj-texte-muet">
              <MapPin size={14} />
              <span>Position jointe</span>
              <button onClick={() => setLocalisation(null)} aria-label="Retirer la position" className="hover:text-dj-texte">
                <X size={14} />
              </button>
            </div>
          )}
          {texteColle && (
            <button
              onClick={() => setTexteColleOuvert(true)}
              className="flex w-fit items-center gap-2 rounded-xl border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-xs text-dj-texte-muet hover:text-dj-texte"
            >
              {langageDetecte ? <Code size={14} /> : <FileText size={14} />}
              <span>{libellePieceJointe(langageDetecte, texteColle)}</span>
              <span
                role="button"
                aria-label="Retirer le texte collé"
                onClick={(e) => {
                  e.stopPropagation();
                  setTexteColle(null);
                  setLangageDetecte(null);
                }}
                className="hover:text-dj-texte"
              >
                <X size={14} />
              </span>
            </button>
          )}
        </div>
      )}

      {/* Rectangle à coins arrondis (plus une pilule ovale complète), tous
          les éléments alignés en bas -- voir section 3.3. */}
      <div className="relative hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface-haute px-4 py-3 focus-within:border-dj-bordure-forte md:block">
        {/* Aperçu formules (2026-07-27) -- affiché seulement si le
            brouillon contient au moins un "$", pour ne pas dupliquer
            inutilement un simple message texte sans maths. Placé
            au-dessus du textarea (demande explicite de Bourama), lecture
            seule, pas de curseur/sélection ici -- seulement pour
            visualiser le rendu final avant envoi. */}
        {texte.includes("$") && (
          <div
            ref={apercuFormulesRef}
            className="mb-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-dj-bordure bg-dj-surface px-3 py-2 text-[15px] leading-relaxed text-dj-texte"
          >
            {segmenterTexteAvecFormules(texte).map((s, i) =>
              s.formule ? (
                <span key={i} dangerouslySetInnerHTML={{ __html: rendreFormuleKatex(s.texte, !!s.bloc) }} />
              ) : (
                <span key={i}>{s.texte}</span>
              )
            )}
          </div>
        )}
        <div className="relative">
          {/* Calque de couleur -- lecture seule, non interactif
              (pointer-events-none), affiche EXACTEMENT le même texte que
              le textarea réel juste au-dessus dans le DOM (même police/
              taille/interligne/césure), avec les liens en gris souligné
              (dj-texte-muet, 24/08 : plus de couleur accent ici, réservée
              aux actions principales). Le vrai texte du textarea est rendu invisible
              (text-transparent, voir plus bas) -- c'est ce calque qui
              porte toute la couleur visible. */}
          <div
            ref={calqueRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 max-h-64 overflow-hidden whitespace-pre-wrap break-words text-[15px] leading-normal text-dj-texte"
          >
            {texte
              ? segmenterTexteAvecLiens(texte).map((s, i) =>
                  s.lien ? (
                    <span key={i} className="text-dj-texte-muet underline">
                      {s.texte}
                    </span>
                  ) : (
                    <span key={i}>{s.texte}</span>
                  )
                )
              : null}
            {/* Espace de fin pour que le calque ait la même hauteur que le
                textarea même quand le texte se termine par un retour à la
                ligne (sinon scrollHeight des deux diverge légèrement). */}
            {texte.endsWith("\n") && "\u200b"}
          </div>
          <textarea
            ref={zoneTexteRef}
            value={texte}
            onChange={(e) => {
              setTexte(e.target.value);
              ajusterHauteurTexte();
            }}
            onPaste={gererCollage}
            onScroll={(e) => {
              if (calqueRef.current) calqueRef.current.scrollTop = e.currentTarget.scrollTop;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                envoyer();
              }
            }}
            placeholder={transcriptionEnCours ? "Transcription en cours..." : "Pose ta question..."}
            rows={1}
            className="relative max-h-64 w-full resize-none overflow-y-auto bg-transparent text-[15px] leading-normal text-transparent caret-dj-texte outline-none placeholder:text-dj-texte-muet"
          />
        </div>

        {/* Éditeur maths/chimie fusionné (2026-07-27, demande Bourama :
            "plus de popup") -- s'ouvre SOUS le champ de texte, qui lui
            reste toujours en haut, fixe. Contrôlé par le seul bouton Σ
            de la barre d'outils ci-dessous (voir EditeurFormule.tsx pour
            le détail : onglets Maths/Chimie, champ MathLive + son
            clavier virtuel complet, palette chimie). */}
        {editeurFormuleOuvert && (
          <EditeurFormule
            onChangeLive={mettreAJourFormuleLive}
            onChangerOnglet={finaliserFormuleLive}
            onFermer={() => {
              setEditeurFormuleOuvert(false);
              setFormuleInitiale(undefined);
              finaliserFormuleLive();
            }}
            valeurInitiale={formuleInitiale}
          />
        )}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-y-2">
          <div className="flex items-center gap-3">
            {/* Punaise (remplace le "+"), contour monochrome, même fonction
                (upload fichier) -- section 3.3. Accepte images ET documents
                depuis le 2026-07-20 (voir TYPES_FICHIERS_ACCEPTES). */}
            <button
              onClick={() => inputFichierRef.current?.click()}
              aria-label="Joindre un fichier"
              className="text-dj-texte-muet transition-colors hover:text-dj-texte"
            >
              <Pin size={18} />
            </button>
            <input
              ref={inputFichierRef}
              type="file"
              accept={TYPES_FICHIERS_ACCEPTES}
              multiple
              className="hidden"
              onChange={(e) => {
                ajouterFichiers(Array.from(e.target.files ?? []));
                // Sans ça, choisir deux fois DE SUITE le(s) même(s)
                // fichier(s) (ex: retirer puis rejoindre le même) ne
                // redéclenche pas onChange -- même valeur input.
                e.target.value = "";
              }}
            />

            {/* Slots variables "Utilitaires récents" (2026-07-28, refonte
                demandée par Bourama -- révisé le 2026-08-20 lors du
                nettoyage du menu Outils manuel mort). Jusqu'à 3 raccourcis
                vers les derniers utilitaires ui_* utilisés (localisation,
                formule, recherche, dessin). Le menu Outils manuel
                (sélection d'un outil backend forcé) a été retiré
                entièrement : mort depuis son kill-switch du 13/08, jamais
                réactivé, remplacé par le routeur automatique côté backend
                pour l'agent clovis. CORRECTION (2026-08-20) : la
                condition précédente dépendait d'un flag mort
                (AFFICHER_BOUTON_OUTILS), qui empêchait ces slots de
                remonter le moindre utilitaire récent malgré l'intention
                d'origine -- corrigé, filtré par sécurité sur ce qui est
                encore autorisé pour l'agent (outilsUtilitairesPourAgent). */}
            {outilsRecents
              .filter((n) => outilsUtilitairesPourAgent.some((o) => o.nom === n))
              .map((nom) => {
                const entree = outilsDisponibles.find((o) => o.nom === nom);
                if (!entree) return null;
                const actif = estOutilActif(nom);
                return (
                  <button
                    key={nom}
                    onClick={() => executerActionOutil(nom)}
                    disabled={nom === "ui_localisation" && localisationEnCours}
                    aria-label={entree.label}
                    title={entree.label}
                    className={
                      "animate-dj-fade-in-rapide " +
                      (actif ? "text-dj-texte transition-colors" : "text-dj-texte-muet transition-colors hover:text-dj-texte") +
                      " disabled:opacity-60"
                    }
                  >
                    <entree.Icone size={18} />
                  </button>
                );
              })}

            {/* Slot variable "Appli" (2026-07-28, corrigé le 2026-07-30
                pour dépendre du nombre RÉEL d'applis activées pour CET
                agent -- flux 3) -- affiché seul (sans bouton dropdown)
                uniquement si l'agent n'a exactement qu'une seule appli
                activée. Cas GitHub traité à part pour conserver le
                sélecteur de dépôts déjà en place -- les futures applis
                passeront par executerActionAppli seul, sans dropdown
                dédié, tant qu'elles n'en ont pas besoin. */}
            {appliSlotUnique?.nom === "github" && (
              <div className="relative" ref={selecteurRef}>
                <button
                  onClick={() => executerActionAppli("github")}
                  disabled={githubEnCours}
                  aria-label={githubConnecte ? "Choisir un dépôt GitHub" : "Connecter GitHub"}
                  title={githubConnecte ? "Choisir un dépôt GitHub" : "Connecter GitHub"}
                  className={
                    githubConnecte
                      ? "relative text-dj-texte transition-colors"
                      : "relative text-dj-texte-muet transition-colors hover:text-dj-texte disabled:opacity-60"
                  }
                >
                  <Github size={18} />
                  {githubConnecte && (
                    <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-green-500" />
                  )}
                </button>

                {selecteurOuvert && (
                  <div className="absolute bottom-full left-0 z-30 mb-2 max-h-64 w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-dj-bordure bg-dj-surface-haute p-1 shadow-xl">
                    {depots === null && (
                      <div className="space-y-1.5 px-3 py-2" aria-hidden>
                        <Skeleton className="h-3 w-3/4 rounded" />
                        <Skeleton className="h-3 w-1/2 rounded" style={{ animationDelay: "120ms" }} />
                        <Skeleton className="h-3 w-2/3 rounded" style={{ animationDelay: "240ms" }} />
                      </div>
                    )}
                    {depots?.length === 0 && (
                      <p className="px-3 py-2 text-xs text-dj-texte-muet">Aucun dépôt trouvé.</p>
                    )}
                    {depots?.map((d) => (
                      <button
                        key={d.nom_complet}
                        type="button"
                        onClick={() => choisirDepot(d.nom_complet)}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-dj-texte transition-colors hover:bg-dj-surface"
                      >
                        <span className="flex items-center gap-1.5">
                          {d.nom_complet}
                          {d.prive && (
                            <span className="rounded bg-dj-surface px-1.5 py-0.5 text-[10px] text-dj-texte-muet">
                              privé
                            </span>
                          )}
                        </span>
                        {d.description && (
                          <span className="line-clamp-1 text-xs text-dj-texte-muet">{d.description}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Notion (01/08) -- même traitement à part que GitHub
                ci-dessus, pour le cas où un agent n'a QUE Notion
                d'activé (pas GitHub) : sans ce bloc dédié, appliSlotUnique
                vaudrait "notion" mais rien ne le rendrait jamais, le
                bouton Appli resterait invisible pour cet agent -- exactement
                le bug diagnostiqué pour Nucleos. */}
            {appliSlotUnique?.nom === "notion" && (
              <div className="relative" ref={selecteurNotionRef}>
                <button
                  onClick={() => executerActionAppli("notion")}
                  disabled={notionEnCours}
                  aria-label={notionConnecte ? "Choisir une page Notion" : "Connecter Notion"}
                  title={notionConnecte ? "Choisir une page Notion" : "Connecter Notion"}
                  className={
                    notionConnecte
                      ? "relative text-dj-texte transition-colors"
                      : "relative text-dj-texte-muet transition-colors hover:text-dj-texte disabled:opacity-60"
                  }
                >
                  <IconeNotion size={18} />
                  {notionConnecte && (
                    <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-green-500" />
                  )}
                </button>

                {selecteurNotionOuvert && (
                  <div className="absolute bottom-full left-0 z-30 mb-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-dj-bordure bg-dj-surface-haute p-1 shadow-xl">
                    {contenuSelecteurNotion("bg-dj-surface", "bg-dj-surface")}
                  </div>
                )}
              </div>
            )}


            {/* Bouton "Sans enseignant" (06/08/2026, demande Bourama) --
                uniquement pour les agents à contenu dynamique par matière
                (Clovis) : force le prompt généraliste pour le prochain
                message, sans utiliser le contenu d'aucun enseignant même
                si l'étudiant a des matières débloquées. Même pattern
                d'icône que rechercheForcee juste au-dessus. */}
            {boutonSansEnseignant && (
              <button
                onClick={() => setSansEnseignant((v) => !v)}
                aria-label="Répondre sans utiliser le contenu d'un enseignant"
                title="Répondre sans utiliser le contenu d'un enseignant"
                className={
                  "relative rounded-cgpt-bouton p-1 transition-colors " +
                  (sansEnseignant
                    ? "bg-dj-accent-1/10 text-dj-accent-1"
                    : "text-dj-texte-muet hover:text-dj-texte")
                }
              >
                <UserX size={18} />
              </button>
            )}


            {/* Bouton Utilitaires (2026-08-01, demande Bourama : "seront
                un autre bouton à part, plus dans outils") -- ex-onglet
                "utilitaires" du menu Outils, sorti dans son propre bouton
                dédié. MÊME logique de multi-sélection cumulative que le
                bouton Outils (estOutilActif/executerActionOutil déjà
                génériques, y compris pour les entrées "ui_" locales) --
                juste pas d'onglets ici, une seule liste plate. Masqué si
                l'agent n'a aucune entrée utilitaire autorisée. */}
            {outilsUtilitairesPourAgent.length > 0 && (
            <div className="relative">
              <button
                ref={boutonUtilitairesRef}
                onClick={() => setMenuUtilitairesOuvert((v) => !v)}
                aria-label="Choisir un ou plusieurs utilitaires"
                title="Choisir un ou plusieurs utilitaires"
                className={
                  "relative rounded-cgpt-bouton p-1 transition-colors " +
                  (menuUtilitairesOuvert || outilsUtilitairesPourAgent.some((o) => estOutilActif(o.nom))
                    ? "bg-dj-accent-1/10 text-dj-accent-1"
                    : "text-dj-texte-muet hover:text-dj-texte")
                }
              >
                <SlidersHorizontal size={18} />
              </button>
              <div
                ref={menuUtilitairesRef}
                className={
                  "absolute bottom-full left-0 z-20 mb-2 max-h-72 w-64 max-w-[calc(100vw-2rem)] origin-bottom-left overflow-y-auto rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-1 shadow-lg transition-all duration-150 ease-cgpt-doux " +
                  (menuUtilitairesOuvert
                    ? "translate-y-0 scale-100 opacity-100"
                    : "pointer-events-none translate-y-1 scale-95 opacity-0")
                }
              >
                {[...outilsUtilitairesPourAgent]
                  .sort((a, b) => a.label.localeCompare(b.label, "fr"))
                  .map(({ nom, label, Icone }) => {
                    const actif = estOutilActif(nom);
                    return (
                      <button
                        key={nom}
                        onClick={() => executerActionOutil(nom)}
                        className={
                          "flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-xs transition-colors " +
                          (actif ? "bg-dj-accent-1/10 text-dj-accent-1" : "text-dj-texte hover:bg-dj-surface-haute")
                        }
                      >
                        <Icone size={14} />
                        <span className="flex-1">{label}</span>
                        {actif && <Check size={13} />}
                      </button>
                    );
                  })}
              </div>
            </div>
            )}

            {/* Slot variable "dernière appli utilisée" (2026-08-01, bug
                signalé par Bourama : appliRecente était calculé mais
                jamais affiché nulle part). Ne s'affiche QUE quand
                appliButtonVisible (plusieurs applis actives) -- si une
                seule appli, elle reste fixe via appliSlotUnique
                ci-dessus et ne varie jamais, conforme à la règle de
                Bourama ("apparaît et reste... et ne change pas").
                Ici au contraire ça varie : dernière appli cliquée,
                repli sur applisPourAgent[0] tant qu'aucune n'a encore
                été cliquée (même dérivation que `appliRecente`). */}
            {appliButtonVisible && appliRecente && (() => {
              const appli = applisPourAgent.find((a) => a.nom === appliRecente);
              if (!appli) return null;
              const Icone = appli.Icone;
              return (
                <button
                  onClick={() => executerActionAppli(appli.nom)}
                  aria-label={appli.label}
                  title={appli.label}
                  className="relative rounded-cgpt-bouton p-1 text-dj-texte-muet transition-colors hover:text-dj-texte"
                >
                  <Icone size={18} />
                </button>
              );
            })()}

            {/* Icône Appli (2026-07-28) -- icône FIXE (ne varie jamais),
                pendante de l'icône Outils juste au-dessus : ouvre la liste
                complète des applis (nécessitant une connexion utilisateur),
                voir APPLIS_DISPONIBLES en haut du fichier.
                CORRECTION (2026-07-30, flux 3) : ce bouton-dropdown ne
                s'affiche que s'il y a PLUSIEURS applis activées pour
                l'agent (sinon c'est le slot unique ci-dessus qui s'affiche
                directement, sans avoir besoin de choisir). */}
            {appliButtonVisible && (
            <div className="relative">
              <button
                ref={boutonAppliRef}
                onClick={() => setMenuAppliOuvert((v) => !v)}
                aria-label="Choisir une application"
                title="Choisir une application"
                className={
                  "relative rounded-cgpt-bouton p-1 transition-colors " +
                  (menuAppliOuvert ? "bg-dj-surface-haute text-dj-texte" : "text-dj-texte-muet hover:text-dj-texte")
                }
              >
                <LayoutGrid size={18} />
              </button>
              <div
                ref={menuAppliRef}
                className={
                  "absolute bottom-full left-0 z-20 mb-2 max-h-72 w-56 origin-bottom-left overflow-y-auto rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-1 shadow-lg transition-all duration-150 ease-cgpt-doux " +
                  (menuAppliOuvert
                    ? "translate-y-0 scale-100 opacity-100"
                    : "pointer-events-none translate-y-1 scale-95 opacity-0")
                }
              >
                {[...applisPourAgent]
                  .sort((a, b) => a.label.localeCompare(b.label, "fr"))
                  .map(({ nom, label, Icone }) => (
                  <button
                    key={nom}
                    onClick={() => {
                      executerActionAppli(nom);
                      setMenuAppliOuvert(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-xs text-dj-texte transition-colors hover:bg-dj-surface-haute"
                  >
                    <Icone size={14} />
                    <span className="flex-1">{label}</span>
                  </button>
                ))}
              </div>
            </div>
            )}

            {/* Sélecteur de pages Notion desktop pour le cas MULTI-appli
                (01/08, ex. Nucleos avec GitHub + Notion tous les deux
                actifs) -- le bloc appliSlotUnique plus haut ne couvre que
                le cas où Notion est la SEULE appli active. Ici, cliquer
                "Notion" dans le menu déroulant juste au-dessus déclenche
                cliquerNotion() (via executerActionAppli) qui bascule
                selecteurNotionOuvert -- ce panneau l'affiche, ancré au
                même endroit que le bouton Appli. Le panneau mobile
                (md:hidden, plus bas dans le fichier) couvre le petit écran. */}
            {appliButtonVisible && selecteurNotionOuvert && (
              <div className="relative hidden md:block" ref={selecteurNotionRef}>
                <div className="absolute bottom-full left-0 z-30 mb-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-dj-bordure bg-dj-surface-haute p-1 shadow-xl">
                  {contenuSelecteurNotion("bg-dj-surface", "bg-dj-surface")}
                </div>
              </div>
            )}

            {/* Sélecteur de modèle premium (02/08/2026, voir capture
                Bourama : "Sonnet 5   Moyen ⌄" dans la barre de saisie
                desktop, puis "ce style d'affichage n'est pas propre à ma
                plateforme" -- select natif remplacé par le même pattern
                bouton+panneau flottant que le menu Appli plus haut,
                regroupé par distributeur). Masqué si l'agent n'a aucun
                modèle premium débloqué (voir ChatIA.tsx et
                core/fournisseurs_llm.py). "Auto" = pas de préférence,
                cascade Groq/Gemini habituelle. */}
            {modelesDisponibles.length > 0 && (
              <div className="relative">
                <button
                  ref={boutonModeleRef}
                  type="button"
                  onClick={() => setMenuModeleOuvert((v) => !v)}
                  aria-label="Choisir le modèle"
                  className={
                    "flex items-center gap-0.5 rounded-md px-1 py-0.5 text-xs transition-colors " +
                    (menuModeleOuvert ? "text-dj-texte" : "text-dj-texte-muet hover:text-dj-texte")
                  }
                >
                  {modelesDisponibles.find((m) => m.modele_id === modeleSelectionne)?.label ?? "Auto"}
                  <ChevronDown size={12} />
                </button>
                <div
                  ref={menuModeleRef}
                  className={
                    "absolute bottom-full right-0 z-20 mb-2 max-h-80 w-56 origin-bottom-right overflow-y-auto rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-1 shadow-lg transition-all duration-150 ease-cgpt-doux " +
                    (menuModeleOuvert
                      ? "translate-y-0 scale-100 opacity-100"
                      : "pointer-events-none translate-y-1 scale-95 opacity-0")
                  }
                >
                  <button
                    type="button"
                    onClick={() => {
                      onModeleChange?.(null);
                      setMenuModeleOuvert(false);
                    }}
                    className={
                      "flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left text-xs transition-colors hover:bg-dj-surface-haute " +
                      (!modeleSelectionne ? "text-dj-accent-1" : "text-dj-texte")
                    }
                  >
                    Auto
                    {!modeleSelectionne && <Check size={13} />}
                  </button>
                  {ORDRE_DISTRIBUTEURS_AFFICHAGE.filter((d) =>
                    modelesDisponibles.some((m) => m.distributeur === d)
                  ).map((distributeur) => (
                    <div key={distributeur} className="mt-1">
                      <div className="px-2 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-dj-texte-muet">
                        {LABELS_DISTRIBUTEUR[distributeur] ?? distributeur}
                      </div>
                      {modelesDisponibles
                        .filter((m) => m.distributeur === distributeur)
                        .map((m) => (
                          <button
                            key={m.modele_id}
                            type="button"
                            onClick={() => {
                              onModeleChange?.(m.modele_id);
                              setMenuModeleOuvert(false);
                            }}
                            className={
                              "flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left text-xs transition-colors hover:bg-dj-surface-haute " +
                              (modeleSelectionne === m.modele_id ? "text-dj-accent-1" : "text-dj-texte")
                            }
                          >
                            {m.label}
                            {modeleSelectionne === m.modele_id && <Check size={13} />}
                          </button>
                        ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sélecteur Courte/Moyenne/Longue (remplace "Sonnet 5/Moyen"),
                modifiable à chaque message -- section 3.3. Même pattern
                bouton+panneau que le sélecteur de modèle juste au-dessus
                (02/08/2026, select natif retiré pour rester cohérent avec
                le style de la plateforme). */}
            <div className="relative">
              <button
                ref={boutonLongueurRef}
                type="button"
                onClick={() => setMenuLongueurOuvert((v) => !v)}
                aria-label="Choisir la longueur de réponse"
                className={
                  "flex items-center gap-0.5 rounded-md px-1 py-0.5 text-xs transition-colors " +
                  (menuLongueurOuvert ? "text-dj-texte" : "text-dj-texte-muet hover:text-dj-texte")
                }
              >
                {LABELS_LONGUEUR[longueur]}
                <ChevronDown size={12} />
              </button>
              <div
                ref={menuLongueurRef}
                className={
                  "absolute bottom-full right-0 z-20 mb-2 w-40 origin-bottom-right overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-1 shadow-lg transition-all duration-150 ease-cgpt-doux " +
                  (menuLongueurOuvert
                    ? "translate-y-0 scale-100 opacity-100"
                    : "pointer-events-none translate-y-1 scale-95 opacity-0")
                }
              >
                {(["courte", "moyenne", "longue"] as LongueurReponse[]).map((valeur) => (
                  <button
                    key={valeur}
                    type="button"
                    onClick={() => {
                      setLongueur(valeur);
                      setMenuLongueurOuvert(false);
                    }}
                    className={
                      "flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left text-xs transition-colors hover:bg-dj-surface-haute " +
                      (longueur === valeur ? "text-dj-accent-1" : "text-dj-texte")
                    }
                  >
                    {LABELS_LONGUEUR[valeur]}
                    {longueur === valeur && <Check size={13} />}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPleinEcranSaisie(true)}
              aria-label="Agrandir en plein écran"
              className="text-dj-texte-muet transition-colors hover:text-dj-texte"
            >
              <Maximize2 size={16} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {dictant ? (
              <button
                onClick={arreterDictee}
                aria-label="Arrêter la dictée"
                className="flex h-8 w-8 items-center justify-center rounded-cgpt-bouton bg-dj-accent-2 text-white"
              >
                <Square size={14} />
              </button>
            ) : texte.trim() || texteColle ? (
              <button
                onClick={envoyer}
                disabled={desactive}
                aria-label="Envoyer"
                className="flex h-8 w-8 items-center justify-center rounded-cgpt-bouton bg-dj-accent-1 text-[#1A0D02] disabled:opacity-60"
              >
                <ArrowUp size={16} />
              </button>
            ) : (
              <>
                {/* Micro = dictée vocale, branché le 2026-07-20 (voir
                    demarrerDictee/arreterDictee ci-dessus). Waveform = mode
                    vocal complet (conversation continue) -- PAS branché,
                    portée bien plus large qu'une simple dictée, laissé de
                    côté pour l'instant. */}
                <button
                  onClick={demarrerDictee}
                  disabled={transcriptionEnCours}
                  aria-label="Dictée vocale"
                  className="text-dj-texte-muet transition-colors hover:text-dj-texte disabled:opacity-60"
                >
                  <Mic size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Composeur mobile (2026-07-28, refonte demandée par Bourama) --
          une seule ligne : "+" (regroupe Joindre un fichier / Outils /
          Applications) / champ de texte / 2 boutons (Dictée + 1 slot
          variable "dernier outil utilisé"). Ref de textarea séparée
          (zoneTexteMobileRef) mais MÊME état `texte` que la version
          desktop -- les deux restent synchronisés même si un seul est
          visible à la fois (l'autre est juste caché en CSS, pas
          démonté). Pas de calque couleur/auto-agrandissement ici (v1
          volontairement plus simple sur mobile) : défilement interne au
          -delà de max-h. */}
      {/* Aperçu formules mobile (2026-07-30) -- même logique que la version
          desktop ci-dessus (segmenterTexteAvecFormules), juste dupliquée
          ici avec son propre ref car les deux composers restent montés
          en même temps (voir apercuFormulesMobileRef). */}
      {texte.includes("$") && (
        <div
          ref={apercuFormulesMobileRef}
          className="mb-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-dj-bordure bg-dj-surface px-3 py-2 text-[15px] leading-relaxed text-dj-texte md:hidden"
        >
          {segmenterTexteAvecFormules(texte).map((s, i) =>
            s.formule ? (
              <span key={i} dangerouslySetInnerHTML={{ __html: rendreFormuleKatex(s.texte, !!s.bloc) }} />
            ) : (
              <span key={i}>{s.texte}</span>
            )
          )}
        </div>
      )}
      <div className="flex flex-col gap-1 rounded-cgpt-carte border border-dj-bordure bg-dj-surface-haute px-3 py-2.5 focus-within:border-dj-bordure-forte md:hidden">
        <textarea
          ref={zoneTexteMobileRef}
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onPaste={gererCollage}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              envoyer();
            }
          }}
          onFocus={(e) => {
            // Correctif mobile (2026-07-30) : à l'ouverture du clavier,
            // iOS Safari met quelques centaines de ms à réduire le
            // viewport visible (voir lib/useHauteurVisuelle.ts) -- sans
            // ça le champ reste visuellement "sous" le clavier le temps
            // de l'animation. setTimeout laisse cette animation démarrer
            // avant de forcer le champ dans la zone désormais visible.
            const el = e.currentTarget;
            setTimeout(() => el.scrollIntoView({ block: "end", behavior: "smooth" }), 300);
          }}
          placeholder={transcriptionEnCours ? "Transcription en cours..." : "Pose ta question..."}
          rows={1}
          className="max-h-32 min-h-8 w-full resize-none overflow-y-auto bg-transparent px-1 py-1 text-base leading-normal text-dj-texte outline-none placeholder:text-dj-texte-muet"
        />

        {/* Deuxième ligne (14/08, demande Bourama : forme carte en deux
            lignes empilées comme la référence Claude fournie, au lieu
            d'une seule ligne "pilule" plate -- texte au-dessus, icônes
            actions en dessous, "+" à gauche / micro-envoi à droite). */}
        <div className="flex items-center justify-between gap-1">
        <div className="relative flex-shrink-0">
          <button
            ref={boutonPlusRef}
            type="button"
            onClick={() => setMenuPlusOuvert((v) => !v)}
            aria-label="Plus d'options"
            className={
              "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-cgpt-bouton transition-colors " +
              (menuPlusOuvert
                ? "bg-dj-surface text-dj-texte"
                : "text-dj-texte-muet hover:bg-dj-surface hover:text-dj-texte")
            }
          >
            <Plus size={18} />
          </button>

          {menuPlusOuvert && (
            <div
              ref={menuPlusRef}
              className="absolute bottom-full left-0 z-30 mb-2 w-56 max-w-[calc(100vw-2rem)] rounded-2xl border border-dj-bordure bg-dj-surface p-1 shadow-xl"
            >
              <button
                type="button"
                onClick={() => {
                  inputFichierRef.current?.click();
                  setMenuPlusOuvert(false);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-dj-texte transition-colors hover:bg-dj-surface-haute"
              >
                <Pin size={16} /> Joindre un fichier
              </button>
              {/* CORRECTION (2026-07-30, flux 3) : cette entrée n'a de
                  sens que si le bouton dropdown Applications existe
                  (>1 appli) -- sinon une entrée directe suffit
                  (appliSlotUnique ci-dessous). Le menu Outils manuel
                  (dropdown ici, panneau plus bas) a été retiré entièrement
                  le 2026-08-20 : mort depuis le kill-switch
                  AFFICHER_BOUTON_OUTILS du 13/08, jamais réactivé. */}
              {outilsUtilitairesPourAgent.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setMenuUtilitairesOuvert(true);
                  setMenuPlusOuvert(false);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-dj-texte transition-colors hover:bg-dj-surface-haute"
              >
                <SlidersHorizontal size={16} /> Utilitaires
              </button>
              )}
              {appliButtonVisible && (
              <button
                type="button"
                onClick={() => {
                  setMenuAppliOuvert(true);
                  setMenuPlusOuvert(false);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-dj-texte transition-colors hover:bg-dj-surface-haute"
              >
                <LayoutGrid size={16} /> Applications
              </button>
              )}
              {appliSlotUnique && (
              <button
                type="button"
                onClick={() => {
                  executerActionAppli(appliSlotUnique.nom);
                  setMenuPlusOuvert(false);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-dj-texte transition-colors hover:bg-dj-surface-haute"
              >
                <appliSlotUnique.Icone size={16} /> {appliSlotUnique.label}
              </button>
              )}
              {/* Plein écran (2026-07-30, demande Bourama) : même rôle que
                  le bouton Maximize2 du composer desktop -- ouvre la même
                  zone d'écriture agrandie (pleinEcranSaisie, partagée entre
                  PC et mobile, voir plus bas dans ce fichier). Logé dans le
                  menu "+" plutôt qu'en icône dédiée, faute de place dans la
                  barre compacte mobile. */}
              <button
                type="button"
                onClick={() => {
                  setPleinEcranSaisie(true);
                  setMenuPlusOuvert(false);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-dj-texte transition-colors hover:bg-dj-surface-haute"
              >
                <Maximize2 size={16} /> Plein écran
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
        {dictant ? (
          <button
            onClick={arreterDictee}
            aria-label="Arrêter la dictée"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-cgpt-bouton bg-dj-accent-2 text-white"
          >
            <Square size={14} />
          </button>
        ) : texte.trim() || texteColle ? (
          <button
            onClick={envoyer}
            disabled={desactive}
            aria-label="Envoyer"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-cgpt-bouton bg-dj-accent-1 text-[#1A0D02] disabled:opacity-60"
          >
            <ArrowUp size={16} />
          </button>
        ) : (
          <>
            <button
              onClick={demarrerDictee}
              disabled={transcriptionEnCours}
              aria-label="Dictée vocale"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-cgpt-bouton text-dj-texte-muet transition-colors hover:bg-dj-surface hover:text-dj-texte disabled:opacity-60"
            >
              <Mic size={16} />
            </button>
            {/* Slot variable unique mobile (2026-07-28 ; revu 2026-08-01
                suite retour Bourama : "sur mobile le un slot gère les
                trois, outils utilitaires, appli" -- ce slot fusionne
                les catégories via `recentsCombines` (l'historique
                persisté), pas juste les outils comme avant.
                RÉVISÉ 2026-08-20 (nettoyage du menu Outils manuel mort,
                demande Bourama) : le menu Outils dropdown/panneau a été
                retiré entièrement (mort depuis le kill-switch
                AFFICHER_BOUTON_OUTILS du 13/08). Le type "outil" ne
                couvre donc plus que les Utilitaires (ui_*,
                outilsUtilitairesPourAgent) -- CORRECTION au passage :
                l'ancienne condition `AFFICHER_BOUTON_OUTILS && ...`
                bloquait déjà silencieusement toute remontée d'un
                utilitaire récent ici, contrairement à l'intention
                d'origine ("les trois" incluait les utilitaires) ; le
                filtre ci-dessous répare ça.
                Algorithme : on calcule d'abord un "candidat par défaut"
                (ce qui s'affiche tant qu'aucun clic pertinent n'a
                encore eu lieu), par ordre de priorité :
                  1. premier utilitaire autorisé pour cet agent
                  2. appliSlotUnique (agent à exactement 1 appli, fixe,
                     ne varie jamais -- règle Bourama)
                  3. première appli autorisée (si appliButtonVisible,
                     >1 appli)
                  4. rien (agent sans utilitaire ni appli)
                Puis on cherche dans recentsCombines la première entrée
                encore valide pour cet agent (utilitaire valide s'il est
                dans outilsUtilitairesPourAgent ; appli valide seulement
                si appliButtonVisible, car une appli unique ne "varie"
                pas) -- si trouvée, elle REMPLACE le candidat par défaut
                (c'est la partie qui "varie"). */}
            {(() => {
              type Candidat =
                | { genre: "outil"; nom: string; label: string; Icone: typeof Wrench }
                | { genre: "appli"; nom: string; label: string; Icone: typeof Github }
                | null;

              let candidat: Candidat = null;
              if (outilsUtilitairesPourAgent[0]) {
                candidat = { genre: "outil", ...outilsUtilitairesPourAgent[0] };
              } else if (appliSlotUnique) {
                candidat = { genre: "appli", ...appliSlotUnique };
              } else if (appliButtonVisible && applisPourAgent[0]) {
                candidat = { genre: "appli", ...applisPourAgent[0] };
              }

              const recentValide = recentsCombines.find((r) => {
                if (r.type === "outil") return outilsUtilitairesPourAgent.some((o) => o.nom === r.nom);
                return appliButtonVisible && applisPourAgent.some((a) => a.nom === r.nom);
              });
              if (recentValide) {
                if (recentValide.type === "outil") {
                  const outil = outilsDisponibles.find((o) => o.nom === recentValide.nom);
                  if (outil) candidat = { genre: "outil", ...outil };
                } else {
                  const appli = APPLIS_DISPONIBLES.find((a) => a.nom === recentValide.nom);
                  if (appli) candidat = { genre: "appli", ...appli };
                }
              }

              if (!candidat) return null;

              const Icone = candidat.Icone;
              const actif = candidat.genre === "outil" ? estOutilActif(candidat.nom) : false;
              return (
                <button
                  onClick={() =>
                    candidat.genre === "outil" ? executerActionOutil(candidat.nom) : executerActionAppli(candidat.nom)
                  }
                  aria-label={candidat.label}
                  title={candidat.label}
                  className={
                    "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-cgpt-bouton transition-colors " +
                    (actif
                      ? "bg-dj-surface text-dj-accent-1"
                      : "text-dj-texte-muet hover:bg-dj-surface hover:text-dj-texte")
                  }
                >
                  <Icone size={16} />
                </button>
              );
            })()}
          </>
        )}
        </div>
        </div>
      </div>

      {/* Éditeur maths/chimie mobile (2026-07-30, bug signalé par Bourama :
          ce panneau n'existait qu'à l'intérieur du bloc "hidden ...
          md:block" (desktop), donc `editeurFormuleOuvert` passait bien à
          true au clic sur mobile mais rien ne s'affichait jamais --
          display:none masque aussi bien le rendu que l'interactivité de
          ses enfants. Même props que la version desktop plus haut. */}
      {editeurFormuleOuvert && (
        <div className="md:hidden">
          <EditeurFormule
            onChangeLive={mettreAJourFormuleLive}
            onChangerOnglet={finaliserFormuleLive}
            onFermer={() => {
              setEditeurFormuleOuvert(false);
              setFormuleInitiale(undefined);
              finaliserFormuleLive();
            }}
            valeurInitiale={formuleInitiale}
          />
        </div>
      )}

      {/* Panneau Utilitaires mobile (2026-08-01) -- sans onglets (liste
          plate). Panneau Outils mobile équivalent retiré le 2026-08-20
          (mort, kill-switch AFFICHER_BOUTON_OUTILS du 13/08 jamais
          réactivé). */}
      {menuUtilitairesOuvert && (
        <div
          ref={menuUtilitairesMobileRef}
          className="fixed inset-x-4 bottom-24 z-40 flex max-h-[60vh] flex-col overflow-hidden rounded-2xl border border-dj-bordure bg-dj-surface shadow-xl md:hidden"
        >
          <div className="flex items-center justify-between border-b border-dj-bordure px-3 py-2">
            <span className="text-xs font-medium text-dj-texte-muet">Utilitaires</span>
            <button
              onClick={() => setMenuUtilitairesOuvert(false)}
              aria-label="Fermer"
              className="flex-shrink-0 text-dj-texte-muet hover:text-dj-texte"
            >
              <X size={16} />
            </button>
          </div>
          <div className="overflow-y-auto p-1">
            {[...outilsUtilitairesPourAgent]
              .sort((a, b) => a.label.localeCompare(b.label, "fr"))
              .map(({ nom, label, Icone }) => {
                const actif = estOutilActif(nom);
                return (
                  <button
                    key={nom}
                    onClick={() => executerActionOutil(nom)}
                    className={
                      "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors " +
                      (actif ? "bg-dj-accent-1/10 text-dj-accent-1" : "text-dj-texte hover:bg-dj-surface-haute")
                    }
                  >
                    <Icone size={16} />
                    <span className="flex-1">{label}</span>
                    {actif && <Check size={14} />}
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Panneau Applications mobile (2026-07-28) -- même principe,
          même état `menuAppliOuvert` que l'icône desktop. */}
      {menuAppliOuvert && (
        <div
          ref={menuAppliMobileRef}
          className="fixed inset-x-4 bottom-24 z-40 max-h-[60vh] overflow-y-auto rounded-2xl border border-dj-bordure bg-dj-surface p-1 shadow-xl md:hidden"
        >
          {[...applisPourAgent]
            .sort((a, b) => a.label.localeCompare(b.label, "fr"))
            .map(({ nom, label, Icone }) => (
              <button
                key={nom}
                onClick={() => {
                  executerActionAppli(nom);
                  setMenuAppliOuvert(false);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-dj-texte transition-colors hover:bg-dj-surface-haute"
              >
                <Icone size={16} />
                <span className="flex-1">{label}</span>
              </button>
            ))}
        </div>
      )}

      {/* Sélecteur de dépôts GitHub mobile (2026-07-30, bug signalé par
          Bourama, même famille que les deux précédents : `cliquerGithub()`
          bascule bien `selecteurOuvert` et charge la liste des dépôts sur
          mobile aussi (executerActionAppli -> cliquerGithub, commun aux
          deux plateformes), mais le rendu de cette liste n'existait qu'à
          l'intérieur du bloc desktop (ligne ~1073, "hidden ... md:block")
          -- ici, taper sur GitHub dans le panneau Applications refermait
          ce panneau (setMenuAppliOuvert(false)) sans jamais rien afficher
          à la place. Indépendant de menuAppliOuvert : ce sélecteur doit
          rester ouvert même après la fermeture de ce panneau. */}
      {selecteurOuvert && (
        <div
          ref={selecteurMobileRef}
          className="fixed inset-x-4 bottom-24 z-40 max-h-[60vh] overflow-y-auto rounded-2xl border border-dj-bordure bg-dj-surface p-1 shadow-xl md:hidden"
        >
          {depots === null && (
            <div className="space-y-1.5 px-3 py-2" aria-hidden>
              <Skeleton className="h-3 w-3/4 rounded" />
              <Skeleton className="h-3 w-1/2 rounded" style={{ animationDelay: "120ms" }} />
              <Skeleton className="h-3 w-2/3 rounded" style={{ animationDelay: "240ms" }} />
            </div>
          )}
          {depots?.length === 0 && (
            <p className="px-3 py-2 text-xs text-dj-texte-muet">Aucun dépôt trouvé.</p>
          )}
          {depots?.map((d) => (
            <button
              key={d.nom_complet}
              type="button"
              onClick={() => choisirDepot(d.nom_complet)}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-dj-texte transition-colors hover:bg-dj-surface-haute"
            >
              <span className="flex items-center gap-1.5">
                {d.nom_complet}
                {d.prive && (
                  <span className="rounded bg-dj-surface-haute px-1.5 py-0.5 text-[10px] text-dj-texte-muet">
                    privé
                  </span>
                )}
              </span>
              {d.description && (
                <span className="line-clamp-1 text-xs text-dj-texte-muet">{d.description}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Sélecteur de pages Notion mobile (01/08) -- même raison d'être que
          le sélecteur de dépôts GitHub mobile juste au-dessus : le rendu
          desktop du panneau (bloc "hidden ... md:block") ne suffit pas sur
          mobile, où l'entrée "Notion" est tapée depuis le panneau
          Applications (menuAppliOuvert) plutôt que depuis appliSlotUnique. */}
      {selecteurNotionOuvert && (
        <div
          ref={selecteurNotionMobileRef}
          className="fixed inset-x-4 bottom-24 z-40 max-h-[60vh] overflow-y-auto rounded-2xl border border-dj-bordure bg-dj-surface p-1 shadow-xl md:hidden"
        >
          {contenuSelecteurNotion("bg-dj-surface-haute", "bg-dj-surface-haute")}
        </div>
      )}

      {texteColleOuvert && texteColle && (
        <PanneauFlottant
          onFerme={() => fermerTexteColleAnime(() => setTexteColleOuvert(false))}
          large
          enSortie={texteColleEnSortie}
          entete={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-dj-texte-muet">{libellePieceJointe(langageDetecte, texteColle)}</span>
              <button
                onClick={() => fermerTexteColleAnime(() => setTexteColleOuvert(false))}
                aria-label="Fermer"
                className="flex items-center gap-1.5 rounded-lg border border-dj-bordure px-2.5 py-1.5 text-xs text-dj-texte-muet hover:text-dj-texte"
              >
                <X size={14} /> Fermer
              </button>
            </div>
          }
        >
          {langageDetecte === "latex" ? (
            <div
              className="min-h-0 flex-1 overflow-auto rounded-xl border border-dj-bordure bg-dj-surface-haute p-6 text-dj-texte"
              // Rendu direct en formule (fractions, intégrales, racines...),
              // pas en texte source coloré -- demande Bourama (25/07) : "le
              // latex, ça pourrait être direct, ça s'affiche en gros les
              // fractions etc". KaTeX gère \begin{equation}...\end{equation}
              // nativement, pas besoin de passer par remark-math/$ $ ici
              // puisque tout le contenu collé EST du LaTeX (pas du markdown
              // mélangé comme dans une réponse de l'IA).
              dangerouslySetInnerHTML={{
                __html: (() => {
                  try {
                    return katex.renderToString(texteColle, { displayMode: true, throwOnError: false });
                  } catch {
                    return texteColle.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
                  }
                })(),
              }}
            />
          ) : langageDetecte ? (
            <div className="min-h-0 flex-1 overflow-auto">
              <BlocCode langage={langageDetecte} code={texteColle} />
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-dj-texte">
              {texteColle}
            </div>
          )}
        </PanneauFlottant>
      )}

      {imageAgrandieId && fichiers.find((f) => f.id === imageAgrandieId)?.apercu && (
        // Consolidé (audit 25/08/2026) dans VisionneuseImage.tsx -- corrige
        // au passage le bouton "Fermer" qui n'avait aucun onClick propre.
        <VisionneuseImage
          src={fichiers.find((f) => f.id === imageAgrandieId)?.apercu ?? ""}
          onFermer={() => setImageAgrandieId(null)}
        />
      )}

      {canvasOuvert && (
        <CanvasDessin
          enSortie={canvasEnSortie}
          onFermer={() => fermerCanvasAnime(() => setCanvasOuvert(false))}
          onValider={(fichier) => {
            // Rejoint le pipeline "Joindre un fichier" existant -- le
            // dessin est traité en tout point comme une image uploadée
            // (aperçu + vision Gemini côté backend, aucun code séparé).
            // S'AJOUTE aux fichiers déjà joints depuis le 17/08 (upload
            // multiple), ne les remplace plus.
            ajouterFichiers([fichier]);
            fermerCanvasAnime(() => setCanvasOuvert(false));
          }}
        />
      )}

      {editeurMathsRicheOuvert && (
        <EditeurMathsRiche
          enSortie={editeurMathsEnSortie}
          onFermer={() => fermerEditeurMathsAnime(() => setEditeurMathsRicheOuvert(false))}
          onInserer={(texteSerialise) => {
            // Seul point de contact avec le composer existant : on
            // rejoint `texte` exactement comme la dictée classique
            // (demarrerDictee) ou le collage -- rien d'autre du textarea
            // n'est modifié.
            setTexte((prec) => (prec.trim() ? `${prec} ${texteSerialise}` : texteSerialise));
            fermerEditeurMathsAnime(() => setEditeurMathsRicheOuvert(false));
            requestAnimationFrame(ajusterHauteurTexte);
          }}
        />
      )}

      {pleinEcranSaisie && (
        // Plein écran de la saisie : même état `texte`/`onEnvoyer` que le
        // composer normal (pas de duplication de logique), juste une zone
        // d'écriture plus grande + bouton envoyer intégré pour ne pas avoir
        // à fermer le plein écran avant d'envoyer (demande de Bourama,
        // 2026-07-23). Coloration des liens reprise ici aussi (2026-07-23,
        // suite) via le même calque que le composer compact, juste sur des
        // refs séparées.
        <PanneauFlottant
          onFerme={() => fermerPleinEcranSaisieAnime(() => setPleinEcranSaisie(false))}
          pleine
          enSortie={pleinEcranSaisieEnSortie}
          entete={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-dj-texte-muet">Écris ton message</span>
              <button
                onClick={() => fermerPleinEcranSaisieAnime(() => setPleinEcranSaisie(false))}
                aria-label="Rétrécir"
                className="flex items-center gap-1.5 rounded-lg border border-dj-bordure px-2.5 py-1.5 text-xs text-dj-texte-muet hover:text-dj-texte"
              >
                <Minimize2 size={14} /> Rétrécir
              </button>
            </div>
          }
        >
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {/* Même technique de calque que le composer compact (voir plus
                haut, segmenterTexteAvecLiens) -- coloration des liens
                pendant la frappe, demande de Bourama (2026-07-23) : le
                plein écran ne doit pas perdre cette fonctionnalité. */}
            <div
              ref={calquePleinEcranRef}
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words text-base leading-relaxed text-dj-texte"
            >
              {texte
                ? segmenterTexteAvecLiens(texte).map((s, i) =>
                    s.lien ? (
                      <span key={i} className="text-dj-texte-muet underline">
                        {s.texte}
                      </span>
                    ) : (
                      <span key={i}>{s.texte}</span>
                    )
                  )
                : null}
              {texte.endsWith("\n") && "\u200b"}
            </div>
            <textarea
              ref={zoneTextePleinEcranRef}
              autoFocus
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              onPaste={gererCollage}
              onScroll={(e) => {
                if (calquePleinEcranRef.current) calquePleinEcranRef.current.scrollTop = e.currentTarget.scrollTop;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  envoyer();
                  fermerPleinEcranSaisieAnime(() => setPleinEcranSaisie(false));
                }
              }}
              placeholder="Pose ta question..."
              className="relative h-full w-full resize-none overflow-y-auto bg-transparent text-base leading-relaxed text-transparent caret-dj-texte outline-none placeholder:text-dj-texte-muet"
            />
          </div>
          <div className="flex justify-end pt-4">
            <button
              onClick={() => {
                envoyer();
                fermerPleinEcranSaisieAnime(() => setPleinEcranSaisie(false));
              }}
              disabled={(!texte.trim() && !texteColle) || desactive}
              aria-label="Envoyer"
              className="flex items-center gap-2 rounded-cgpt-bouton bg-dj-accent-1 px-5 py-2.5 text-sm font-medium text-[#1A0D02] disabled:opacity-60"
            >
              Envoyer <ArrowUp size={16} />
            </button>
          </div>
        </PanneauFlottant>
      )}
    </div>
  );
}
