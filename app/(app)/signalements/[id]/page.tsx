import { SectionPage } from "@/components/SectionPage";
import { ConfirmerVisibiliteSignalement } from "@/components/ConfirmerVisibiliteSignalement";

export default function PageSignalement({ params }: { params: { id: string } }) {
  return (
    <SectionPage title="Signalement">
      <ConfirmerVisibiliteSignalement signalementId={params.id} />
    </SectionPage>
  );
}
