import type { MetadataRoute } from "next";

// Chantier "Clovis ouvert" (10/09/2026, Lot F). N'existait pas du tout
// avant ce chantier -- sans lui, un moteur de recherche n'a même pas le
// droit implicite de venir lire /sitemap.xml en confiance.
//
// Interdits : les écrans "espace personnel" (chat, bureau, réglages...)
// -- aucun contenu SEO à y gagner (pages purement "use client", un robot
// n'y verrait qu'une coquille vide) et ce n'est pas un espace public.
// Le reste (accueil, bibliothèque, skills, établissements, dossiers, et
// toutes leurs pages de détail des lots A à E) reste autorisé.
const URL_BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/chat",
        "/bureau",
        "/parametres",
        "/personnaliser",
        "/plus",
        "/rappels",
        "/memoire",
        "/connecter-claude",
        "/controle-session",
      ],
    },
    sitemap: `${URL_BASE}/sitemap.xml`,
  };
}
