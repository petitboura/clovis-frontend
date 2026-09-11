"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Folder, FileText } from "lucide-react";
import { SectionPage } from "@/components/SectionPage";
import { CTACompteRequis } from "@/components/CTACompteRequis";
import { Skeleton } from "@/components/Skeleton";
import { obtenirDossierBibliothequeConsultation, type DossierBibliothequeConsultation } from "@/lib/api";
import { ErreurApi, messageErreur } from "@/lib/erreurs";

/**
 * 11/09/2026, demande Bourama : lien de partage direct pour un dossier
 * PERSO (et ses sous-dossiers) -- lecture seule, même affichage que la
 * version publique (app/(app)/dossiers/[id]/page.tsx), compte
 * obligatoire pour consulter. Aucune action automatique : n'ajoute rien
 * chez qui consulte.
 */
export default function PageDossierBibliothequePerso({ params }: { params: { id: string } }) {
  const [dossier, setDossier] = useState<DossierBibliothequeConsultation | null | undefined>(undefined);
  const [sansCompte, setSansCompte] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    obtenirDossierBibliothequeConsultation(params.id)
      .then(setDossier)
      .catch((e) => {
        if (e instanceof ErreurApi && e.statusCode === 401) {
          setSansCompte(true);
        } else if (e instanceof ErreurApi && e.statusCode === 404) {
          setDossier(null);
        } else {
          setErreur(messageErreur(e));
        }
      });
  }, [params.id]);

  if (sansCompte) {
    return (
      <SectionPage title="Dossier partagé">
        <CTACompteRequis texte="Crée un compte pour consulter ce dossier." />
      </SectionPage>
    );
  }

  if (erreur) {
    return (
      <SectionPage title="Dossier partagé">
        <p className="rounded-xl border border-dashed border-dj-bordure px-3 py-4 text-center text-xs text-dj-texte-muet">{erreur}</p>
      </SectionPage>
    );
  }

  if (dossier === undefined) {
    return (
      <SectionPage title="Dossier partagé">
        <Skeleton className="h-32 w-full rounded-cgpt-carte" />
      </SectionPage>
    );
  }

  if (dossier === null) {
    return (
      <SectionPage title="Dossier introuvable">
        <p className="rounded-xl border border-dashed border-dj-bordure px-3 py-4 text-center text-xs text-dj-texte-muet">
          Ce dossier est introuvable, ou a été supprimé par son propriétaire.
        </p>
      </SectionPage>
    );
  }

  return (
    <SectionPage title={dossier.nom}>
      <section className="rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-5">
        <div className="flex items-center gap-2">
          <Folder size={18} className="flex-shrink-0 text-dj-accent-1" />
          <h2 className="font-display text-base font-semibold text-dj-texte">{dossier.nom}</h2>
        </div>
      </section>

      <section className="rounded-cgpt-carte border border-dj-bordure bg-dj-surface">
        {dossier.fichiers.length === 0 ? (
          <p className="px-5 py-4 text-center text-xs text-dj-texte-muet">Ce dossier est vide pour l'instant.</p>
        ) : (
          <ul className="divide-y divide-dj-bordure">
            {dossier.fichiers.map((fichier) => (
              <li key={fichier.id}>
                <Link
                  href={`/bibliotheque/perso/${fichier.id}`}
                  className="flex items-center gap-2.5 px-5 py-3 transition-colors duration-200 ease-cgpt-doux hover:bg-dj-surface-haute"
                >
                  <FileText size={16} className="flex-shrink-0 text-dj-texte-muet" />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-dj-texte">{fichier.nom_fichier}</p>
                    {fichier.description && (
                      <p className="truncate text-xs text-dj-texte-muet">{fichier.description}</p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </SectionPage>
  );
}
