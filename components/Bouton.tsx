// Composant de référence pour la partie 1 (squelette du dépôt Clovis).
// Nécessite les tokens "cgpt-*" ajoutés dans tailwind.config.ts
// (voir styles/tailwind-ajouts.ts) -- coins légèrement irréguliers +
// easings sur mesure, cf. brief section 4b.

import { ButtonHTMLAttributes } from "react";

interface ButonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: "primaire" | "secondaire" | "fantome";
}

const classesParVariante: Record<string, string> = {
  primaire:
    "bg-dj-accent-1 text-[#1a0f06] hover:bg-dj-accent-2 active:scale-[.98]",
  secondaire:
    "bg-dj-surface-haute text-dj-texte border border-dj-bordure hover:bg-dj-surface hover:border-dj-bordure-forte",
  fantome:
    "bg-transparent text-dj-texte-muet hover:text-dj-texte hover:bg-dj-surface",
};

export function Bouton({ variante = "primaire", className = "", disabled, ...props }: ButonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={`rounded-cgpt-bouton px-[22px] py-3 text-sm font-semibold font-sans transition-colors duration-200 ease-cgpt-doux disabled:pointer-events-none disabled:opacity-50 ${classesParVariante[variante]} ${className}`}
    />
  );
}
