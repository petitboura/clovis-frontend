import { EcranAccueil } from "@/components/EcranAccueil";

// Vraie page d'accueil (16/08/2026, demande Bourama). Remplace
// l'ancienne redirection "/" -> une section interne (qui traitait un
// onglet existant comme accueil par défaut, pas un vrai accueil). Placée
// à l'intérieur du groupe (app) (voir app/(app)/layout.tsx) pour hériter
// de la nav persistante et du chat flottant, contrairement à
// l'ancien app/page.tsx qui vivait hors de ce groupe.
export default function PageAccueil() {
  return <EcranAccueil />;
}
