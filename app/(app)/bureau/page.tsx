"use client";

import { useState } from "react";
import { SectionPage } from "@/components/SectionPage";
import { MesCodes } from "@/components/MesCodes";
import { EspaceEntrerCode } from "@/components/EspaceEntrerCode";
import { AuditCorrections } from "@/components/AuditCorrections";
import { EspaceEtablissements } from "@/components/EspaceEtablissements";
import { ProgrammeNotions } from "@/components/ProgrammeNotions";
import { ListeCorrectionsProf } from "@/components/ListeCorrectionsProf";
import { IndicateurCascadeSupervision } from "@/components/IndicateurCascadeSupervision";
import { OngletsSegment } from "@/components/OngletsSegment";

// 08/09/2026, demande Bourama : les 6 cartes de Bureau (hors bandeau
// d'alerte) étaient empilées en liste plate -- transformées en onglets,
// avec OngletsSegment (composant déjà partagé, voir sa propre note du
// 31/08) pour rester cohérent avec le reste de l'app plutôt que
// réinventer un style d'onglets propre à cette page.
// Le bandeau IndicateurCascadeSupervision reste explicitement au-dessus,
// hors onglets (confirmé par Bourama) : c'est le seul élément de cette
// page qui signale une action à faire sous 2 jours, il doit continuer à
// sauter aux yeux immédiatement, pas être caché derrière un choix d'onglet.
type OngletBureau = "audit" | "codes" | "programme" | "entrer_code" | "etablissements" | "corrections";

const ONGLETS_BUREAU: { valeur: OngletBureau; libelle: string }[] = [
  { valeur: "audit", libelle: "Audit hebdomadaire" },
  { valeur: "codes", libelle: "Mes codes" },
  { valeur: "programme", libelle: "Programme" },
  { valeur: "entrer_code", libelle: "Entrer un code" },
  { valeur: "etablissements", libelle: "Établissements" },
  { valeur: "corrections", libelle: "Corrections" },
];

export default function PageBureau() {
  const [onglet, setOnglet] = useState<OngletBureau>("audit");

  return (
    <SectionPage title="Bureau">
      <div className="flex flex-col gap-4">
        {/* Partie 10 (07/09/2026) : au-dessus du reste, seule carte de
            cette page qui n'affiche rien tant qu'il n'y a rien d'actif --
            volontairement en tête, hors onglets, c'est le seul cas de
            cette page qui appelle une action à faire sous 2 jours. */}
        <IndicateurCascadeSupervision />

        <OngletsSegment
          onglets={ONGLETS_BUREAU}
          valeur={onglet}
          onChange={(v) => setOnglet(v as OngletBureau)}
          ariaLabel="Sections du Bureau"
        />

        {onglet === "audit" && <AuditCorrections />}
        {onglet === "codes" && <MesCodes />}
        {onglet === "programme" && <ProgrammeNotions />}
        {onglet === "entrer_code" && <EspaceEntrerCode />}
        {/* Partie 9 (06/09/2026) : pas d'entrée globale ajoutée dans
            AppSidebar/EspacePlus (menu "Plus") pour cette fonctionnalité --
            même logique que la note existante sur "Admin" dans
            EspacePlus.tsx, ça se déciderait avec Bourama. Elle vit ici
            dans Bureau comme les autres onglets, atteignable sans
            construire de nouvelle navigation globale. La fiche détail
            (/etablissements/[id]) reste, elle, déjà reliée depuis cette
            liste ET depuis les liens de notification du backend. */}
        {onglet === "etablissements" && <EspaceEtablissements />}
        {onglet === "corrections" && <ListeCorrectionsProf />}
      </div>
    </SectionPage>
  );
}
