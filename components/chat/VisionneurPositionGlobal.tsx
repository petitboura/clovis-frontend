"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { X, ChevronLeft, ChevronRight, ExternalLink, Download } from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { LinkPreview } from "./LinkPreview";
import {
  TYPES_MIME_OFFICE,
  estTypeTexteLisible,
  estFichierMarkdown,
  telecharger,
  ContenuTexte,
  ContenuMarkdown,
  ContenuOffice,
  ContenuNonPrevisualisable,
} from "../VisionneuseBibliotheque";

// Worker servi depuis notre propre /public (26/08, retour Bourama : le
// clic sur "Ouvrir à cet endroit" faisait sortir de l'app -- ouvrir le
// PDF/audio brut dans un nouvel onglet, en comptant sur le fragment
// d'URL #page=/#t= pour se positionner, ne marche pas de façon fiable
// (le lecteur PDF/audio du système, ou l'app externe qui prend la main,
// ignore souvent ce fragment, surtout en PWA/mobile). Ce composant
// affiche donc le PDF/audio directement DANS Clovis, avec un vrai
// contrôle de la page/du timestamp, plutôt que de déléguer à un lecteur
// externe. Mounté UNE SEULE FOIS (voir ChatIA.tsx), piloté par un simple
// CustomEvent "clovis:ouvrir-position" -- évite le prop drilling entre
// SourcesBulle.tsx (puce d'extrait) et BulleMessage.tsx (citation
// inline), qui sont deux arbres de composants différents.
//
// CORRECTIF 2026-08-27 (demande Bourama : "que tout soit interne popup
// comme les fichiers uploadés, même les sites") : ce visionneur ne se
// limite plus au PDF/audio positionnés (page/timestamp) -- il dispatche
// désormais TOUT type de source bibliothèque (image, Office, texte,
// PDF/audio même sans position précise) vers le bon aperçu, en
// réutilisant TEL QUEL le dispatch déjà écrit pour la bibliothèque
// personnelle (VisionneuseBibliotheque.tsx, mêmes helpers exportés,
// zéro duplication de logique). Une source qui n'a PAS de type_mime
// (donc pas un fichier de bibliothèque -- un résultat de recherche web)
// retombe sur une carte d'aperçu de site (LinkPreview) + un bouton
// explicite pour sortir de l'app si l'utilisateur le veut vraiment --
// même principe déjà en place pour les liens classiques du chat, jamais
// de sortie automatique au simple clic.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf-worker/pdf.worker.min.mjs";

import { DetailOuverturePosition, EVENEMENT_OUVRIR_POSITION } from "./visionneurPositionEvenement";

