import { SectionPage } from "@/components/SectionPage";
import { EtablissementDetail } from "@/components/EtablissementDetail";

export default function PageEtablissement({ params }: { params: { id: string } }) {
  return (
    <SectionPage title="Établissement">
      <EtablissementDetail etablissementId={params.id} />
    </SectionPage>
  );
}
