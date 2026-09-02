"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, Download, ArrowUpDown, ArrowLeftRight, Rows3, BookOpen } from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Skeleton } from "./Skeleton";
import { telecharger } from "./VisionneuseBibliotheque";

// Worker servi depuis notre propre /public -- voir historique dans
// l'ancien emplacement de ce composant (VisionneurPositionGlobal.tsx,
// avant extraction du 01/09).
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf-worker/pdf.worker.min.mjs";

// Distance de glissement (px) à partir de laquelle un swipe change de
// page en mode "page par page" -- assez haut pour ne pas se déclencher
// sur un simple scroll involontaire, assez bas pour rester naturel au
// pouce. Sans effet en mode "continu" (scroll natif du navigateur).
const SEUIL_SWIPE_PX = 60;

function borner(n: number, max: number) {
  return Math.min(Math.max(n, 1), max);
}

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
// direct à une page donnée. Ajout des deux (flèches conservées) + champ
// numérique + curseur.
//
// 02/09, suite demande Bourama : ajout de 2 réglages indépendants --
// orientation (vertical/horizontal) et mode d'affichage (défilement
// continu/page par page), soit 4 combinaisons. Vertical + continu par
// défaut (toutes les pages empilées, on scroll normalement). En mode
// continu, la page "courante" (pour le champ/curseur) suit ce qui est
// visible à l'écran via IntersectionObserver ; en mode page par page,
// swipe tactile dans l'axe de l'orientation (horizontal = gauche/droite,
// vertical = haut/bas). Le plein écran, lui, est géré par les COMPOSANTS
// APPELANTS (VisionneuseBibliotheque.tsx, VisionneurPositionGlobal.tsx)
// -- ce sont eux qui possèdent le header/titre à côté duquel le bouton
// doit apparaître, et le conteneur modal à agrandir.
export function VisionneurPdf({ url, page = 1 }: { url: string; page?: number }) {
  const [nbPages, setNbPages] = useState<number | null>(null);
  const [pageCourante, setPageCourante] = useState(page);
  const [champPage, setChampPage] = useState(String(page));
  const [erreur, setErreur] = useState(false);
  const [orientation, setOrientation] = useState<"vertical" | "horizontal">("vertical");
  const [modeAffichage, setModeAffichage] = useState<"continu" | "page">("continu");
  const [largeur, setLargeur] = useState(0);

  const toucheDepart = useRef<{ x: number; y: number } | null>(null);
  const conteneurRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Largeur dispo mesurée sur le conteneur réel (pas window.innerWidth) :
  // nécessaire pour que le rendu s'adapte quand le conteneur change de
  // taille sans que ce composant ne change lui-même de props/état --
  // notamment au passage en plein écran, décidé par le parent.
  useEffect(() => {
    const el = conteneurRef.current;
    if (!el) return;
    const observateur = new ResizeObserver((entries) => {
      const l = entries[0]?.contentRect.width;
      if (l) setLargeur(Math.min(l - 24, 900));
    });
    observateur.observe(el);
    return () => observateur.disconnect();
  }, []);

  const allerA = useCallback(
    (n: number) => {
      if (!nbPages) return;
      const bornee = borner(n, nbPages);
      setPageCourante(bornee);
      setChampPage(String(bornee));
      if (modeAffichage === "continu") {
        pageRefs.current[bornee]?.scrollIntoView({
          behavior: "smooth",
          block: orientation === "vertical" ? "start" : "nearest",
          inline: orientation === "horizontal" ? "center" : "nearest",
        });
      }
    },
    [nbPages, modeAffichage, orientation],
  );

  // Mode continu : la page "courante" (champ/curseur) suit ce qui est
  // réellement visible à l'écran pendant le scroll.
  useEffect(() => {
    if (modeAffichage !== "continu" || !nbPages || !conteneurRef.current) return;
    const racine = conteneurRef.current;
    const observateur = new IntersectionObserver(
      (entries) => {
        const plusVisible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const n = plusVisible ? Number((plusVisible.target as HTMLElement).dataset.page) : null;
        if (n) {
          setPageCourante(n);
          setChampPage(String(n));
        }
      },
      { root: racine, threshold: [0.5] },
    );
    Object.values(pageRefs.current).forEach((el) => el && observateur.observe(el));
    return () => observateur.disconnect();
  }, [modeAffichage, orientation, nbPages]);

  function onToucheDebut(e: React.TouchEvent) {
    const t = e.touches[0];
    toucheDepart.current = { x: t.clientX, y: t.clientY };
  }

  function onToucheFin(e: React.TouchEvent) {
    if (!toucheDepart.current || modeAffichage !== "page") {
      toucheDepart.current = null;
      return;
    }
    const t = e.changedTouches[0];
    const deltaX = t.clientX - toucheDepart.current.x;
    const deltaY = t.clientY - toucheDepart.current.y;
    toucheDepart.current = null;
    if (orientation === "horizontal") {
      if (Math.abs(deltaX) < SEUIL_SWIPE_PX || Math.abs(deltaX) < Math.abs(deltaY)) return;
      allerA(pageCourante + (deltaX < 0 ? 1 : -1));
    } else {
      if (Math.abs(deltaY) < SEUIL_SWIPE_PX || Math.abs(deltaY) < Math.abs(deltaX)) return;
      allerA(pageCourante + (deltaY < 0 ? 1 : -1));
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div
        ref={conteneurRef}
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
              const bornee = borner(page, numPages);
              setPageCourante(bornee);
              setChampPage(String(bornee));
            }}
            onLoadError={() => setErreur(true)}
            loading={
              <div className="flex justify-center p-4" aria-hidden>
                <Skeleton className="rounded-lg" style={{ width: "min(100%, 640px)", aspectRatio: "1 / 1.414" }} />
              </div>
            }
          >
            {modeAffichage === "continu" ? (
              <div
                className={
                  orientation === "vertical"
                    ? "flex flex-col items-center gap-3"
                    : "flex flex-row items-start gap-3 overflow-x-auto"
                }
              >
                {Array.from({ length: nbPages ?? 0 }, (_, i) => i + 1).map((n) => (
                  <div
                    key={n}
                    ref={(el) => {
                      pageRefs.current[n] = el;
                    }}
                    data-page={n}
                    className={orientation === "horizontal" ? "shrink-0" : undefined}
                  >
                    {largeur > 0 && <Page pageNumber={n} width={largeur} />}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex justify-center">{largeur > 0 && <Page pageNumber={pageCourante} width={largeur} />}</div>
            )}
          </Document>
        )}
      </div>

      {!erreur && nbPages && (
        <div className="flex flex-col gap-2 border-t border-dj-bordure px-3 py-2">
          <div className="flex items-center justify-center gap-2 text-xs text-dj-texte-muet">
            <button
              type="button"
              onClick={() => setOrientation((o) => (o === "vertical" ? "horizontal" : "vertical"))}
              className="flex items-center gap-1 rounded-full border border-dj-bordure px-2 py-1 transition-colors hover:text-dj-texte"
              title="Changer l'orientation"
            >
              {orientation === "vertical" ? <ArrowUpDown size={13} /> : <ArrowLeftRight size={13} />}
              {orientation === "vertical" ? "Vertical" : "Horizontal"}
            </button>
            <button
              type="button"
              onClick={() => setModeAffichage((m) => (m === "continu" ? "page" : "continu"))}
              className="flex items-center gap-1 rounded-full border border-dj-bordure px-2 py-1 transition-colors hover:text-dj-texte"
              title="Changer le mode d'affichage"
            >
              {modeAffichage === "continu" ? <Rows3 size={13} /> : <BookOpen size={13} />}
              {modeAffichage === "continu" ? "Défilement continu" : "Page par page"}
            </button>
          </div>

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
