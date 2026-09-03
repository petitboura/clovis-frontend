"use client";

import { Check } from "lucide-react";

// Remplace l'input type="checkbox" natif partout dans le dépôt (03/09/2026,
// demande Bourama : "les cases à cocher non plus n'ont pas été traitées,
// elles utilisent celui du nav [navigateur/OS]"). Même logique que
// SelectPersonnalise.tsx pour les <select> : le rendu natif d'une case à
// cocher est dessiné par l'OS/le navigateur, pas stylable en CSS -- ce
// composant en est le remplacement direct, entièrement dans notre
// contrôle visuel, sur web comme en natif (Capacitor).
//
// L'input natif reste présent mais rendu invisible (opacity-0, superposé
// exactement à la case visuelle) : ça conserve gratuitement le
// comportement clavier, lecteur d'écran, et le clic sur un <label>
// englobant, sans rien à recâbler côté appelant.
export function CaseACocher({
  checked,
  onChange,
  disabled = false,
  className = "",
}: {
  checked: boolean;
  onChange: (coche: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <span className={`relative inline-flex h-4 w-4 flex-shrink-0 ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer absolute inset-0 h-4 w-4 cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span
        aria-hidden
        className={`pointer-events-none flex h-4 w-4 items-center justify-center rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-dj-accent-1 peer-disabled:opacity-50 ${
          checked ? "border-dj-accent-1 bg-dj-accent-1" : "border-dj-bordure bg-dj-surface peer-hover:border-dj-bordure-forte"
        }`}
      >
        {checked && <Check size={11} strokeWidth={3} className="text-[#1A0D02]" />}
      </span>
    </span>
  );
}
