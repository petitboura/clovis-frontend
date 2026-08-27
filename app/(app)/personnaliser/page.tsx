import { SectionPage } from "@/components/SectionPage";
import { ListeSections } from "@/components/ListeSections";
import { ScrollText, Brain } from "lucide-react";

const SECTIONS = [
  {
    href: "/comportements",
    label: "Mes skills",
    description: "Des instructions personnalisées que Clovis suit dans le chat",
    Icone: ScrollText,
  },
  {
    href: "/memoire",
    label: "Ma mémoire",
    description: "Ce que Clovis retient de toi entre les conversations",
    Icone: Brain,
  },
];

export default function PagePersonnaliser() {
  return (
    <SectionPage title="Personnaliser Clovis">
      <ListeSections sections={SECTIONS} />
    </SectionPage>
  );
}
