import { SectionPage } from "@/components/SectionPage";
import { ProgrammesRecus } from "@/components/ProgrammesRecus";
import { EspaceProgramme } from "@/components/EspaceProgramme";
import { BookOpen, ScanSearch } from "lucide-react";

const SOEURS = [
  { href: "/programme", label: "Mon programme", Icone: BookOpen },
  { href: "/audits", label: "Audits", Icone: ScanSearch },
];

export default function PageProgramme() {
  return (
    <SectionPage title="Mon programme" groupe={{ label: "Scolarité", href: "/scolarite", soeurs: SOEURS }}>
      <ProgrammesRecus />
      <EspaceProgramme />
    </SectionPage>
  );
}
