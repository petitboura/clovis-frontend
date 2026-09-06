import { SectionPage } from "@/components/SectionPage";
import { MesCodes } from "@/components/MesCodes";
import { EspaceEntrerCode } from "@/components/EspaceEntrerCode";
import { AuditCorrections } from "@/components/AuditCorrections";
import { ListeCorrectionsProf } from "@/components/ListeCorrectionsProf";

export default function PageBureau() {
  return (
    <SectionPage title="Bureau">
      <div className="flex flex-col gap-4">
        <AuditCorrections />
        <MesCodes />
        <EspaceEntrerCode />
        <ListeCorrectionsProf />
      </div>
    </SectionPage>
  );
}
