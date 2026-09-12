import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { SectionPage } from "@/components/SectionPage";
import { VisionneurPdf } from "@/components/VisionneurPdf";
import { BoutonTelechargerFichier } from "@/components/BoutonTelechargerFichier";
import { obtenirEntreeBibliothequePublique, type EntreeBibliothequePublique } from "@/lib/api";
import { ErreurApi } from "@/lib/erreurs";

// Chantier "Clovis ouvert" (10/09/2026, demande Bourama : chaque PDF de
// la bibliothèque publique retrouvable par son nom, indexable par
// Google, et téléchargeable via un lien propre -- jusqu'ici cette
// entrée n'existait que dans la liste côté client, aucune URL dédiée).
//
// Server Component volontairement (pas "use client") : c'est ce qui
// permet generateMetadata (titre/description lus par Google et les
// aperçus de lien partagés) et un premier rendu HTML non vide pour les
// robots d'indexation -- une page purement client ne leur montre rien.
//
// `generateStaticParams` retourne un id factice ("placeholder"), jamais
// un tableau vide : requis par Next.js dès qu'une route dynamique existe
// sous `output: "export"` (voir next.config.mjs, build:capacitor), MAIS
// un tableau vide déclenche un bug connu et toujours ouvert de Next.js
// (Page "..." is missing "generateStaticParams()" alors qu'elle existe
// bel et bien -- vercel/next.js#61213 et #71862, constaté le 11/09/2026
// sur ce dépôt). Le paramètre factice n'est jamais réellement atteint :
// l'app native affiche déjà ces fichiers via EspaceBibliotheque.tsx,
// jamais par cette URL. Le déploiement web normal (Vercel, sans
// CAPACITOR_BUILD) reste, lui, dynamique par requête comme n'importe
// quelle autre route Next : cette page continue de fonctionner pour
// n'importe quel id, y compris ceux publiés après le build.
//
// NOTE POUR BOURAMA : `app/(app)/etablissements/[id]/page.tsx` est déjà
// une route dynamique existante mais n'a ni `generateStaticParams` ni
// `generateMetadata` -- à vérifier si le build `build:capacitor` passe
// bien pour elle aujourd'hui (pas touché ici, hors périmètre du lot en
// cours, je le signale seulement).
export async function generateStaticParams() {
  return [{ id: "placeholder" }];
}

async function chargerEntree(id: string): Promise<EntreeBibliothequePublique | null> {
  // L'id "placeholder" (voir generateStaticParams ci-dessus) n'existe
  // jamais réellement côté backend -- ne pas l'appeler du tout : le
  // backend renvoie une 500 (pas une 404 propre) sur un id hors format
  // UUID, ce qui ferait planter tout l'export statique. Constaté le
  // 11/09/2026 sur ce dépôt.
  if (id === "placeholder") return null;
  try {
    return await obtenirEntreeBibliothequePublique(id);
  } catch (e) {
    if (e instanceof ErreurApi && e.statusCode === 404) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const entree = await chargerEntree(params.id);
  if (!entree) {
    return { title: "Document introuvable · Bibliothèque Clovis" };
  }
  return {
    title: `${entree.nom} · Bibliothèque Clovis`,
    description: entree.description || `Document partagé sur la bibliothèque publique de Clovis : ${entree.nom}.`,
    openGraph: {
      title: entree.nom,
      description: entree.description || undefined,
      type: "article",
    },
  };
}

function Etiquette({ valeur }: { valeur: string | null | undefined }) {
  if (!valeur) return null;
  return (
    <span className="rounded-full border border-dj-bordure bg-dj-surface-haute px-2.5 py-1 text-xs text-dj-texte-muet">
      {valeur}
    </span>
  );
}

export default async function PageEntreeBibliothequePublique({ params }: { params: { id: string } }) {
  const entree = await chargerEntree(params.id);

  if (!entree) {
    return (
      <SectionPage title="Document introuvable">
        <p className="rounded-xl border border-dashed border-dj-bordure px-3 py-4 text-center text-xs text-dj-texte-muet">
          Ce document est introuvable, ou n'est plus publié sur la bibliothèque publique.
        </p>
      </SectionPage>
    );
  }

  const estPdf = entree.type_mime === "application/pdf";

  return (
    <SectionPage title={entree.nom}>
      <section className="rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText size={18} className="flex-shrink-0 text-dj-accent-1" />
            <h2 className="font-display text-base font-semibold text-dj-texte">{entree.nom}</h2>
          </div>
          {entree.url_publique && (
            <BoutonTelechargerFichier url={entree.url_publique} nom={entree.nom_fichier || entree.nom} />
          )}
        </div>

        {entree.description && <p className="mt-2 text-sm text-dj-texte-muet">{entree.description}</p>}

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Etiquette valeur={entree.pays} />
          <Etiquette valeur={entree.niveau} />
          <Etiquette valeur={entree.categorie} />
          <Etiquette valeur={entree.classe} />
          <Etiquette valeur={entree.specialite} />
        </div>
      </section>

      {estPdf && entree.url_publique && (
        <section className="h-[70vh] overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface">
          <VisionneurPdf url={entree.url_publique} />
        </section>
      )}
    </SectionPage>
  );
}
