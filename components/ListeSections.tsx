import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

// Reprend exactement le motif visuel de la liste de Paramètres
// (EspaceParametres.tsx : Liste + LigneListe) pour que les pages
// d'atterrissage de groupe ("Personnaliser Clovis", "Scolarité") soient
// visuellement reconnaissables comme la même famille de composant
// (refonte sidebar, 22/08/2026, demande Bourama : "ça doit exister comme
// pour Paramètres"). Seule différence : ici ce sont de vraies routes
// (Link), pas un switch d'état interne à une seule page, donc chaque
// ligne mène vers sa propre section avec son propre historique de
// navigateur.
export function ListeSections({
  sections,
}: {
  sections: { href: string; label: string; description: string; Icone: LucideIcon }[];
}) {
  return (
    <div className="overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface">
      <div className="divide-y divide-dj-bordure">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-dj-surface-haute"
          >
            <s.Icone size={18} className="flex-shrink-0 text-dj-texte-muet" />
            <div className="flex-1 overflow-hidden">
              <div className="truncate text-sm text-dj-texte">{s.label}</div>
              <div className="truncate text-xs text-dj-texte-muet">{s.description}</div>
            </div>
            <ChevronRight size={16} className="flex-shrink-0 text-dj-texte-muet" />
          </Link>
        ))}
      </div>
    </div>
  );
}
