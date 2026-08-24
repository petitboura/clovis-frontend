"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { lireContenuLegal, type ContenuLegal } from "@/lib/api";
import { Logo } from "@/components/Logo";
import { Skeleton } from "@/components/Skeleton";

// Pages publiques /cgu et /copyright (22/08, chantier "rendre la
// bibliothèque plus sérieuse", guide Notion "Guide pour droit
// d'auteur"). Hors du groupe (app) volontairement : accessibles sans
// compte ni chrome applicatif, un ayant droit externe qui consulte la
// politique de copyright n'a aucune raison d'être connecté.
export function PageContenuLegal({ cle }: { cle: "cgu" | "copyright" }) {
  const [contenu, setContenu] = useState<ContenuLegal | null | undefined>(undefined);

  useEffect(() => {
    lireContenuLegal(cle)
      .then(setContenu)
      .catch(() => setContenu(null));
  }, [cle]);

  return (
    <div className="min-h-screen bg-dj-fond px-4 py-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <Link href="/">
          <Logo taille={28} />
        </Link>

        {contenu === undefined && (
          <div className="flex flex-col gap-2" aria-hidden>
            <Skeleton className="h-6 w-1/2 rounded-lg" />
            <Skeleton className="h-32 rounded-xl" />
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
    </div>
  );
}
