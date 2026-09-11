import { SectionPage } from "@/components/SectionPage";
import { ConfirmerVisibiliteSignalement } from "@/components/ConfirmerVisibiliteSignalement";

// generateStaticParams renvoie un id factice ("placeholder"), jamais un
// tableau vide : voir le commentaire détaillé dans
// app/(app)/bibliotheque/[id]/page.tsx (bug Next.js vercel/next.js#61213
// et #71862, un tableau vide fait échouer le build:capacitor). Même
// raisonnement que skills/[id], dossiers/[id] et etablissements/[id].
// L'app mobile n'accède jamais à cette page par cette URL (le flux
// élève/prof passe par le lien reçu, résolu côté client).
export async function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function PageSignalement({ params }: { params: { id: string } }) {
  return (
    <SectionPage title="Signalement">
      <ConfirmerVisibiliteSignalement signalementId={params.id} />
    </SectionPage>
  );
}
