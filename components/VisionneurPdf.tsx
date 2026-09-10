"use client";

import { useEffect, useRef, useState } from "react";
import {
  CanvasLayer,
  CurrentZoom,
  Page,
  Pages,
  Root,
  TextLayer,
  ZoomIn,
  ZoomOut,
  usePdfJump,
} from "@anaralabs/lector";
import "pdfjs-dist/web/pdf_viewer.css";
import { Download, ZoomIn as IconZoomIn, ZoomOut as IconZoomOut } from "lucide-react";
import { Skeleton } from "./Skeleton";
import { telecharger } from "./VisionneuseBibliotheque";

// 10/09, remplacement du lecteur PDF -- l'ancien (react-pdf/pdfjs custom,
// avec bascule orientation/mode page-par-page codée à la main) posait trop
// de bugs à maintenir. Bourama a choisi @anaralabs/lector (dernière
// version encore compatible React 18 : 3.7.1 -- 3.7.2 est passée à React
// 19 sans changer de version majeure, vérifié patch par patch avant
// d'installer). Comportement voulu, volontairement simplifié par rapport
// à l'ancien : scroll continu vertical + pincer-zoomer natif (lector gère
// ça lui-même en interne, voir son état isPinching), pas de bascule
// orientation/mode page-par-page.
//
// Le worker PDF servi depuis /public/pdf-worker a été mis à jour pour
// matcher la version de pdfjs-dist qu'installe lector (4.10.x) -- un
// mismatch API/Worker plante au chargement.
import { GlobalWorkerOptions } from "pdfjs-dist";
GlobalWorkerOptions.workerSrc = "/pdf-worker/pdf.worker.min.mjs";

// Délai (ms) au-delà duquel, si le document n'a toujours pas fini de
// charger, on affiche l'état d'erreur -- lector n'expose aucun callback
// d'erreur de chargement (vérifié dans son code source : un échec de
// getDocument() est juste loggé en console, le loader reste affiché
// indéfiniment sinon). Ce timeout + la pré-vérification réseau juste en
// dessous sont un contournement pour retrouver le comportement de
// l'ancien lecteur ("Impossible d'afficher ce PDF ici" + Télécharger).
const DELAI_ERREUR_MS = 20000;

// Composant interne : une fois le document chargé (donc à l'intérieur du
// PDFStore fourni par <Root>), saute à la page demandée au montage.
function SautInitial({ page }: { page: number }) {
  const { jumpToPage } = usePdfJump();
  const fait = useRef(false);
  useEffect(() => {
    if (fait.current || page <= 1) return;
    fait.current = true;
    // page ici est 1-indexée (comme l'ancienne API) ; jumpToPage attend
    // un index 0-indexé chez lector (comme pdf.js) -- d'où le -1.
    jumpToPage(page - 1, { behavior: "auto" });
  }, [page, jumpToPage]);
  return null;
}

export function VisionneurPdf({ url, page = 1 }: { url: string; page?: number }) {
  const [erreur, setErreur] = useState(false);
  const [pretAVerifier, setPretAVerifier] = useState(false);

  // Pré-vérification réseau : les échecs les plus courants (URL 404,
  // fichier supprimé côté Supabase, CORS) sont détectés tout de suite au
  // lieu d'attendre le timeout complet ci-dessous.
  useEffect(() => {
    let annule = false;
    setErreur(false);
    setPretAVerifier(false);
    fetch(url, { method: "HEAD" })
      .then((reponse) => {
        if (annule) return;
        if (!reponse.ok) {
          setErreur(true);
        } else {
          setPretAVerifier(true);
        }
      })
      .catch(() => {
        if (!annule) setErreur(true);
      });
    return () => {
      annule = true;
    };
  }, [url]);

  if (erreur) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center text-dj-texte-muet">
        <p>Impossible d&apos;afficher ce PDF ici.</p>
        <button
          type="button"
          onClick={() => telecharger(url, "document.pdf")}
          className="flex items-center gap-1 text-dj-accent-1-texte hover:underline"
        >
          <Download size={14} /> Télécharger
        </button>
      </div>
    );
  }

  if (!pretAVerifier) {
    return (
      <div className="flex h-full justify-center p-4" aria-hidden>
        <Skeleton className="rounded-lg" style={{ width: "min(100%, 640px)", aspectRatio: "1 / 1.414" }} />
      </div>
    );
  }

  return <VisionneurPdfCharge url={url} page={page} onErreur={() => setErreur(true)} />;
}

function VisionneurPdfCharge({
  url,
  page,
  onErreur,
}: {
  url: string;
  page: number;
  onErreur: () => void;
}) {
  const delaiRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    delaiRef.current = setTimeout(onErreur, DELAI_ERREUR_MS);
    return () => {
      if (delaiRef.current) clearTimeout(delaiRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full flex-col">
      <Root
        source={url}
        className="flex-1 overflow-hidden"
        loader={
          <div className="flex h-full justify-center p-4" aria-hidden>
            <Skeleton className="rounded-lg" style={{ width: "min(100%, 640px)", aspectRatio: "1 / 1.414" }} />
          </div>
        }
        isZoomFitWidth
        zoomOptions={{ minZoom: 0.5, maxZoom: 4 }}
        onDocumentLoad={() => {
          // le chargement a réussi -- on annule le garde-fou timeout.
          if (delaiRef.current) clearTimeout(delaiRef.current);
        }}
      >
        <SautInitial page={page} />
        <Pages className="h-full overflow-auto p-3">
          <Page>
            <CanvasLayer />
            <TextLayer />
          </Page>
        </Pages>
      </Root>

      <div className="flex items-center justify-center gap-2 border-t border-dj-bordure px-3 py-2 text-xs text-dj-texte-muet">
        <ZoomOut
          className="flex items-center gap-1 rounded-full border border-dj-bordure p-1.5 transition-colors hover:text-dj-texte"
          aria-label="Zoom arrière"
        >
          <IconZoomOut size={14} />
        </ZoomOut>
        <span className="flex items-center gap-0.5">
          <CurrentZoom className="w-10 rounded-md border border-dj-bordure bg-transparent px-1 py-0.5 text-center text-dj-texte" />
          %
        </span>
        <ZoomIn
          className="flex items-center gap-1 rounded-full border border-dj-bordure p-1.5 transition-colors hover:text-dj-texte"
          aria-label="Zoom avant"
        >
          <IconZoomIn size={14} />
        </ZoomIn>
      </div>
    </div>
  );
}
