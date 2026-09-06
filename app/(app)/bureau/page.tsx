import { SectionPage } from "@/components/SectionPage";
import { MesCodes } from "@/components/MesCodes";
import { EspaceEntrerCode } from "@/components/EspaceEntrerCode";
import { AuditCorrections } from "@/components/AuditCorrections";

export default function PageBureau() {
  return (
    <SectionPage title="Bureau">
      <div className="flex flex-col gap-4">
        <AuditCorrections />
        <MesCodes />
        <EspaceEntrerCode />
      </div>
    </SectionPage>
  );
}
