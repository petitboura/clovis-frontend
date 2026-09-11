import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { ScrollText } from "lucide-react";
import { SectionPage } from "@/components/SectionPage";
import { ActionsSkillPublic } from "@/components/ActionsSkillPublic";
import { extraireCorpsSkill } from "@/components/VoirSkillRecuModal";
import { obtenirComportementPublic, type ComportementPublic } from "@/lib/api";
import { ErreurApi } from "@/lib/erreurs";

// Chantier "Clovis ouvert" (10/09/2026, Lot B, même principe que le
// Lot A bibliothèque publique) : chaque skill publique retrouvable par
// son nom, indexable, avec sa propre URL. Server Component pour
// generateMetadata + premier rendu HTML non vide (les robots ne voient
// rien d'une page purement "use client").
//
// generateStaticParams renvoie un id factice ("placeholder"), jamais un
// tableau vide : voir le commentaire détaillé dans
// app/(app)/bibliotheque/[id]/page.tsx (bug Next.js vercel/next.js#61213
// et #71862, un tableau vide fait échouer le build:capacitor) -- même
// raisonnement ici, l'app mobile affiche déjà les skills via
// ComportementsPublics.tsx, jamais par cette URL.
export async function generateStaticParams() {
  return [{ id: "placeholder" }];
}

async function chargerSkill(id: string): Promise<ComportementPublic | null> {
  // Voir chargerEntree dans app/(app)/bibliotheque/[id]/page.tsx : même
  // raisonnement, l'id "placeholder" ne doit jamais taper le backend.
  if (id === "placeholder") return null;
  try {
    return await obtenirComportementPublic(id);
  } catch (e) {
    if (e instanceof ErreurApi && e.statusCode === 404) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const skill = await chargerSkill(params.id);
  if (!skill) {
    return { title: "Skill introuvable · Skills Clovis" };
  }
  return {
    title: `${skill.nom} · Skills Clovis`,
    description: skill.description || `Skill publique partagée sur Clovis : ${skill.nom}.`,
    openGraph: {
      title: skill.nom,
      description: skill.description || undefined,
      type: "article",
    },
  };
}

export default async function PageSkillPublique({ params }: { params: { id: string } }) {
  const skill = await chargerSkill(params.id);

  if (!skill) {
    return (
      <SectionPage title="Skill introuvable">
        <p className="rounded-xl border border-dashed border-dj-bordure px-3 py-4 text-center text-xs text-dj-texte-muet">
          Cette skill est introuvable, ou a été retirée par son auteur.
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
        <p className="mt-2 text-xs text-dj-texte-muet">
          {skill.activations_count} activation{skill.activations_count > 1 ? "s" : ""}
        </p>

        <div className="mt-4">
          <ActionsSkillPublic skill={skill} />
        </div>
      </section>

      <section className="rounded-cgpt-carte border border-dj-bordure bg-dj-surface-haute px-5 py-4">
        <div className="dj-markdown [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 last:[&_p]:mb-0 [&_hr]:my-4 [&_hr]:border-dj-bordure [&_strong]:text-dj-texte [&_h1]:font-lecture [&_h1]:font-semibold [&_h1]:tracking-[-0.01em] [&_h1]:text-dj-texte [&_h1]:text-xl [&_h1]:mb-2 [&_h1]:mt-3 [&_h2]:font-lecture [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:text-dj-texte [&_h2]:text-lg [&_h2]:mb-2 [&_h2]:mt-3 [&_h3]:font-lecture [&_h3]:font-semibold [&_h3]:tracking-[-0.01em] [&_h3]:text-dj-texte [&_h3]:text-base [&_h3]:mb-1.5 [&_h3]:mt-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeSanitize, defaultSchema]]}>
            {extraireCorpsSkill(skill.skill_md || skill.texte)}
          </ReactMarkdown>
        </div>
      </section>
    </SectionPage>
  );
}
