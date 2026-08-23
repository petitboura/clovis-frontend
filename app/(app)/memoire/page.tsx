import { SectionPage } from "@/components/SectionPage";
import { MaMemoire } from "@/components/MaMemoire";
import { ScrollText, Brain, Puzzle } from "lucide-react";

const SOEURS = [
  { href: "/comportements", label: "Mes skills", Icone: ScrollText },
  { href: "/memoire", label: "Ma mémoire", Icone: Brain },
  { href: "/plugins", label: "Plugins", Icone: Puzzle },
];

export default function PageMemoire() {
  return (
    <SectionPage title="Ma mémoire" groupe={{ label: "Personnaliser Clovis", href: "/personnaliser", soeurs: SOEURS }}>
      <MaMemoire />
    </SectionPage>
  );
}
