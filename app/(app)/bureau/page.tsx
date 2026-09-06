import { SectionPage } from "@/components/SectionPage";
import { MesCodes } from "@/components/MesCodes";
import { EspaceEntrerCode } from "@/components/EspaceEntrerCode";
import { AuditCorrections } from "@/components/AuditCorrections";
import { EspaceEtablissements } from "@/components/EspaceEtablissements";

export default function PageBureau() {
  return (
    <SectionPage title="Bureau">
      <div className="flex flex-col gap-4">
        <AuditCorrections />
        <MesCodes />
        <EspaceEntrerCode />
        {/* Partie 9 (06/09/2026) : pas d'entrée globale ajoutée dans
            AppSidebar/EspacePlus (menu "Plus") pour cette fonctionnalité --
            même logique que la note existante sur "Admin" dans
            EspacePlus.tsx, ça se déciderait avec Bourama. Elle vit ici
            dans Bureau comme les autres cartes de cette page, atteignable
            sans construire de nouvelle navigation globale. La fiche
            détail (/etablissements/[id]) reste, elle, déjà reliée depuis
            cette liste ET depuis les liens de notification du backend. */}
        <EspaceEtablissements />
      </div>
    </SectionPage>
  );
}
