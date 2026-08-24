"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Check } from "lucide-react";
import { telechargerImage } from "@/lib/telechargerImageGraphique";

// Rend un bloc ```geometrie du markdown -- même famille que ```chart
// (GraphiqueDonnees.tsx) et ```carte (CarteMessage.tsx), ajouté le 27/07
// spécifiquement pour un usage maths : contrairement à la génération
// d'image IA (Pollinations/Together, section Sortie), ce composant
// trace des figures géométriquement EXACTES à partir de coordonnées
// données par le modèle, pas une illustration approximative.
//
// Schéma JSON attendu, volontairement large (polygones/vecteurs/repère
// dès le départ, décision de Bourama le 27/07) :
//   {
//     "titre"?: string,
//     "repere"?: boolean,              // axes x/y + grille, défaut true
//     "points": [{ "id": "A", "x": 0, "y": 0, "label"?: "A" }, ...],
//     "elements": [
//       { "type": "segment", "de": "A", "a": "B" },
//       { "type": "polygone", "points": ["A","B","C"], "rempli"?: bool },
//       { "type": "cercle", "centre": "A", "rayon": 3 },
//       { "type": "vecteur", "de": "A", "a": "B", "label"?: "u" },
//       { "type": "angle", "sommet": "B", "point1": "A", "point2": "C", "label"?: "β" }
//     ]
//   }
// Tous les éléments référencent des points par leur "id" (défini une
// seule fois dans "points") plutôt que de répéter des coordonnées --
// plus simple à écrire pour le modèle et plus lisible. Bornes du repère
// calculées automatiquement à partir de tous les points (+ marge),
// jamais besoin de les fournir à la main.

type Point = { id: string; x: number; y: number; label?: string };

type ElementSegment = { type: "segment"; de: string; a: string };
type ElementPolygone = { type: "polygone"; points: string[]; rempli?: boolean };
type ElementCercle = { type: "cercle"; centre: string; rayon: number };
type ElementVecteur = { type: "vecteur"; de: string; a: string; label?: string };
type ElementAngle = {
  type: "angle";
  sommet: string;
  point1: string;
  point2: string;
  label?: string;
};

type Element =
  | ElementSegment
  | ElementPolygone
  | ElementCercle
  | ElementVecteur
  | ElementAngle;

type Schema = {
  titre?: string;
  repere?: boolean;
  points: Point[];
  elements: Element[];
};

const COULEUR_TRAIT = "var(--dj-texte)";
const COULEUR_TRAIT_2 = "var(--dj-texte-muet)";
// CORRECTIF (17/08, v2) -- toutes ces couleurs suivent désormais les
// variables CSS double-thème. Avant (thème sombre unique), COULEUR_TEXTE
// et COULEUR_GRILLE/AXE étaient calibrées en dur pour un fond TOUJOURS
// sombre (bg-dj-surface). Depuis le passage au double thème,
// bg-dj-surface devient blanc en thème clair -- un texte/grille clairs
// codés en dur y seraient devenus quasi invisibles (clair sur clair).
const COULEUR_TEXTE = "var(--dj-texte)";
const COULEUR_GRILLE = "var(--dj-bordure)";
const COULEUR_AXE = "var(--dj-texte-muet)";

