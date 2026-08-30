import { SectionPage } from "@/components/SectionPage";
import { EspaceRappels } from "@/components/EspaceRappels";

// 30/08/2026, audit navigation web mobile vs natif, étape 2 : route créée
// pour EspaceRappels.tsx, écran fini (plugin natif iOS et Android déjà
// branché) mais jusqu'ici totalement orphelin, aucune route ni aucun
// lien ne menait à lui nulle part dans l'app. Ajouté au menu Plus
// unifié (voir SECTIONS_BASE dans components/EspacePlus.tsx), donc
// atteignable en natif ET en web mobile. Même pattern que
// /controle-session (SectionPage + composant existant, aucun nouveau
// composant construit ici).
export default function PageRappels() {
  return (
    <SectionPage title="Rappels">
      <EspaceRappels />
    </SectionPage>
  );
}
