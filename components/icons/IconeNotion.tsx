import { forwardRef } from "react";
import type { LucideProps } from "lucide-react";

// Logo Notion redessiné en contour (style tabler-icons, licence MIT --
// https://tabler.io/icons), PAS l'icône lucide-react "BookOpen" utilisée
// avant en repli faute de mieux : lucide-react n'inclut aucun logo de
// marque pour Notion (contrairement à Github, disponible nativement).
//
// stroke="currentColor" par défaut, jamais une couleur de marque figée
// (noir Notion) -- le trait hérite donc de la couleur du bouton qui
// l'entoure (text-dj-texte quand connecté, text-dj-texte-muet sinon,
// 24/08 : plus de couleur accent ici, réservée aux actions principales),
// exactement comme <Github /> juste à côté dans BarreDeSaisie.tsx. Même
// interface de props qu'un composant lucide (size, color, strokeWidth...)
// pour rester interchangeable avec `Icone: typeof Github` dans
// lib/outils.ts, sans rien changer aux call sites existants.
export const IconeNotion = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, color = "currentColor", strokeWidth = 2, className, ...reste }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...reste}
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M7 7h3l6 6" />
      <path d="M8 7v10" />
      <path d="M7 17h2" />
      <path d="M15 7h2" />
      <path d="M16 7v10h-1l-7 -7" />
    </svg>
  )
);
IconeNotion.displayName = "IconeNotion";
