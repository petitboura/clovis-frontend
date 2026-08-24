import { SectionPage } from "@/components/SectionPage";
import { EspacePlugins } from "@/components/EspacePlugins";
import { ScrollText, Brain, Puzzle } from "lucide-react";

const SOEURS = [
  { href: "/comportements", label: "Mes skills", icone: <ScrollText size={16} className="flex-shrink-0" /> },
  { href: "/memoire", label: "Ma mémoire", icone: <Brain size={16} className="flex-shrink-0" /> },
  { href: "/plugins", label: "Plugins", icone: <Puzzle size={16} className="flex-shrink-0" /> },
];

export default function PagePlugins() {
  return (
    <SectionPage title="Plugins" groupe={{ label: "Personnaliser Clovis", href: "/personnaliser", soeurs: SOEURS }}>
      <EspacePlugins />
    </SectionPage>
  );
}
