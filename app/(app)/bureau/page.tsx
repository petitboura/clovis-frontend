import { SectionPage } from "@/components/SectionPage";
import { MesCodes } from "@/components/MesCodes";
import { EspaceEntrerCode } from "@/components/EspaceEntrerCode";
import { ProgrammeNotions } from "@/components/ProgrammeNotions";

export default function PageBureau() {
  return (
    <SectionPage title="Bureau">
      <div className="flex flex-col gap-4">
        <MesCodes />
        <ProgrammeNotions />
        <EspaceEntrerCode />
      </div>
    </SectionPage>
  );
}
