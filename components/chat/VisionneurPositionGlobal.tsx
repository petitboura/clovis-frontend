"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { X, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

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
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-dj-accent-1 hover:underline"
            >
              <ExternalLink size={14} /> Ouvrir dans un nouvel onglet
            </a>
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
        <div className="min-h-0 flex-1">
          {detail.positionType === "timestamp" ? (
            <LecteurAudioPosition url={detail.url} debutSecondes={detail.positionValeur ?? 0} />
          ) : (
            <VisionneurPdf url={detail.url} page={detail.positionType === "page" ? detail.positionValeur ?? 1 : 1} />
          )}
        </div>
      </div>
    </div>
  );
}
