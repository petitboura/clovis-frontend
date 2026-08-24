import { SectionPage } from "@/components/SectionPage";
import { EspaceAudits } from "@/components/EspaceAudits";
import { BookOpen, ScanSearch } from "lucide-react";

const SOEURS = [
  { href: "/programme", label: "Mon programme", icone: <BookOpen size={16} className="flex-shrink-0" /> },
  { href: "/audits", label: "Audits", icone: <ScanSearch size={16} className="flex-shrink-0" /> },
];

export default function PageAudits() {
  return (
    <SectionPage title="Audits" groupe={{ label: "Scolarité", href: "/scolarite", soeurs: SOEURS }}>
      <EspaceAudits />
    </SectionPage>
  );
}
