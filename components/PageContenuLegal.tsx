"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { lireContenuLegal, type ContenuLegal } from "@/lib/api";
import { Logo } from "@/components/Logo";
import { Skeleton } from "@/components/Skeleton";
import { BoutonRetour } from "@/components/BoutonRetour";
import { EcranAutonome } from "@/components/EcranAutonome";

// Pages publiques /cgu et /copyright (22/08, chantier "rendre la
// bibliothèque plus sérieuse", guide Notion "Guide pour droit
// d'auteur"). Hors du groupe (app) volontairement : accessibles sans
// compte ni chrome applicatif, un ayant droit externe qui consulte la
// politique de copyright n'a aucune raison d'être connecté.
//
// CORRECTIF (29/08, audit boutons retour) : ces pages sont AUSSI
// ouvertes depuis Paramètres -> À propos (router.push("/cgu"), voir
// EspaceParametres.tsx) par un utilisateur connecté -- avant ce
// correctif, seul le logo (-> accueil) permettait de "revenir", ce qui
// faisait perdre tout chemin retour vers Paramètres. router.back()
// choisi plutôt qu'un href fixe vers /parametres : cette page est
// atteignable aussi bien depuis l'app (Paramètres) que depuis
// l'extérieur (lien direct, site vitrine) -- router.back() ramène
// correctement dans les deux cas vers l'écran d'origine, sans supposer
// lequel des deux c'est.
export function PageContenuLegal({ cle }: { cle: "cgu" | "copyright" }) {
  const router = useRouter();
  const [contenu, setContenu] = useState<ContenuLegal | null | undefined>(undefined);

  useEffect(() => {
    lireContenuLegal(cle)
      .then(setContenu)
      .catch(() => setContenu(null));
  }, [cle]);

  return (
    <EcranAutonome className="min-h-screen bg-dj-fond px-4 py-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-center gap-2">
          <BoutonRetour onClick={() => router.back()} padding="p-1" className="-ml-1" />
          <Link href="/">
            <Logo taille={28} />
          </Link>
        </div>

        {contenu === undefined && (
          <div className="flex flex-col gap-3" aria-hidden>
            <Skeleton className="h-6 w-1/2 rounded-lg" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-full rounded" />
              <Skeleton className="h-3.5 w-11/12 rounded" />
              <Skeleton className="h-3.5 w-2/3 rounded" />
            </div>
            <Skeleton className="mt-2 h-4 w-1/3 rounded" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-full rounded" />
              <Skeleton className="h-3.5 w-full rounded" />
              <Skeleton className="h-3.5 w-3/4 rounded" />
            </div>
            <Skeleton className="mt-2 h-4 w-1/4 rounded" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-full rounded" />
              <Skeleton className="h-3.5 w-5/6 rounded" />
              <Skeleton className="h-3.5 w-1/2 rounded" />
            </div>
          </div>
        )}
        {contenu === null && <p className="text-sm text-dj-texte-muet">Ce contenu n&apos;est pas disponible pour l&apos;instant.</p>}
        {contenu && (
          <article className="flex flex-col gap-3">
            <h1 className="text-xl font-semibold text-dj-texte">{contenu.titre}</h1>
            <div className="flex flex-col gap-3 text-sm leading-relaxed text-dj-texte-muet">
              <ReactMarkdown
                components={{
                  h2: ({ children }) => <h2 className="mt-2 text-base font-semibold text-dj-texte">{children}</h2>,
                  p: ({ children }) => <p>{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-5">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-5">{children}</ol>,
                  li: ({ children }) => <li>{children}</li>,
                  a: ({ href, children }) => (
                    <Link href={href || "#"} className="text-dj-texte-muet hover:text-dj-texte hover:underline">
                      {children}
                    </Link>
                  ),
                }}
              >
                {contenu.contenu_markdown}
              </ReactMarkdown>
            </div>
          </article>
        )}
      </div>
    </EcranAutonome>
  );
}
