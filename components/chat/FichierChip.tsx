"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { FileText, FileSpreadsheet, Presentation, FileArchive, FileJson, FileCode, Image as IconeImage, Box, File, Download, ImageOff, Loader2 } from "lucide-react";
import { BlocExpansible } from "./BlocExpansible";
import { VisionneuseImage } from "./VisionneuseImage";
import { TYPES_MIME_OFFICE, estTypeTexteLisible, estFichierMarkdown, ContenuTexte, ContenuMarkdown, ContenuOffice } from "../VisionneuseBibliotheque";
import { telecharger } from "@/lib/telecharger";

// CORRECTIF 2026-09-10 (demande Bourama : le nouveau lecteur -- PDF
// mobile-friendly, Markdown, Office, texte -- n'existait QUE pour les
// sources citées dans une réponse (VisionneurPositionGlobal.tsx), pas
// pour les fichiers uploadés/redonnés/générés dans le chat, qui
// retombaient tous sur une simple carte "télécharger" (aucun aperçu,
// même pour un .md). On réutilise ici les mêmes composants de rendu déjà
// écrits pour la bibliothèque (VisionneuseBibliotheque.tsx), TELS QUELS,
// juste affichés dans le BlocExpansible existant de ce fichier au lieu
// du modal de VisionneurPositionGlobal.tsx -- pas de nouveau pattern
// d'UI, le PDF de ce fichier fonctionnait déjà ainsi (déroulé inline).
//
// react-pdf/pdfjs-dist touche des API navigateur dès son import -- ce
// fichier est importé STATIQUEMENT (BulleMessage.tsx -> ChatIA.tsx),
// donc VisionneurPdf doit rester chargé en dynamic({ssr:false}), même
// raison que VisionneuseBibliotheque.tsx et VisionneurPositionGlobal.tsx.
const VisionneurPdf = dynamic(() => import("../VisionneurPdf").then((m) => m.VisionneurPdf), {
  ssr: false,
  loading: () => (
    <div className="flex h-[70vh] items-center justify-center">
      <Loader2 size={20} className="animate-spin text-dj-texte-muet" />
    </div>
  ),
});

// Type MIME approximatif déduit de l'extension d'URL -- ce fichier n'a
// jamais le vrai type_mime renvoyé par le backend (contrairement à
// DetailOuverturePosition, alimenté par core/bibliotheque_rag.py), donc
// on le reconstruit ici juste pour réutiliser les mêmes helpers
// (estTypeTexteLisible, estFichierMarkdown, TYPES_MIME_OFFICE) que la
// bibliothèque. PDF et images gérés à part plus bas, zip/glb absents
// volontairement (aucun aperçu possible pour ces deux-là).
const TYPE_MIME_PAR_EXTENSION: Record<string, string> = {
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  json: "application/json",
  xml: "application/xml",
  tex: "text/x-tex",
  md: "text/markdown",
};

const EXTENSIONS_FICHIER: Record<string, { icone: typeof File; libelle: string }> = {
  pdf: { icone: FileText, libelle: "PDF" },
  doc: { icone: FileText, libelle: "Word" },
  docx: { icone: FileText, libelle: "Word" },
  xls: { icone: FileSpreadsheet, libelle: "Excel" },
  xlsx: { icone: FileSpreadsheet, libelle: "Excel" },
  csv: { icone: FileSpreadsheet, libelle: "CSV" },
  ppt: { icone: Presentation, libelle: "PowerPoint" },
  pptx: { icone: Presentation, libelle: "PowerPoint" },
  // Archives (bundles, code, sites générés en zip -- voir
  // core/generation_code.py, generation_archives.py, generation_site.py)
  zip: { icone: FileArchive, libelle: "Archive ZIP" },
  // Données structurées (voir generation_donnees.py)
  json: { icone: FileJson, libelle: "JSON" },
  xml: { icone: FileCode, libelle: "XML" },
  // Images en lien direct, pas en syntaxe markdown ![]() -- ce second cas
  // passe déjà par le renderer `img` de BulleMessage.tsx, pas par ici
  // (voir generation_images.py). Prévisualisées en vignette+zoom depuis le
  // 31/07 (demande Bourama), voir bloc dédié plus bas -- ne passent plus
  // par la carte téléchargement générique.
  png: { icone: IconeImage, libelle: "Image" },
  jpg: { icone: IconeImage, libelle: "Image" },
  jpeg: { icone: IconeImage, libelle: "Image" },
  webp: { icone: IconeImage, libelle: "Image" },
  // Modèles 3D (voir generation_3d.py). L'audio (mp3/wav) et la vidéo
  // (mp4/webm) ne sont volontairement PAS ici : LecteurMedia.tsx (voir
  // typeMedia() dans BulleMessage.tsx) les intercepte avant d'arriver
  // jusqu'ici, un ajout ici serait du code mort.
  glb: { icone: Box, libelle: "Modèle 3D" },
  // LaTeX (voir core/generation_latex.py) -- sans cette entrée, le lien
  // retombait dans le cas générique LinkPreview (aperçu de lien web),
  // qui n'a aucune métadonnée à afficher pour un fichier .tex brut, d'où
  // le rendu cassé repéré par Bourama en test réel le 27/07.
  tex: { icone: FileCode, libelle: "LaTeX" },
  // Articles de la base de connaissances renvoyés en pièce jointe tels
  // quels (voir core/serveur_mcp_generation.py::obtenir_fichier_connaissance,
  // 18/08) -- même famille que .tex : sans cette entrée, retombe dans le
  // rendu générique cassé.
  md: { icone: FileText, libelle: "Markdown" },
};

