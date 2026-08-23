import { SectionPage } from "@/components/SectionPage";
import { MesComportements } from "@/components/MesComportements";
import { ScrollText, Brain, Puzzle } from "lucide-react";

// Agent unique de Clovis (voir components/chat/ChatFlottant.tsx) --
// même constante que partout ailleurs dans l'app.
const AGENT_ID = "clovis";

const SOEURS = [
  { href: "/comportements", label: "Mes skills", Icone: ScrollText },
  { href: "/memoire", label: "Ma mémoire", Icone: Brain },
  { href: "/plugins", label: "Plugins", Icone: Puzzle },
];

export default function PageComportements() {
  return (
    <SectionPage title="Mes skills" groupe={{ label: "Personnaliser Clovis", href: "/personnaliser", soeurs: SOEURS }}>
      <MesComportements agentId={AGENT_ID} />
    </SectionPage>
  );
}
