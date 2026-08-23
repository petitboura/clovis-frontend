import { SectionPage } from "@/components/SectionPage";
import { ListeSections } from "@/components/ListeSections";
import { BookOpen, ScanSearch } from "lucide-react";

const SECTIONS = [
  {
    href: "/programme",
    label: "Mon programme",
    description: "Tes matières et chapitres, année par année",
    Icone: BookOpen,
  },
  {
    href: "/audits",
    label: "Audits",
    description: "L'analyse de tes points forts et de tes lacunes par matière",
    Icone: ScanSearch,
  },
];

export default function PageScolarite() {
  return (
    <SectionPage title="Scolarité">
      <ListeSections sections={SECTIONS} />
    </SectionPage>
  );
}
