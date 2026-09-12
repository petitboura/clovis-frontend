"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { BoutonTelechargerFichier } from "@/components/BoutonTelechargerFichier";
import { SectionPage } from "@/components/SectionPage";
import { VisionneurPdf } from "@/components/VisionneurPdf";
import { CTACompteRequis } from "@/components/CTACompteRequis";
import { Skeleton } from "@/components/Skeleton";
import { obtenirFichierBibliothequeConsultation, type FichierBibliothequeConsultation } from "@/lib/api";
import { ErreurApi, messageErreur } from "@/lib/erreurs";

/**
 * 11/09/2026, demande Bourama : lien de partage direct pour un fichier
 * PERSO, lecture seule, même affichage que la version publique
 * (app/(app)/bibliotheque/[id]/page.tsx), compte obligatoire pour
 * consulter (contrairement à la version publique, indexable/ouverte à
 * tous). Aucune action automatique : n'ajoute rien chez qui consulte.
 *
 * Extrait en composant client séparé de sa page (voir
 * app/(app)/bibliotheque/perso/[id]/page.tsx) : sous build:capacitor
 * (output: "export"), generateStaticParams ne peut être exporté que
 * depuis un Server Component, jamais depuis un fichier "use client"
 * (même contrainte que app/(app)/bibliotheque/[id]/page.tsx, corrigée
 * le 11/09/2026 sur ce dépôt pour l'id "placeholder").
 */
export function ConsultationFichierBibliothequePerso({ id }: { id: string }) {
  const [fichier, setFichier] = useState<FichierBibliothequeConsultation | null | undefined>(undefined);
  const [sansCompte, setSansCompte] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (id === "placeholder") {
      setFichier(null);
      return;
    }
    obtenirFichierBibliothequeConsultation(id)
      .then(setFichier)
      .catch((e) => {
        if (e instanceof ErreurApi && e.statusCode === 401) {
          setSansCompte(true);
        } else if (e instanceof ErreurApi && e.statusCode === 404) {
          setFichier(null);
        } else {
          setErreur(messageErreur(e));
        }
      });
  }, [id]);

  if (sansCompte) {
    return (
      <SectionPage title="Document partagé">
        <CTACompteRequis texte="Crée un compte pour consulter ce document." />
      </SectionPage>
    );
  }

  if (erreur) {
    return (
      <SectionPage title="Document partagé">
        <p className="rounded-xl border border-dashed border-dj-bordure px-3 py-4 text-center text-xs text-dj-texte-muet">{erreur}</p>
      </SectionPage>
    );
  }

  if (fichier === undefined) {
    return (
      <SectionPage title="Document partagé">
        <Skeleton className="h-32 w-full rounded-cgpt-carte" />
      </SectionPage>
    );
  }

  if (fichier === null) {
    return (
      <SectionPage title="Document introuvable">
        <p className="rounded-xl border border-dashed border-dj-bordure px-3 py-4 text-center text-xs text-dj-texte-muet">
          Ce document est introuvable, ou a été supprimé par son propriétaire.
        </p>
      </SectionPage>
    );
  }

  const estPdf = fichier.type_mime === "application/pdf";

  return (
    <SectionPage title={fichier.nom_fichier}>
      <section className="rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText size={18} className="flex-shrink-0 text-dj-accent-1" />
            <h2 className="font-display text-base font-semibold text-dj-texte">{fichier.nom_fichier}</h2>
          </div>
          {fichier.url_publique && (
            <BoutonTelechargerFichier url={fichier.url_publique} nom={fichier.nom_fichier} />
          )}
        </div>

        {fichier.description && <p className="mt-2 text-sm text-dj-texte-muet">{fichier.description}</p>}
      </section>

      {estPdf && fichier.url_publique && (
        <section className="h-[70vh] overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface">
          <VisionneurPdf url={fichier.url_publique} />
        </section>
      )}
    </SectionPage>
  );
}
