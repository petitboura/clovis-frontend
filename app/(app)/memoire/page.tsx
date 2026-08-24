import { SectionPage } from "@/components/SectionPage";
import { MaMemoire } from "@/components/MaMemoire";
import { ScrollText, Brain, Puzzle } from "lucide-react";

const SOEURS = [
  { href: "/comportements", label: "Mes skills", icone: <ScrollText size={16} className="flex-shrink-0" /> },
  { href: "/memoire", label: "Ma mémoire", icone: <Brain size={16} className="flex-shrink-0" /> },
  { href: "/plugins", label: "Plugins", icone: <Puzzle size={16} className="flex-shrink-0" /> },
];

export default function PageMemoire() {
  return (
    <SectionPage title="Ma mémoire" groupe={{ label: "Personnaliser Clovis", href: "/personnaliser", soeurs: SOEURS }}>
      <MaMemoire />
    </SectionPage>
  );
}
