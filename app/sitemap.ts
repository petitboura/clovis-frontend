import type { MetadataRoute } from "next";
import {
  listerBibliothequePublique,
  rechercherComportementsPublics,
  listerEtablissementsPublics,
  listerDossiersCataloguePublic,
} from "@/lib/api";

// Chantier "Clovis ouvert" (10/09/2026, Lot F, dernier lot -- transverse
// aux quatre précédents). Un seul fichier suffit : même avec 500+ PDF,
// le nombre total d'URLs reste très en dessous des 50 000 entrées
// qu'accepte un sitemap (au-delà, Next.js permettrait de le découper via
// generateSitemaps, inutile ici). Route générée par Next.js à l'adresse
// /sitemap.xml.
//
// NOTE POUR BOURAMA : la bibliothèque publique (Lot A) et les
// établissements (Lot C) n'ont pas de plafond côté backend, tout est
// listé ici. Les skills publiques (Lot B) sont, elles, plafonnées à 100
// résultats par GET /api/comportements-publics (core/comportements_etudiants.py,
// lister_comportements_publics, `.limit(100)`, pas de decalage/limite
// exposés) -- ce sitemap ne peut donc lister que les 100 skills les plus
// activées, pas au-delà, tant que cet endpoint n'a pas de pagination
// comme la bibliothèque. Pas touché ici (hors périmètre du lot), je le
// signale seulement.
const URL_BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function urlsBibliothequePublique(): Promise<MetadataRoute.Sitemap> {
  const urls: MetadataRoute.Sitemap = [];
  const LIMITE_PAGE = 200;
  let decalage = 0;
  // Pagination complète (Lot A expose decalage/limite pour ça, voir
  // listerBibliothequePublique) : on avance tant qu'une page renvoie son
  // plein, on s'arrête à la première page incomplète ou vide.
  for (;;) {
    let page: Awaited<ReturnType<typeof listerBibliothequePublique>>;
    try {
      page = await listerBibliothequePublique(undefined, { decalage, limite: LIMITE_PAGE });
    } catch {
      break;
    }
    for (const entree of page) {
      urls.push({ url: `${URL_BASE}/bibliotheque/${entree.id}` });
    }
    if (page.length < LIMITE_PAGE) break;
    decalage += LIMITE_PAGE;
  }
  return urls;
}

async function urlsSkillsPubliques(): Promise<MetadataRoute.Sitemap> {
  try {
    const skills = await rechercherComportementsPublics();
    return skills.map((skill) => ({ url: `${URL_BASE}/skills/${skill.id}` }));
  } catch {
    return [];
  }
}

async function urlsEtablissements(): Promise<MetadataRoute.Sitemap> {
  try {
    const etablissements = await listerEtablissementsPublics();
    return etablissements.map((etablissement) => ({ url: `${URL_BASE}/etablissements/${etablissement.id}` }));
  } catch {
    return [];
  }
}

async function urlsDossiers(): Promise<MetadataRoute.Sitemap> {
  try {
    const dossiers = await listerDossiersCataloguePublic();
    return dossiers.map((dossier) => ({ url: `${URL_BASE}/dossiers/${dossier.id}` }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [bibliotheque, skills, etablissements, dossiers] = await Promise.all([
    urlsBibliothequePublique(),
    urlsSkillsPubliques(),
    urlsEtablissements(),
    urlsDossiers(),
  ]);

  return [
    { url: URL_BASE, priority: 1 },
    { url: `${URL_BASE}/bibliotheque` },
    { url: `${URL_BASE}/comportements` },
    { url: `${URL_BASE}/etablissements` },
    ...bibliotheque,
    ...skills,
    ...etablissements,
    ...dossiers,
  ];
}
