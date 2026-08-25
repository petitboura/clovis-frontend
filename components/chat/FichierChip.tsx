"use client";

import { useState } from "react";
import { FileText, FileSpreadsheet, Presentation, FileArchive, FileJson, FileCode, Image as IconeImage, Box, File, Download, ImageOff } from "lucide-react";
import { BlocExpansible } from "./BlocExpansible";
import { VisionneuseImage } from "./VisionneuseImage";

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

// Téléchargement via fetch+blob plutôt qu'un simple <a download> : pour une
// URL cross-origin (Supabase), le navigateur ignore souvent l'attribut
// download et ouvre le fichier dans un nouvel onglet à la place -- le blob
// local, lui, force le vrai téléchargement sans jamais quitter l'appli
// (même technique que ImageMessage.tsx). Repli : si le fetch échoue (CORS,
// réseau...), on ouvre quand même le lien plutôt que de bloquer l'utilisateur.
async function telechargerFichier(href: string, nom: string) {
  try {
    const reponse = await fetch(href);
    const blob = await reponse.blob();
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = nom;
    lien.click();
    URL.revokeObjectURL(url);
  } catch {
    window.open(href, "_blank");
  }
}

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

  // PDF : seul format ici qu'un navigateur sait rendre nativement en
  // iframe sans lib supplémentaire -- se déroule dans le fil comme le
  // code et les widgets (voir BlocExpansible.tsx). Plus de panneau
  // latéral (retiré, 2026-07-20, demande de Bourama).
  //
  // L'aperçu intégré (iframe) n'est proposé que si l'URL vient de notre
  // propre stockage Supabase (voir estOrigineDeConfiance ci-dessus) --
  // n'importe quelle autre origine retombe sur la carte téléchargement
  // générique plus bas, jamais d'iframe.
  if (infos === "pdf" && estOrigineDeConfiance(href)) {
    return (
      <BlocExpansible
        titre={nom}
        icone={Icone}
        sousTitre={libelle}
        hrefTelechargement={href}
        enfant={
          <iframe
            src={href}
            // CORRECTIF 2026-07-31 : sandbox="" a ete retire -- testé en
            // conditions réelles par Bourama, ça empêche le PDF de
            // s'afficher du tout. Comportement documenté et connu des
            // navigateurs (Chrome/WebKit) : le visionneur PDF intégré est
            // traité comme un "plugin", et sandbox désactive tous les
            // plugins, quel que soit le jeu de permissions accordées.
            // La vraie protection est désormais la vérification d'origine
            // ci-dessus, pas un attribut sur l'iframe elle-même.
            className="h-[70vh] w-full rounded-lg border border-dj-bordure"
            title={nom}
          />
        }
      />
    );
  }

  // Image (png/jpg/jpeg/webp) : vignette + zoom, voir ImageGenereeChip
  // ci-dessus.
  if (infos && EXTENSIONS_IMAGE.has(infos)) {
    return <ImageGenereeChip href={href} nom={nom} />;
  }

  // Word/Excel/PowerPoint/zip/JSON/XML/3D : pas de viewer natif de
  // navigateur -- carte téléchargement, mais le clic force un vrai
  // téléchargement (blob) au lieu d'ouvrir un nouvel onglet (31/07,
  // demande Bourama : "tous les liens de téléchargement restent dans
  // l'appli").
  return (
    <button
      onClick={() => telechargerFichier(href, nom)}
      className="my-2 flex w-fit max-w-full animate-dj-fade-in items-center gap-3 rounded-xl border border-dj-bordure bg-dj-surface-haute px-3 py-2.5 text-left transition-colors hover:border-dj-bordure-forte"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-dj-surface text-dj-texte">
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
