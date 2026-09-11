import { SectionPage } from "@/components/SectionPage";
import { ConfirmerVisibiliteSignalement } from "@/components/ConfirmerVisibiliteSignalement";

// generateStaticParams vide : requis par Next.js pour toute route
// dynamique sous `output: "export"` (build:capacitor), même raisonnement
// que app/(app)/bibliotheque/[id], skills/[id], dossiers/[id] et
// etablissements/[id]. L'app mobile n'accède jamais à cette page par
// cette URL (le flux élève/prof passe par le lien reçu, résolu côté
// client), donc un tableau vide n'a aucun effet sur le fonctionnement.
export async function generateStaticParams() {
  return [];
}

export default function PageSignalement({ params }: { params: { id: string } }) {
  return (
    <SectionPage title="Signalement">
      <ConfirmerVisibiliteSignalement signalementId={params.id} />
    </SectionPage>
  );
}
