import type { Metadata } from "next";
import Link from "next/link";
import { Folder, FileText } from "lucide-react";
import { SectionPage } from "@/components/SectionPage";
import { obtenirDossierCataloguePublic, listerBibliothequePublique } from "@/lib/api";
import { ErreurApi } from "@/lib/erreurs";

// Chantier "Clovis ouvert" (10/09/2026, Lot E) : même principe que les
// lots précédents. Server Component pour generateMetadata + premier
// rendu HTML non vide.
//
// generateStaticParams vide : même raisonnement que les autres routes
// dynamiques de ce chantier (voir app/(app)/bibliotheque/[id]/page.tsx),
// requis par Next.js sous `output: "export"` (build:capacitor).
export async function generateStaticParams() {
  return [];
}

async function chargerDossier(id: string) {
  try {
    return await obtenirDossierCataloguePublic(id);
  } catch (e) {
    if (e instanceof ErreurApi && e.statusCode === 404) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const dossier = await chargerDossier(params.id);
  if (!dossier) {
    return { title: "Dossier introuvable · Bibliothèque Clovis" };
  }
  return {
    title: `${dossier.nom} · Bibliothèque Clovis`,
    description: dossier.description || `Dossier de la bibliothèque publique Clovis : ${dossier.nom}.`,
    openGraph: {
      title: dossier.nom,
      description: dossier.description || undefined,
      type: "article",
    },
  };
}

export default async function PageDossierCataloguePublic({ params }: { params: { id: string } }) {
  const dossier = await chargerDossier(params.id);

  if (!dossier) {
    return (
      <SectionPage title="Dossier introuvable">
        <p className="rounded-xl border border-dashed border-dj-bordure px-3 py-4 text-center text-xs text-dj-texte-muet">
          Ce dossier est introuvable sur la bibliothèque publique.
        </p>
      </SectionPage>
    );
  }

  // La liste des fichiers réutilise l'endpoint déjà public du Lot A
  // (GET /api/bibliotheque-publique?dossier_id=...) -- aucune nouvelle
  // route nécessaire pour ça, best-effort si l'appel échoue (mieux vaut
  // afficher le dossier sans son contenu qu'une page en erreur).
  let entrees: Awaited<ReturnType<typeof listerBibliothequePublique>> = [];
  try {
    entrees = await listerBibliothequePublique(undefined, { dossierId: dossier.id, limite: 100 });
  } catch {
    entrees = [];
  }

  return (
    <SectionPage title={dossier.nom}>
      <section className="rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-5">
        <div className="flex items-center gap-2">
          <Folder size={18} className="flex-shrink-0 text-dj-accent-1" />
          <h2 className="font-display text-base font-semibold text-dj-texte">{dossier.nom}</h2>
        </div>
        {dossier.description && <p className="mt-2 text-sm text-dj-texte-muet">{dossier.description}</p>}
      </section>

      <section className="rounded-cgpt-carte border border-dj-bordure bg-dj-surface">
        {entrees.length === 0 ? (
          <p className="px-5 py-4 text-center text-xs text-dj-texte-muet">Ce dossier est vide pour l'instant.</p>
        ) : (
          <ul className="divide-y divide-dj-bordure">
            {entrees.map((entree) => (
              <li key={entree.id}>
                <Link
                  href={`/bibliotheque/${entree.id}`}
                  className="flex items-center gap-2.5 px-5 py-3 transition-colors duration-200 ease-cgpt-doux hover:bg-dj-surface-haute"
                >
                  <FileText size={16} className="flex-shrink-0 text-dj-texte-muet" />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-dj-texte">{entree.nom}</p>
                    {entree.description && (
                      <p className="truncate text-xs text-dj-texte-muet">{entree.description}</p>
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
