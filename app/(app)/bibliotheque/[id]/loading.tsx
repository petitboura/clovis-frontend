import { Skeleton } from "@/components/Skeleton";

// Skeleton de la route (10/09/2026, Lot A "Clovis ouvert") : forme
// fidèle à la carte réelle de page.tsx (titre + bouton télécharger +
// description + étiquettes), affiché par Next.js pendant que
// generateMetadata/le composant serveur attendent la réponse du
// backend, avant de basculer sur le contenu chargé.
export default function ChargementEntreeBibliothequePublique() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-24 pt-6 md:pt-8">
      <Skeleton className="h-6 w-1/2 rounded" />
      <div className="rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-5" aria-hidden>
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="h-5 w-1/3 rounded" />
          <Skeleton className="h-9 w-32 rounded-cgpt-bouton" />
        </div>
        <Skeleton className="mt-3 h-3 w-full rounded" style={{ animationDelay: "80ms" }} />
        <Skeleton className="mt-2 h-3 w-2/3 rounded" style={{ animationDelay: "140ms" }} />
        <div className="mt-3 flex gap-1.5">
          <Skeleton className="h-6 w-16 rounded-full" style={{ animationDelay: "180ms" }} />
          <Skeleton className="h-6 w-20 rounded-full" style={{ animationDelay: "220ms" }} />
        </div>
      </div>
    </div>
  );
}
