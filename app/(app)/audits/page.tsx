import { SectionPage } from "@/components/SectionPage";
import { EspaceAudits } from "@/components/EspaceAudits";
import { BookOpen, ScanSearch } from "lucide-react";

const SOEURS = [
  { href: "/programme", label: "Mon programme", Icone: BookOpen },
  { href: "/audits", label: "Audits", Icone: ScanSearch },
];

export default function PageAudits() {
  return (
    <SectionPage title="Audits" groupe={{ label: "Scolarité", href: "/scolarite", soeurs: SOEURS }}>
      <EspaceAudits />
    </SectionPage>
  );
}
