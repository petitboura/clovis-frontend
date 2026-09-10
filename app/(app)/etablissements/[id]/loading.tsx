import { Skeleton } from "@/components/Skeleton";

// Skeleton de la route (10/09/2026, Lot C "Clovis ouvert") : même forme
// que le skeleton déjà présent dans EtablissementDetail.tsx pour son
// propre chargement client -- celui-ci ne couvre que la toute première
// fraction de seconde avant que le Server Component ne rende la page.
export default function ChargementEtablissement() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-24 pt-6 md:pt-8">
      <Skeleton className="h-6 w-1/2 rounded" />
      <div className="rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-5" aria-hidden>
        <Skeleton className="h-5 w-1/2 rounded" />
        <Skeleton className="mt-2 h-3 w-full rounded" style={{ animationDelay: "80ms" }} />
      </div>
    </div>
  );
}
