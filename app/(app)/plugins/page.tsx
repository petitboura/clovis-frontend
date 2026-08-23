import { SectionPage } from "@/components/SectionPage";
import { EspacePlugins } from "@/components/EspacePlugins";
import { ScrollText, Brain, Puzzle } from "lucide-react";

const SOEURS = [
  { href: "/comportements", label: "Mes skills", Icone: ScrollText },
  { href: "/memoire", label: "Ma mémoire", Icone: Brain },
  { href: "/plugins", label: "Plugins", Icone: Puzzle },
];

export default function PagePlugins() {
  return (
    <SectionPage title="Plugins" groupe={{ label: "Personnaliser Clovis", href: "/personnaliser", soeurs: SOEURS }}>
      <EspacePlugins />
    </SectionPage>
  );
}
