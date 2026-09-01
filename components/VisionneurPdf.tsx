"use client";

import { useCallback, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Skeleton } from "./Skeleton";
import { telecharger } from "./VisionneuseBibliotheque";

// Worker servi depuis notre propre /public -- voir historique dans
// l'ancien emplacement de ce composant (VisionneurPositionGlobal.tsx,
// avant extraction du 01/09).
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf-worker/pdf.worker.min.mjs";

// Distance de glissement (px) à partir de laquelle un swipe change de
// page -- assez haut pour ne pas se déclencher sur un simple scroll
// vertical involontaire, assez bas pour rester naturel au pouce.
const SEUIL_SWIPE_PX = 60;

// Composant partagé PDF -- utilisé par VisionneurPositionGlobal.tsx
// (viewer du chat, chargé en dynamic ssr:false) ET par
// VisionneuseBibliotheque.tsx (bibliothèque personnelle/publique, elle
// chargée statiquement -- donc CE fichier doit toujours être importé en
// dynamic({ssr:false}) par tout consommateur qui n'est pas déjà 100%
// client-only, sous peine de faire planter le SSR : react-pdf/pdfjs-dist
// accède à des API navigateur au chargement).
//
// 01/09, demande Bourama : le viewer ne proposait que page suivante/
// précédente au clic -- pas de swipe (naturel sur mobile) ni de saut
// direct à une page donnée (juste flèche par flèche). Ajout des deux,
// sans rien retirer : flèches conservées, + swipe tactile gauche/droite
// + champ numérique + curseur, les trois moyens de changer de page
// restant synchronisés sur le même état pageCourante.
export function VisionneurPdf({ url, page = 1 }: { url: string; page?: number }) {
  const [nbPages, setNbPages] = useState<number | null>(null);
  const [pageCourante, setPageCourante] = useState(page);
  const [champPage, setChampPage] = useState(String(page));
  const [erreur, setErreur] = useState(false);
  const toucheDepart = useRef<{ x: number; y: number } | null>(null);

  const allerA = useCallback(
    (n: number) => {
      if (!nbPages) return;
      const bornee = Math.min(Math.max(n, 1), nbPages);
      setPageCourante(bornee);
      setChampPage(String(bornee));
    },
    [nbPages],
  );

  function onToucheDebut(e: React.TouchEvent) {
    const t = e.touches[0];
    toucheDepart.current = { x: t.clientX, y: t.clientY };
  }

  function onToucheFin(e: React.TouchEvent) {
    if (!toucheDepart.current) return;
    const t = e.changedTouches[0];
    const deltaX = t.clientX - toucheDepart.current.x;
    const deltaY = t.clientY - toucheDepart.current.y;
    toucheDepart.current = null;
    // Ignore un swipe trop vertical (c'est un scroll, pas un changement
    // de page) : le mouvement horizontal doit dominer le vertical.
    if (Math.abs(deltaX) < SEUIL_SWIPE_PX || Math.abs(deltaX) < Math.abs(deltaY)) return;
    allerA(pageCourante + (deltaX < 0 ? 1 : -1));
  }

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex-1 overflow-auto p-3"
        onTouchStart={onToucheDebut}
        onTouchEnd={onToucheFin}
      >
        {erreur ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-dj-texte-muet">
            <p>Impossible d&apos;afficher ce PDF ici.</p>
            <button
              type="button"
              onClick={() => telecharger(url, "document.pdf")}
              className="flex items-center gap-1 text-dj-accent-1-texte hover:underline"
            >
              <Download size={14} /> Télécharger
            </button>
          </div>
        ) : (
          <Document
            file={url}
            onLoadSuccess={({ numPages }) => {
              setNbPages(numPages);
              const bornee = Math.min(Math.max(page, 1), numPages);
              setPageCourante(bornee);
              setChampPage(String(bornee));
            }}
            onLoadError={() => setErreur(true)}
            loading={
              <div className="flex justify-center p-4" aria-hidden>
                <Skeleton className="rounded-lg" style={{ width: "min(100%, 640px)", aspectRatio: "1 / 1.414" }} />
              </div>
            }
            className="flex justify-center"
          >
            <Page pageNumber={pageCourante} width={Math.min(window.innerWidth - 48, 640)} />
          </Document>
        )}
      </div>

      {!erreur && nbPages && (
        <div className="flex flex-col gap-2 border-t border-dj-bordure px-3 py-2">
          <input
            type="range"
            min={1}
            max={nbPages}
            value={pageCourante}
            onChange={(e) => allerA(Number(e.target.value))}
            className="w-full accent-dj-accent-1-texte"
            aria-label="Aller à la page"
          />
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={pageCourante <= 1}
              onClick={() => allerA(pageCourante - 1)}
              className="rounded-full p-1.5 text-dj-texte-muet transition-colors hover:text-dj-texte disabled:opacity-30"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="flex items-center gap-1.5 text-sm text-dj-texte-muet">
              Page
              <input
                type="number"
                min={1}
                max={nbPages}
                value={champPage}
                onChange={(e) => setChampPage(e.target.value)}
                onBlur={() => allerA(Number(champPage) || pageCourante)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                }}
                className="w-12 rounded-md border border-dj-bordure bg-transparent px-1 py-0.5 text-center text-dj-texte"
              />
              / {nbPages}
            </span>
            <button
              type="button"
              disabled={pageCourante >= nbPages}
              onClick={() => allerA(pageCourante + 1)}
              className="rounded-full p-1.5 text-dj-texte-muet transition-colors hover:text-dj-texte disabled:opacity-30"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
