"use client";

import { useState } from "react";
import { Download, Check, Loader2, ScrollText } from "lucide-react";
import { activerComportementPublic, type ComportementPublic } from "@/lib/api";
import { messageErreur, ErreurApi } from "@/lib/erreurs";
import { telechargerTexte, nomFichierDepuis } from "@/lib/telechargerTexte";
import { CTACompteRequis } from "@/components/CTACompteRequis";
import { ButtonPartager, lienPartage } from "@/components/ButtonPartager";

// Client Component isolé (10/09/2026, Lot B "Clovis ouvert") : la page
// /skills/[id] elle-même est un Server Component (pour generateMetadata),
// mais "Activer" et "Télécharger" ont besoin d'état (chargement, session
// Supabase) -- donc extraits ici, même pattern que ComportementsPublics.tsx
// dont ce composant reprend le comportement (activation gatée par un
// compte, téléchargement en Blob local sans appel réseau).
export function ActionsSkillPublic({ skill }: { skill: ComportementPublic }) {
  const [activationEnCours, setActivationEnCours] = useState(false);
  const [active, setActive] = useState(false);
  const [sansCompte, setSansCompte] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function activer() {
    if (activationEnCours || active) return;
    setActivationEnCours(true);
    setErreur(null);
    try {
      await activerComportementPublic(skill.id);
      setActive(true);
    } catch (e) {
      if (e instanceof ErreurApi && e.statusCode === 401) {
        setSansCompte(true);
      } else {
        setErreur(messageErreur(e));
      }
    } finally {
      setActivationEnCours(false);
    }
  }

  function telecharger() {
    telechargerTexte(nomFichierDepuis(skill.nom, "md"), skill.skill_md || skill.texte);
  }

  if (sansCompte) {
    return <CTACompteRequis texte="Crée un compte pour activer ce skill sur ton propre espace Clovis." />;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={activer}
          disabled={activationEnCours || active}
          className="flex items-center gap-1.5 rounded-cgpt-bouton bg-dj-accent-1 px-4 py-2 text-sm font-semibold text-[#1a0f06] transition-colors duration-200 ease-cgpt-doux hover:bg-dj-accent-2 disabled:pointer-events-none disabled:opacity-70"
        >
          {activationEnCours ? (
            <Loader2 size={15} className="animate-spin" />
          ) : active ? (
            <Check size={15} />
          ) : (
            <ScrollText size={15} />
          )}
          {active ? "Activé" : "Activer ce skill"}
        </button>
        <button
          onClick={telecharger}
          className="flex items-center gap-1.5 rounded-cgpt-bouton border border-dj-bordure bg-dj-surface-haute px-4 py-2 text-sm font-semibold text-dj-texte transition-colors duration-200 ease-cgpt-doux hover:border-dj-bordure-forte"
        >
          <Download size={15} />
          Télécharger (.md)
        </button>
        <ButtonPartager lien={lienPartage("skill-public", skill.id)} titre={skill.nom} />
      </div>
      {erreur && <p className="text-sm text-[var(--dj-erreur)]">{erreur}</p>}
    </div>
  );
}
