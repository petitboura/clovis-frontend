import type { Metadata } from "next";
import { SectionPage } from "@/components/SectionPage";
import { EtablissementDetail } from "@/components/EtablissementDetail";
import { obtenirEtablissement } from "@/lib/api";
import { ErreurApi } from "@/lib/erreurs";

// Chantier "Clovis ouvert" (10/09/2026, Lot C) : cette route dynamique
// existait déjà, mais sans generateMetadata (titre/description invisibles
// pour Google et les partages de lien) ni generateStaticParams. Le
// contenu affiché à l'écran (EtablissementDetail) reste inchangé --
// client component, son propre fetch, son propre skeleton -- seule cette
// enveloppe devient un Server Component pour fournir les métadonnées.
//
// generateStaticParams renvoie un id factice ("placeholder"), jamais un
// tableau vide : requis par Next.js pour toute route dynamique sous
// `output: "export"` (build:capacitor) -- absent jusqu'ici, ce qui
// pouvait déjà faire échouer `npm run build:capacitor` sur cette page
// précise (signalé lors du Lot A, corrigé ici). Un tableau vide, lui,
// fait aussi échouer le build à cause d'un bug Next.js toujours ouvert
// (vercel/next.js#61213 et #71862, voir app/(app)/bibliotheque/[id]).
// Même raisonnement que /bibliotheque/[id] et /skills/[id] : l'app
// mobile affiche déjà les établissements via EspaceEtablissements.tsx,
// jamais par cette URL.
export async function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  try {
    const etablissement = await obtenirEtablissement(params.id);
    return {
      title: `${etablissement.nom} · Établissements Clovis`,
      description: etablissement.description || `Fiche établissement Clovis : ${etablissement.nom}.`,
      openGraph: {
        title: etablissement.nom,
        description: etablissement.description || undefined,
        type: "article",
      },
    };
  } catch (e) {
    if (e instanceof ErreurApi && e.statusCode === 404) {
      return { title: "Établissement introuvable · Clovis" };
    }
    return { title: "Établissement · Clovis" };
  }
}

export default function PageEtablissement({ params }: { params: { id: string } }) {
  return (
    <SectionPage title="Établissement">
      <EtablissementDetail etablissementId={params.id} />
    </SectionPage>
  );
}
