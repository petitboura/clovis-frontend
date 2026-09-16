"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";
import { BoutonRetour } from "./BoutonRetour";
import { BoutonInfoSection } from "./BoutonInfoSection";
import { trouverRubriqueAide } from "@/lib/aideSections";

const ContexteInfoSection = createContext<(id: string | null) => void>(() => {});

export function useInfoSection(id: string | null) {
  const definir = useContext(ContexteInfoSection);
  useEffect(() => {
    definir(id);
    return () => definir(null);
  }, [definir, id]);
}

function TitreSection({ title, infoRubriqueId, className }: { title: string; infoRubriqueId: string | null; className?: string }) {
  const rubrique = infoRubriqueId ? trouverRubriqueAide(infoRubriqueId) : undefined;
  return (
    <div className={`flex items-center gap-1.5 ${className ?? ""}`}>
      <h1 className="font-display text-xl font-bold text-dj-texte">{title}</h1>
      {rubrique && <BoutonInfoSection rubriqueId={rubrique.id} texteCourt={rubrique.texteCourt} />}
    </div>
  );
}

export function SectionPage({
  title,
  children,
  groupe,
}: {
  title: string;
  children: React.ReactNode;
  groupe?: {
    label: string;
    href: string;
    soeurs: { href: string; label: string; icone: React.ReactNode }[];
  };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [infoRubriqueId, setInfoRubriqueId] = useState<string | null>(null);

  if (!groupe) {
    return (
      <ContexteInfoSection.Provider value={setInfoRubriqueId}>
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-24 pt-6 md:pt-8">
          <div className="flex items-center gap-2">
            <BoutonRetour onClick={() => router.back()} />
            <TitreSection title={title} infoRubriqueId={infoRubriqueId} />
          </div>
          {children}
        </div>
      </ContexteInfoSection.Provider>
    );
  }

  return (
    <ContexteInfoSection.Provider value={setInfoRubriqueId}>
      <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 md:pt-8">
        <div className="mb-1 flex items-center gap-1.5 text-sm text-dj-texte-muet">
          <BoutonRetour href={groupe.href} padding="p-0.5" className="-ml-0.5" />
          <Link href={groupe.href} className="transition-colors hover:text-dj-texte">
            {groupe.label}
          </Link>
          <ChevronRight size={14} className="flex-shrink-0" />
          <span className="text-dj-texte">{title}</span>
        </div>
        <TitreSection title={title} infoRubriqueId={infoRubriqueId} className="mb-4" />

        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <nav className="hidden w-48 flex-shrink-0 flex-col gap-1 md:flex">
            {groupe.soeurs.map((s) => {
              const actif = pathname === s.href;
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${
                    actif
                      ? "bg-dj-surface-haute font-medium text-dj-texte"
                      : "text-dj-texte-muet hover:bg-dj-surface-haute hover:text-dj-texte"
                  }`}
                >
                  {s.icone}
                  {s.label}
                </Link>
              );
            })}
          </nav>
          <div className="min-w-0 flex-1 space-y-4">{children}</div>
        </div>
      </div>
    </ContexteInfoSection.Provider>
  );
}
