import { ChatSection } from "@/components/chat/ChatSection";

// Étape 2 (07/09/2026, chantier "chat plein écran = vraie section") :
// vraie route Next.js pour le chat, comme les autres sections
// (bibliotheque, parametres...), plutôt qu'un calque `fixed inset-0`
// monté par-dessus l'app (voir ChatFlottant.tsx). Rien ne pointe encore
// vers cette page pour l'instant (aucune barre d'onglets, bulle
// flottante ou palette de commandes) -- voir les étapes suivantes du
// chantier.
export default function PageChat() {
  return <ChatSection />;
}