const EXTENSIONS_IMAGE = new Set(["png", "jpg", "jpeg", "webp"]);

// CORRECTIF 2026-07-31 (audit sécurité, alternative après l'échec du
// correctif sandbox="" du 31/07 -- voir plus bas, ça cassait le rendu
// PDF natif du navigateur). La vraie question de sécurité n'est pas
// "cette iframe a-t-elle un sandbox" mais "cette iframe affiche-t-elle
// vraiment un fichier QUE NOUS AVONS GÉNÉRÉ" : `href` vient soit d'un
// résultat d'outil (toujours une URL Supabase de notre propre bucket,
// fiable), soit d'un lien markdown écrit librement par le modèle dans
// son texte (voir BulleMessage.tsx) -- ce second cas n'est, en théorie,
// pas garanti de pointer vers notre stockage (le system prompt le lui
// interdit, mais ce n'est qu'une consigne, pas une contrainte technique). On
// vérifie donc l'origine avant d'intégrer quoi que ce soit en iframe :
// seul notre propre stockage Supabase a droit à l'aperçu intégré,
// n'importe quelle autre origine retombe sur une carte de téléchargement
// simple (pas d'iframe du tout) -- sans jamais toucher au rendu normal
// des vrais PDF générés, qui viennent toujours de cette origine.
function estOrigineDeConfiance(href: string): boolean {
  const urlSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!urlSupabase) return false;
  try {
    return new URL(href).origin === new URL(urlSupabase).origin;
  } catch {
    return false;
  }
}

// Détecte si un lien markdown pointe vers un fichier "document" (PDF,
// Word, Excel, PowerPoint...) via son extension d'URL, et si oui le
// remplace par une carte fichier au lieu d'un <a> souligné brut. Le
// composant `a` custom dans BulleMessage.tsx appelle `extensionFichier()`
// et bascule vers ce composant quand elle correspond, sinon rend le lien
// normal -- pas de régression sur les liens web classiques.
export function extensionFichier(href: string): string | null {
  const match = href.split("?")[0].match(/\.([a-zA-Z0-9]+)$/);
  const ext = match?.[1]?.toLowerCase();
  return ext && ext in EXTENSIONS_FICHIER ? ext : null;
}

// 12/09/2026, Bourama : vrai téléchargement système sur Android (au lieu
// du fetch+blob web ici depuis toujours) -- voir lib/telecharger.ts pour
// le détail (DownloadManager natif + replis web/iOS inchangés).
const telechargerFichier = telecharger;

