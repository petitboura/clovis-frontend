import { Skeleton } from "@/components/Skeleton";

// Skeleton de la route (10/09/2026, Lot B "Clovis ouvert") : forme
// fidèle à page.tsx (titre + actions + corps markdown).
export default function ChargementSkillPublique() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-24 pt-6 md:pt-8">
      <Skeleton className="h-6 w-1/2 rounded" />
      <div className="rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-5" aria-hidden>
        <Skeleton className="h-5 w-1/3 rounded" />
        <Skeleton className="mt-3 h-3 w-full rounded" style={{ animationDelay: "80ms" }} />
        <Skeleton className="mt-2 h-3 w-1/4 rounded" style={{ animationDelay: "140ms" }} />
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-9 w-36 rounded-cgpt-bouton" style={{ animationDelay: "180ms" }} />
          <Skeleton className="h-9 w-40 rounded-cgpt-bouton" style={{ animationDelay: "220ms" }} />
        </div>
      </div>
      <div className="rounded-cgpt-carte border border-dj-bordure bg-dj-surface-haute p-5" aria-hidden>
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="mt-2 h-3 w-full rounded" style={{ animationDelay: "60ms" }} />
        <Skeleton className="mt-2 h-3 w-2/3 rounded" style={{ animationDelay: "120ms" }} />
      </div>
    </div>
  );
}