export function SchemaGeometrique({ code }: { code: string }) {
  const conteneurRef = useRef<HTMLDivElement>(null);
  const [telecharge, setTelecharge] = useState(false);
  const [schema, setSchema] = useState<Schema | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // CORRECTIF 2026-07-30 (audit UX, même principe que GraphiqueDonnees.tsx
  // et CarteMessage.tsx) : avant, un JSON réellement cassé (pas juste
  // encore en train d'arriver pendant le streaming) affichait
  // "Construction du schéma..." pour toujours, sans jamais de message
  // d'erreur. On attend désormais que le texte arrête de changer pendant
  // 500ms avant de tenter le parsing -- un échec à ce moment-là est une
  // vraie erreur, pas un JSON encore incomplet.
  useEffect(() => {
    const delai = setTimeout(() => {
      try {
        setSchema(JSON.parse(code));
        setErreur(null);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : String(e));
      }
    }, 500);
    return () => clearTimeout(delai);
  }, [code]);

  if (!schema) {
    if (erreur) {
      return (
        <div className="my-3 rounded-xl border border-dj-bordure bg-dj-surface p-4 text-xs text-dj-texte-muet">
          <span className="text-[var(--dj-erreur)]">Schéma invalide :</span> format JSON non reconnu.
        </div>
      );
    }
    return (
      <div className="my-3 flex h-40 items-center justify-center rounded-xl border border-dj-bordure bg-dj-surface text-xs text-dj-texte-muet">
        <span className="h-2 w-2 animate-dj-glow rounded-full bg-dj-texte-muet" />
        <span className="ml-2">Construction du schéma...</span>
      </div>
    );
  }

  if (!Array.isArray(schema.points) || schema.points.length === 0) {
    return (
      <div className="my-3 rounded-xl border border-dj-bordure bg-dj-surface p-4 text-xs text-dj-texte-muet">
        Schéma géométrique invalide (format non reconnu).
      </div>
    );
  }

  const points = schema.points;
  const parId = new Map(points.map((p) => [p.id, p]));
  const afficherRepere = schema.repere !== false;

  // Bornes automatiques : tous les points + rayons de cercles éventuels,
  // avec une marge de 15% pour ne jamais couper une étiquette au bord.
  let xMin = Math.min(...points.map((p) => p.x));
  let xMax = Math.max(...points.map((p) => p.x));
  let yMin = Math.min(...points.map((p) => p.y));
  let yMax = Math.max(...points.map((p) => p.y));
  for (const el of schema.elements || []) {
    // CORRECTIF 2026-07-31 (audit UX) : sans la vérification de rayon,
    // un cercle mal formé (rayon manquant/non numérique) donnait
    // `c.x - undefined` = NaN, qui contaminait xMin/xMax/yMin/yMax via
    // Math.min/Math.max (NaN se propage) -- résultat : TOUT le schéma
    // disparaissait (coordonnées SVG invalides pour chaque élément), pas
    // seulement le cercle fautif.
    if (el.type === "cercle" && typeof el.rayon === "number" && Number.isFinite(el.rayon) && el.rayon > 0) {
      const c = parId.get(el.centre);
      if (c) {
        xMin = Math.min(xMin, c.x - el.rayon);
        xMax = Math.max(xMax, c.x + el.rayon);
        yMin = Math.min(yMin, c.y - el.rayon);
        yMax = Math.max(yMax, c.y + el.rayon);
      }
    }
  }
  if (xMin === xMax) {
    xMin -= 1;
    xMax += 1;
  }
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  const margeX = (xMax - xMin) * 0.15 || 1;
  const margeY = (yMax - yMin) * 0.15 || 1;
  xMin -= margeX;
  xMax += margeX;
  yMin -= margeY;
  yMax += margeY;

  const largeurSvg = 480;
  const hauteurSvg = 360;
  const echelleX = largeurSvg / (xMax - xMin);
  const echelleY = hauteurSvg / (yMax - yMin);
  const echelle = Math.min(echelleX, echelleY);
  // Recentre pour garder les proportions (échelle identique en x et y --
  // indispensable en géométrie, sinon un cercle devient une ellipse et
  // un angle droit ne parait plus droit).
  const largeurUtile = (xMax - xMin) * echelle;
  const hauteurUtile = (yMax - yMin) * echelle;
  const decalX = (largeurSvg - largeurUtile) / 2;
  const decalY = (hauteurSvg - hauteurUtile) / 2;

  function versSvg(x: number, y: number): [number, number] {
    return [decalX + (x - xMin) * echelle, decalY + (yMax - y) * echelle];
  }

  // Grille + axes : uniquement des lignes entières visibles dans le
  // cadrage, pas un pas fixe (sinon illisible sur une grande figure ou
  // trop clairsemé sur une petite).
  const lignesGrilleX: number[] = [];
  for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) lignesGrilleX.push(x);
  const lignesGrilleY: number[] = [];
  for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) lignesGrilleY.push(y);

  const nomFichier = `${schema.titre ? schema.titre.replace(/[^a-z0-9-_]+/gi, "_") : "schema"}.png`;

  return (
    <div className="my-3 animate-dj-fade-in rounded-xl border border-dj-bordure bg-dj-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        {schema.titre ? (
          <p className="text-sm font-semibold text-dj-texte">{schema.titre}</p>
        ) : (
          <span />
        )}
        <button
          onClick={() =>
            telechargerImage(conteneurRef.current, nomFichier, () => {
              setTelecharge(true);
              setTimeout(() => setTelecharge(false), 1500);
            })
          }
          aria-label="Télécharger le schéma en image"
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-dj-texte-muet transition-colors hover:text-dj-texte"
        >
          {telecharge ? (
            <>
              <Check size={12} /> Téléchargé
            </>
          ) : (
            <>
              <Download size={12} /> Télécharger
            </>
          )}
        </button>
      </div>
      {/* CORRECTIF 2026-07-31 (audit UX/fiabilité, même principe que
          GraphiqueDonnees.tsx) : la référence passée à telechargerImage()
          est désormais scopée à CE SEUL wrapper (rien d'autre à
          l'intérieur que le <svg> du schéma), au lieu de la carte entière
          avec le bouton Télécharger et ses propres icônes lucide. */}
      <div ref={conteneurRef}>
        <svg
          viewBox={`0 0 ${largeurSvg} ${hauteurSvg}`}
          width="100%"
          height={280}
          className="mx-auto block"
        >
        {afficherRepere && (
          <g>
            {lignesGrilleX.map((x) => {
              const [x1, y1] = versSvg(x, yMin);
              const [x2, y2] = versSvg(x, yMax);
              return (
                <line
                  key={`gx-${x}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={x === 0 ? COULEUR_AXE : COULEUR_GRILLE}
                  strokeWidth={x === 0 ? 1.2 : 1}
                />
              );
            })}
            {lignesGrilleY.map((y) => {
              const [x1, y1] = versSvg(xMin, y);
              const [x2, y2] = versSvg(xMax, y);
              return (
                <line
                  key={`gy-${y}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={y === 0 ? COULEUR_AXE : COULEUR_GRILLE}
                  strokeWidth={y === 0 ? 1.2 : 1}
                />
              );
            })}
          </g>
        )}

        <defs>
          <marker
            id="fleche-vecteur"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 Z" fill={COULEUR_TRAIT_2} />
          </marker>
        </defs>

        {(schema.elements || []).map((el, index) => {
          if (el.type === "segment") {
            const p1 = parId.get(el.de);
            const p2 = parId.get(el.a);
            if (!p1 || !p2) return null;
            const [x1, y1] = versSvg(p1.x, p1.y);
            const [x2, y2] = versSvg(p2.x, p2.y);
            return (
              <line
                key={index}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={COULEUR_TRAIT}
                strokeWidth={2}
              />
            );
          }
          if (el.type === "polygone") {
            // CORRECTIF 2026-07-30 (audit sécurité/UX) : sans le
            // Array.isArray, un "points" mal formé (le modèle a oublié le
            // champ, ou donné autre chose qu'un tableau) faisait planter
            // TOUT le rendu du schéma -- contrairement aux autres types
            // d'éléments (segment/cercle/vecteur/angle), déjà protégés par
            // un simple "if (!p1 || !p2) return null".
            if (!Array.isArray(el.points)) return null;
            const pts = el.points.map((id) => parId.get(id)).filter(Boolean) as Point[];
            if (pts.length < 2) return null;
            const coords = pts.map((p) => versSvg(p.x, p.y).join(",")).join(" ");
            return (
              <polygon
                key={index}
                points={coords}
                fill={el.rempli ? "rgba(227,179,65,0.18)" : "none"}
                stroke={COULEUR_TRAIT}
                strokeWidth={2}
                strokeLinejoin="round"
              />
            );
          }
          if (el.type === "cercle") {
            const c = parId.get(el.centre);
            // CORRECTIF 2026-07-31 (audit UX, même famille que le fix
            // "polygone" ci-dessus) : un rayon manquant/invalide donnait
            // `r={NaN}` -- un attribut SVG invalide, silencieusement
            // ignoré par le navigateur. Résultat : le cercle disparaît
            // sans aucune erreur, alors que le reste du schéma s'affiche
            // normalement -- plus sournois qu'un plantage complet,
            // puisque rien ne signale qu'un élément manque.
            if (!c || typeof el.rayon !== "number" || !Number.isFinite(el.rayon) || el.rayon <= 0) return null;
            const [cx, cy] = versSvg(c.x, c.y);
            return (
              <circle
                key={index}
                cx={cx}
                cy={cy}
                r={el.rayon * echelle}
                fill="none"
                stroke={COULEUR_TRAIT}
                strokeWidth={2}
              />
            );
          }
          if (el.type === "vecteur") {
            const p1 = parId.get(el.de);
            const p2 = parId.get(el.a);
            if (!p1 || !p2) return null;
            const [x1, y1] = versSvg(p1.x, p1.y);
            const [x2, y2] = versSvg(p2.x, p2.y);
            const milieuX = (x1 + x2) / 2;
            const milieuY = (y1 + y2) / 2;
            return (
              <g key={index}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={COULEUR_TRAIT_2}
                  strokeWidth={2}
                  markerEnd="url(#fleche-vecteur)"
                />
                {el.label && (
                  <text
                    x={milieuX + 8}
                    y={milieuY - 8}
                    fill={COULEUR_TRAIT_2}
                    fontSize={13}
                    fontStyle="italic"
                  >
                    {el.label}
                  </text>
                )}
              </g>
            );
          }
          if (el.type === "angle") {
            const sommet = parId.get(el.sommet);
            const pt1 = parId.get(el.point1);
            const pt2 = parId.get(el.point2);
            if (!sommet || !pt1 || !pt2) return null;
            const rayon = 24;
            const angle1 = Math.atan2(pt1.y - sommet.y, pt1.x - sommet.x);
            const angle2 = Math.atan2(pt2.y - sommet.y, pt2.x - sommet.x);
            const [sx, sy] = versSvg(sommet.x, sommet.y);
            // Angle en SVG : axe Y inversé par rapport au repère
            // mathématique (versSvg fait déjà l'inversion pour les
            // points, ici on la refait sur les angles eux-mêmes pour
            // dessiner l'arc dans le bon sens).
            const a1 = -angle1;
            const a2 = -angle2;
            const arcX1 = sx + rayon * Math.cos(a1);
            const arcY1 = sy + rayon * Math.sin(a1);
            const arcX2 = sx + rayon * Math.cos(a2);
            const arcY2 = sy + rayon * Math.sin(a2);
            let diff = a2 - a1;
            while (diff < 0) diff += 2 * Math.PI;
            const grandArc = diff > Math.PI ? 1 : 0;
            const milieuAngle = a1 + diff / 2;
            const labelX = sx + (rayon + 14) * Math.cos(milieuAngle);
            const labelY = sy + (rayon + 14) * Math.sin(milieuAngle);
            return (
              <g key={index}>
                <path
                  d={`M ${arcX1} ${arcY1} A ${rayon} ${rayon} 0 ${grandArc} 0 ${arcX2} ${arcY2}`}
                  fill="none"
                  stroke={COULEUR_TRAIT_2}
                  strokeWidth={1.5}
                />
                {el.label && (
                  <text
                    x={labelX}
                    y={labelY}
                    fill={COULEUR_TRAIT_2}
                    fontSize={13}
                    textAnchor="middle"
                  >
                    {el.label}
                  </text>
                )}
              </g>
            );
          }
          return null;
        })}

        {points.map((p) => {
          const [x, y] = versSvg(p.x, p.y);
          return (
            <g key={p.id}>
              <circle cx={x} cy={y} r={3.5} fill={COULEUR_TEXTE} />
              <text x={x + 8} y={y - 8} fill={COULEUR_TEXTE} fontSize={13} fontWeight={600}>
                {p.label ?? p.id}
              </text>
            </g>
          );
        })}
      </svg>
      </div>
    </div>
  );
}
