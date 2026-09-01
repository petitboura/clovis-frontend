import { Suspense } from "react";
import { SectionPage } from "@/components/SectionPage";
import { EspaceParametres } from "@/components/EspaceParametres";

export default function PageParametres() {
  return (
    <SectionPage title="Paramètres">
      <Suspense fallback={null}>
        <EspaceParametres />
      </Suspense>
    </SectionPage>
  );
}