function VisionneurPdf({ url, page }: { url: string; page: number }) {
  const [nbPages, setNbPages] = useState<number | null>(null);
  const [pageCourante, setPageCourante] = useState(page);
  const [erreur, setErreur] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto p-3">
        {erreur ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-dj-texte-muet">
            <p>Impossible d'afficher ce PDF ici.</p>
            <button
              type="button"
              onClick={() => telecharger(url, "document.pdf")}
              className="flex items-center gap-1 text-dj-accent-1 hover:underline"
            >
              <Download size={14} /> Télécharger
            </button>
          </div>
        ) : (
          <Document
            file={url}
            onLoadSuccess={({ numPages }) => {
              setNbPages(numPages);
              setPageCourante(Math.min(Math.max(page, 1), numPages));
            }}
            onLoadError={() => setErreur(true)}
            loading={<p className="p-4 text-center text-dj-texte-muet">Chargement du PDF...</p>}
            className="flex justify-center"
          >
            <Page pageNumber={pageCourante} width={Math.min(window.innerWidth - 48, 640)} />
          </Document>
        )}
      </div>
      {!erreur && nbPages && (
        <div className="flex items-center justify-center gap-4 border-t border-dj-bordure py-2">
          <button
            type="button"
            disabled={pageCourante <= 1}
            onClick={() => setPageCourante((p) => Math.max(1, p - 1))}
            className="rounded-full p-1.5 text-dj-texte-muet transition-colors hover:text-dj-texte disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-dj-texte-muet">
            Page {pageCourante} / {nbPages}
          </span>
          <button
            type="button"
            disabled={pageCourante >= nbPages}
            onClick={() => setPageCourante((p) => Math.min(nbPages, p + 1))}
            className="rounded-full p-1.5 text-dj-texte-muet transition-colors hover:text-dj-texte disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

function LecteurAudioPosition({ url, debutSecondes }: { url: string; debutSecondes: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <audio
        ref={audioRef}
        src={url}
        controls
        autoPlay
        className="w-full max-w-md"
        onLoadedMetadata={() => {
          if (audioRef.current) audioRef.current.currentTime = debutSecondes;
        }}
      />
      <p className="text-sm text-dj-texte-muet">
        Lecture démarrée à {Math.floor(debutSecondes / 60)}:{String(debutSecondes % 60).padStart(2, "0")}
      </p>
    </div>
  );
}

// Image bibliothèque citée en source (pas de position page/timestamp) --
// même rendu simple qu'un aperçu plein cadre, cohérent avec
// VisionneuseBibliotheque.tsx.
function VisionneurImage({ url, titre }: { url: string; titre: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- source dynamique (bucket Supabase)
    <img src={url} alt={titre} className="mx-auto max-h-[75vh] w-auto object-contain" />
  );
}

// Carte de site pour une source qui n'a PAS de type_mime -- donc PAS un
// fichier de bibliothèque, forcément un résultat de recherche web (voir
// docstring plus haut). Jamais d'iframe forcée (la quasi-totalité des
// sites la refusent, voir LinkPreview.tsx) : aperçu Open Graph + bouton
// explicite pour sortir si l'utilisateur le veut vraiment.
function CarteSiteExterne({ url, titre }: { url: string; titre: string }) {
  return (
    <div className="p-5">
      <LinkPreview href={url} texteLien={titre} />
      <button
        onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
        className="mt-3 flex items-center gap-1.5 rounded-lg border border-dj-bordure px-3 py-1.5 text-xs text-dj-texte-muet transition-colors hover:border-dj-bordure-forte hover:text-dj-texte"
      >
        <ExternalLink size={13} /> Ouvrir le site
      </button>
    </div>
  );
}

export function VisionneurPositionGlobal() {
  const [detail, setDetail] = useState<DetailOuverturePosition | null>(null);

  const fermer = useCallback(() => setDetail(null), []);

  useEffect(() => {
    function onOuvrir(e: Event) {
      setDetail((e as CustomEvent<DetailOuverturePosition>).detail);
    }
    window.addEventListener(EVENEMENT_OUVRIR_POSITION, onOuvrir);
    return () => window.removeEventListener(EVENEMENT_OUVRIR_POSITION, onOuvrir);
  }, []);

  useEffect(() => {
    if (!detail) return;
    function onEchap(e: KeyboardEvent) {
      if (e.key === "Escape") fermer();
    }
    window.addEventListener("keydown", onEchap);
    return () => window.removeEventListener("keydown", onEchap);
  }, [detail, fermer]);

  if (!detail) return null;

  const typeMime = detail.typeMime || "";
  const estImage = typeMime.startsWith("image/");
  const estAudio = typeMime.startsWith("audio/") || detail.positionType === "timestamp";
  const estPdf = typeMime === "application/pdf" || detail.positionType === "page";
  const estOffice = TYPES_MIME_OFFICE.has(typeMime);
  const estLien = typeMime === "text/uri-list";
  const estMarkdown = !estLien && estFichierMarkdown(detail.titre, typeMime);
  const estTexte = !estLien && !estMarkdown && estTypeTexteLisible(typeMime);
  // Aucun type_mime du tout : pas un fichier de bibliothèque, donc une
  // source web (résultat de recherche) -- carte de site, jamais d'iframe.
  const estSiteWeb = !detail.typeMime && !estPdf && !estAudio;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={fermer}
    >
      <div
        className="flex h-[85vh] w-full max-w-2xl flex-col rounded-cgpt-bouton border border-dj-bordure bg-dj-fond shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-dj-bordure px-4 py-3">
          <p className="truncate pr-3 text-sm font-medium text-dj-texte">{detail.titre}</p>
          <button
            type="button"
            onClick={fermer}
            className="shrink-0 rounded-full p-1 text-dj-texte-muet transition-colors hover:text-dj-texte"
            title="Fermer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {estAudio ? (
            <LecteurAudioPosition url={detail.url} debutSecondes={detail.positionValeur ?? 0} />
          ) : estPdf ? (
            <VisionneurPdf url={detail.url} page={detail.positionType === "page" ? detail.positionValeur ?? 1 : 1} />
          ) : estImage ? (
            <VisionneurImage url={detail.url} titre={detail.titre} />
          ) : estOffice ? (
            <ContenuOffice href={detail.url} titre={detail.titre} />
          ) : estMarkdown ? (
            <ContenuMarkdown href={detail.url} />
          ) : estTexte ? (
            <ContenuTexte href={detail.url} />
          ) : estSiteWeb || estLien ? (
            <CarteSiteExterne url={detail.url} titre={detail.titre} />
          ) : (
            <ContenuNonPrevisualisable href={detail.url} nom={detail.titre} />
          )}
        </div>
      </div>
    </div>
  );
}
