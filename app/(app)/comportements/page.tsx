import { SectionPage } from "@/components/SectionPage";
import { MesComportements } from "@/components/MesComportements";
import { ScrollText, Brain } from "lucide-react";

// Agent unique de Clovis (voir components/chat/ChatFlottant.tsx) --
// même constante que partout ailleurs dans l'app.
const AGENT_ID = "clovis";

const SOEURS = [
  { href: "/comportements", label: "Mes skills", icone: <ScrollText size={16} className="flex-shrink-0" /> },
  { href: "/memoire", label: "Ma mémoire", icone: <Brain size={16} className="flex-shrink-0" /> },
];

export default function PageComportements() {
  return (
    <SectionPage title="Mes skills" groupe={{ label: "Personnaliser Clovis", href: "/personnaliser", soeurs: SOEURS }}>
      <MesComportements agentId={AGENT_ID} />
    </SectionPage>
  );
}