// Carte "image générée" : vignette + zoom plein écran, comme les images
// envoyées par l'utilisateur (voir ImageMessage.tsx) -- au lieu de la
// carte téléchargement générique utilisée jusqu'ici pour toute extension
// non-PDF, qui faisait quitter l'appli pour une simple image (31/07,
// signalé par Bourama : "les images générées ne restent pas dans l'appli").
function ImageGenereeChip({ href, nom }: { href: string; nom: string }) {
  const [ouverte, setOuverte] = useState(false);
  const [enErreur, setEnErreur] = useState(false);

  if (enErreur) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="my-2 flex w-fit max-w-full animate-dj-fade-in items-center gap-2.5 rounded-xl border border-dj-bordure bg-dj-surface px-3 py-2.5 no-underline text-dj-texte-muet transition-colors hover:border-dj-bordure-forte hover:text-dj-texte"
      >
        <ImageOff size={16} className="shrink-0" />
        <span className="min-w-0 truncate text-sm">{nom}</span>
      </a>
    );
  }

  return (
    <>
      <button
        onClick={() => setOuverte(true)}
        className="my-2 block max-h-96 overflow-hidden rounded-xl border border-dj-bordure bg-dj-surface"
        aria-label={`Agrandir ${nom}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- source dynamique (fichier généré), pas un asset local optimisable */}
        <img src={href} alt={nom} onError={() => setEnErreur(true)} className="max-h-96 w-auto" />
      </button>

      {ouverte && (
        // Consolidé (audit 25/08/2026) dans VisionneuseImage.tsx -- corrige
        // au passage le bouton "Fermer" qui n'avait aucun onClick propre.
        <VisionneuseImage
          src={href}
          alt={nom}
          onFermer={() => setOuverte(false)}
          onTelecharger={() => telechargerFichier(href, nom)}
        />
      )}
    </>
  );
}

export function FichierChip({ href, nom }: { href: string; nom: string }) {
  const infos = extensionFichier(href);
  const { icone: Icone, libelle } = infos ? EXTENSIONS_FICHIER[infos] : { icone: File, libelle: "Fichier" };

  // Image (png/jpg/jpeg/webp) : vignette + zoom, voir ImageGenereeChip
  // ci-dessus. Inchangé par le correctif du 09/10 -- déjà un bon aperçu.
  if (infos && EXTENSIONS_IMAGE.has(infos)) {
    return <ImageGenereeChip href={href} nom={nom} />;
  }

  // L'aperçu intégré (PDF, Office, Markdown, texte) n'est proposé que si
  // l'URL vient de notre propre stockage Supabase (voir
  // estOrigineDeConfiance ci-dessus, même garde-fou qu'avant le correctif
  // du 09/10) -- n'importe quelle autre origine retombe sur la carte
  // téléchargement générique plus bas.
  const origineFiable = estOrigineDeConfiance(href);

  // PDF : déroulé dans le fil comme le code et les widgets (voir
  // BlocExpansible.tsx), inchangé depuis le 20/07 -- seul le contenu
  // change : le nouveau lecteur (VisionneurPdf, @anaralabs/lector, voir
  // clovis-skills-mobile-pdf) remplace l'ancienne iframe native du
  // navigateur (illisible sur mobile, cause du correctif du 09/10).
  if (infos === "pdf" && origineFiable) {
    return (
      <BlocExpansible titre={nom} icone={Icone} sousTitre={libelle} hrefTelechargement={href} enfant={<VisionneurPdf url={href} page={1} />} />
    );
  }

  // Word/Excel/PowerPoint/CSV/JSON/XML/LaTeX/Markdown : mêmes rendus que
  // pour une source citée (ContenuOffice/ContenuTexte/ContenuMarkdown,
  // voir VisionneuseBibliotheque.tsx), affichés dans le même
  // BlocExpansible que le PDF ci-dessus -- avant le 09/10, ces types
  // tombaient tous sur la carte téléchargement générique plus bas, sans
  // aucun aperçu (signalé par Bourama, ex. les .md).
  if (origineFiable && infos && infos in TYPE_MIME_PAR_EXTENSION) {
    const typeMime = TYPE_MIME_PAR_EXTENSION[infos];
    if (estFichierMarkdown(nom, typeMime)) {
      return <BlocExpansible titre={nom} icone={Icone} sousTitre={libelle} hrefTelechargement={href} enfant={<ContenuMarkdown href={href} />} />;
    }
    if (TYPES_MIME_OFFICE.has(typeMime)) {
      return <BlocExpansible titre={nom} icone={Icone} sousTitre={libelle} hrefTelechargement={href} enfant={<ContenuOffice href={href} titre={nom} />} />;
    }
    if (estTypeTexteLisible(typeMime)) {
      return <BlocExpansible titre={nom} icone={Icone} sousTitre={libelle} hrefTelechargement={href} enfant={<ContenuTexte href={href} />} />;
    }
  }

  // Repli : archive ZIP, modèle 3D (aucun aperçu possible dans un
  // navigateur), origine non fiable, ou extension inconnue -- carte
  // téléchargement, le clic force un vrai téléchargement (blob) au lieu
  // d'ouvrir un nouvel onglet (31/07, demande Bourama : "tous les liens
  // de téléchargement restent dans l'appli").
  return (
    <button
      onClick={() => telechargerFichier(href, nom)}
      className="my-2 flex w-fit max-w-full animate-dj-fade-in items-center gap-3 rounded-xl border border-dj-bordure bg-dj-surface px-3 py-2.5 text-left transition-colors hover:border-dj-bordure-forte"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-dj-surface-haute text-dj-texte">
        <Icone size={16} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm text-dj-texte">{nom}</span>
        <span className="block text-[11px] text-dj-texte-muet">{libelle}</span>
      </span>
      <Download size={14} className="ml-1 shrink-0 text-dj-texte-muet" />
    </button>
  );
}
