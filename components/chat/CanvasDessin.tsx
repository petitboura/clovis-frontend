"use client";

import { useRef, useState, useEffect } from "react";
import { X, Trash2, Eraser, Pencil } from "lucide-react";
import { PanneauFlottant } from "@/components/PanneauFlottant";

// Canvas de dessin (2026-07-25, demande de Bourama : usage maths --
// géométrie, tracé de courbe, croquis fait directement dans l'app plutôt
// que de devoir dessiner sur papier puis prendre une photo). Volontairement
// simple : pas d'outils formes/règle/calques, juste tracé libre + gomme +
// quelques couleurs, suffisant pour un croquis rapide qui sert de support
// à une question. Sort un fichier PNG classique et se branche sur le MÊME
// pipeline que "Joindre un fichier" (choisirFichier dans BarreDeSaisie.tsx)
// -- aucun changement backend nécessaire, un dessin est traité exactement
// comme une image uploadée (vision Gemini).
//
// Fond blanc fixe (pas le thème sombre de l'app) : un trait noir sur fond
// sombre serait à peine visible, et ça imite une feuille de papier -- plus
// lisible pour le modèle de vision au moment de l'envoi.
const COULEURS = ["#111111", "#dc2626", "#2563eb", "#16a34a"];
const EPAISSEURS = [2, 5, 10];

export function CanvasDessin({
  onValider,
  onFermer,
  enSortie,
}: {
  onValider: (fichier: File) => void;
  onFermer: () => void;
  // 18/08/2026, voir lib/useFermetureAnimee.ts -- hook dans le parent
  // (BarreDeSaisie.tsx), même raison que EditeurMathsRiche.tsx : onValider
  // ferme aussi directement, en plus de onFermer/X.
  enSortie?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dessineRef = useRef(false);
  const dernierPointRef = useRef<{ x: number; y: number } | null>(null);
  const [couleur, setCouleur] = useState(COULEURS[0]);
  const [epaisseur, setEpaisseur] = useState(EPAISSEURS[1]);
  const [gomme, setGomme] = useState(false);
  const [aDessine, setADessine] = useState(false);

  // Initialise un fond blanc plein -- un canvas est transparent par
  // défaut, ce qui donnerait un PNG à fond transparent (mauvais rendu une
  // fois envoyé si affiché sur un fond sombre ailleurs, et la gomme doit
  // avoir un blanc à révéler, pas de la transparence).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }, []);

  function position(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function debuterTrait(e: React.PointerEvent<HTMLCanvasElement>) {
    dessineRef.current = true;
    dernierPointRef.current = position(e);
    setADessine(true);
  }

  function tracer(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dessineRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !dernierPointRef.current) return;
    const point = position(e);
    ctx.beginPath();
    ctx.moveTo(dernierPointRef.current.x, dernierPointRef.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.strokeStyle = gomme ? "#ffffff" : couleur;
    ctx.lineWidth = gomme ? epaisseur * 3 : epaisseur;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    dernierPointRef.current = point;
  }

  function terminerTrait() {
    dessineRef.current = false;
    dernierPointRef.current = null;
  }

  function effacerTout() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { width, height } = canvas.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    setADessine(false);
  }

  function valider() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const fichier = new File([blob], `dessin-${Date.now()}.png`, { type: "image/png" });
      onValider(fichier);
    }, "image/png");
  }

  return (
    <PanneauFlottant
      onFerme={onFermer}
      pleine
      enSortie={enSortie}
      entete={
        <div className="flex items-center justify-between">
          <span className="text-sm text-dj-texte-muet">Dessin, géométrie, graphe, croquis</span>
          <button
            onClick={onFermer}
            aria-label="Fermer"
            className="flex items-center gap-1.5 rounded-lg border border-dj-bordure px-2.5 py-1.5 text-xs text-dj-texte-muet hover:text-dj-texte"
          >
            <X size={14} /> Fermer
          </button>
        </div>
      }
    >
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-dj-bordure bg-dj-surface">
        <canvas
          ref={canvasRef}
          onPointerDown={debuterTrait}
          onPointerMove={tracer}
          onPointerUp={terminerTrait}
          onPointerLeave={terminerTrait}
          className="h-full w-full touch-none"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {COULEURS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setCouleur(c);
                setGomme(false);
              }}
              aria-label={`Couleur ${c}`}
              className={`h-6 w-6 rounded-full border-2 ${!gomme && couleur === c ? "border-dj-texte" : "border-transparent"}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <span className="mx-1 h-6 w-px bg-dj-bordure" />
          {EPAISSEURS.map((ep) => (
            <button
              key={ep}
              onClick={() => setEpaisseur(ep)}
              aria-label={`Épaisseur ${ep}`}
              className={`flex h-7 w-7 items-center justify-center rounded-md border ${epaisseur === ep ? "border-dj-texte" : "border-dj-bordure"}`}
            >
              <span className="rounded-full bg-dj-texte" style={{ width: ep, height: ep }} />
            </button>
          ))}
          <span className="mx-1 h-6 w-px bg-dj-bordure" />
          <button
            onClick={() => setGomme((v) => !v)}
            aria-label="Gomme"
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${
              gomme ? "border-dj-texte text-dj-texte" : "border-dj-bordure text-dj-texte-muet hover:text-dj-texte"
            }`}
          >
            <Eraser size={14} /> Gomme
          </button>
          <button
            onClick={effacerTout}
            aria-label="Tout effacer"
            className="flex items-center gap-1.5 rounded-lg border border-dj-bordure px-2.5 py-1.5 text-xs text-dj-texte-muet hover:text-dj-texte"
          >
            <Trash2 size={14} /> Effacer tout
          </button>
        </div>

        <button
          onClick={valider}
          disabled={!aDessine}
          className="flex items-center gap-1.5 rounded-lg bg-dj-accent-1 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          <Pencil size={14} /> Utiliser ce dessin
        </button>
      </div>
    </PanneauFlottant>
  );
}
