"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { ScrollText } from "lucide-react";
import { SectionPage } from "@/components/SectionPage";
import { CTACompteRequis } from "@/components/CTACompteRequis";
import { Skeleton } from "@/components/Skeleton";
import { extraireCorpsSkill } from "@/components/VoirSkillRecuModal";
import { obtenirComportementConsultation, type ComportementConsultation } from "@/lib/api";
import { ErreurApi, messageErreur } from "@/lib/erreurs";

// Même agent générique que MesComportements.tsx (app/(app)/comportements/page.tsx).
const AGENT_ID = "clovis";

/**
 * 11/09/2026, demande Bourama : lien de partage direct pour un skill
 * PERSO, lecture seule, même affichage que la version publique
 * (app/(app)/skills/[id]/page.tsx), compte obligatoire pour consulter.
 * Aucune action automatique, aucun nouveau bouton : contrairement à la
 * version publique il n'y a pas d'ActionsSkillPublic ici (pas
 * d'équivalent "activer" pour un skill perso reçu par lien).
 *
 * Extrait en composant client séparé de sa page, même raisonnement que
 * ConsultationFichierBibliothequePerso.tsx (contrainte generateStaticParams
 * / build:capacitor).
 */
export function ConsultationSkillPerso({ id }: { id: string }) {
  const [skill, setSkill] = useState<ComportementConsultation | null | undefined>(undefined);
  const [sansCompte, setSansCompte] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (id === "placeholder") {
      setSkill(null);
      return;
    }
    obtenirComportementConsultation(AGENT_ID, id)
      .then(setSkill)
      .catch((e) => {
        if (e instanceof ErreurApi && e.statusCode === 401) {
          setSansCompte(true);
        } else if (e instanceof ErreurApi && e.statusCode === 404) {
          setSkill(null);
        } else {
          setErreur(messageErreur(e));
        }
      });
  }, [id]);

  if (sansCompte) {
    return (
      <SectionPage title="Skill partagée">
        <CTACompteRequis texte="Crée un compte pour consulter cette skill." />
      </SectionPage>
    );
  }

  if (erreur) {
    return (
      <SectionPage title="Skill partagée">
        <p className="rounded-xl border border-dashed border-dj-bordure px-3 py-4 text-center text-xs text-dj-texte-muet">{erreur}</p>
      </SectionPage>
    );
  }

  if (skill === undefined) {
    return (
      <SectionPage title="Skill partagée">
        <Skeleton className="h-32 w-full rounded-cgpt-carte" />
      </SectionPage>
    );
  }

  if (skill === null) {
    return (
      <SectionPage title="Skill introuvable">
        <p className="rounded-xl border border-dashed border-dj-bordure px-3 py-4 text-center text-xs text-dj-texte-muet">
          Cette skill est introuvable, ou a été supprimée par son propriétaire.
        </p>
      </SectionPage>
    );
  }

  return (
    <SectionPage title={skill.nom}>
      <section className="rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-5">
        <div className="flex items-center gap-2">
          <ScrollText size={18} className="flex-shrink-0 text-dj-accent-1" />
          <h2 className="font-display text-base font-semibold text-dj-texte">{skill.nom}</h2>
        </div>
        {skill.description && <p className="mt-2 text-sm text-dj-texte-muet">{skill.description}</p>}
      </section>

      <section className="rounded-cgpt-carte border border-dj-bordure bg-dj-surface-haute px-5 py-4">
        <div className="dj-markdown [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 last:[&_p]:mb-0 [&_hr]:my-4 [&_hr]:border-dj-bordure [&_strong]:text-dj-texte [&_h1]:font-lecture [&_h1]:font-semibold [&_h1]:tracking-[-0.01em] [&_h1]:text-dj-texte [&_h1]:text-xl [&_h1]:mb-2 [&_h1]:mt-3 [&_h2]:font-lecture [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:text-dj-texte [&_h2]:text-lg [&_h2]:mb-2 [&_h2]:mt-3 [&_h3]:font-lecture [&_h3]:font-semibold [&_h3]:tracking-[-0.01em] [&_h3]:text-dj-texte [&_h3]:text-base [&_h3]:mb-1.5 [&_h3]:mt-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeSanitize, defaultSchema]]}>
            {extraireCorpsSkill(skill.skill_md)}
          </ReactMarkdown>
        </div>
      </section>
    </SectionPage>
  );
}
