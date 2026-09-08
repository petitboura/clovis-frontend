import { SectionPage } from "@/components/SectionPage";
import { MesCodes } from "@/components/MesCodes";
import { EspaceEntrerCode } from "@/components/EspaceEntrerCode";
import { AuditCorrections } from "@/components/AuditCorrections";
import { EspaceEtablissements } from "@/components/EspaceEtablissements";
import { ProgrammeNotions } from "@/components/ProgrammeNotions";
import { ListeCorrectionsProf } from "@/components/ListeCorrectionsProf";
import { IndicateurCascadeSupervision } from "@/components/IndicateurCascadeSupervision";

export default function PageBureau() {
  return (
    <SectionPage title="Bureau">
      <div className="flex flex-col gap-4">
        {/* Partie 10 (07/09/2026) : au-dessus du reste, seule carte de
            cette page qui n'affiche rien tant qu'il n'y a rien d'actif --
            volontairement en tête quand elle apparaît, c'est le seul cas
            de cette page qui appelle une action à faire sous 2 jours. */}
        <IndicateurCascadeSupervision />
        <AuditCorrections />
        <MesCodes />
        <ProgrammeNotions />
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
        <ListeCorrectionsProf />
      </div>
    </SectionPage>
  );
}
