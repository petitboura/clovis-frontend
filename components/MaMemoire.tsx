"use client";

import { useEffect, useState } from "react";
import { appelerApi } from "@/lib/api";
import { messageErreur, ErreurApi } from "@/lib/erreurs";
import { Skeleton } from "./Skeleton";
import { CTACompteRequis } from "./CTACompteRequis";

/**
 * Extrait de app/dashboard/memoire/page.tsx (2026-08-01, demande Bourama :
 * "ajoute un champ mémoire qui était dans mon espace, dans mon espace" --
 * remis en tant qu'onglet de la nouvelle page /dashboard/espace, en plus
 * de la page /dashboard/memoire elle-même qui reste accessible telle
 * quelle). Même logique, juste sans son propre TopBar/header (déjà fournis
 * par la page qui l'utilise).
 */
export function MaMemoire() {
  const [resume, setResume] = useState("");
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  // Visiteur sans compte (refonte "Mon espace = l'app", cette section
  // n'avait jamais eu à le gérer avant) -- même détection que
  // MesComportements.tsx : 401 -> CTA plutôt qu'une erreur brute.
  const [sansCompte, setSansCompte] = useState(false);

  useEffect(() => {
    appelerApi("/api/memoire")
      .then((r: { resume: string }) => setResume(r.resume || ""))
      .catch((e) => {
        if (e instanceof ErreurApi && e.statusCode === 401) {
          setSansCompte(true);
        } else {
          setErreur(messageErreur(e));
        }
      })
      .finally(() => setChargement(false));
  }, []);

  async function enregistrer() {
    setEnregistrement(true);
    setErreur(null);
    setMessage(null);
    try {
      await appelerApi("/api/memoire", {
        method: "PATCH",
        body: JSON.stringify({ resume }),
      });
      setMessage("Mémoire enregistrée.");
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnregistrement(false);
    }
  }

  async function toutOublier() {
    if (
      !window.confirm(
        "Effacer toute ta mémoire ? Clovis oubliera tout ce qu'il a retenu de tes échanges passés. Cette action est irréversible."
      )
    )
      return;
    setEnregistrement(true);
    setErreur(null);
    try {
      await appelerApi("/api/memoire", { method: "DELETE" });
      setResume("");
      setMessage("Mémoire effacée.");
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnregistrement(false);
    }
  }

  if (sansCompte) {
    return <CTACompteRequis texte="Crée un compte pour que Clovis se souvienne de vos échanges." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-dj-texte-muet">
        Résumé de ce que Clovis retient de tes conversations passées, pour personnaliser vos
        échanges. Se met à jour automatiquement au fil des discussions, tu peux aussi le corriger
        ou l&apos;effacer toi-même ici.
      </p>

      {/* Skeleton précis (30/08, ré-analyse minutieuse demandée par
          Bourama) : le vrai contenu n'est PAS du texte de paragraphe nu --
          c'est une carte à bordure contenant une zone de texte éditable
          (textarea, 10 lignes) et 2 boutons en dessous. Correctif suite
          retour Bourama : le premier essai remplissait la zone d'un seul
          bloc plein uniforme -- ça ne représentait pas le texte qui sera
          réellement écrit à l'intérieur. Ici, de vraies lignes de largeurs
          variables DANS la zone bordée qui a exactement le style de la
          vraie textarea (rounded-lg border bg-dj-surface-haute px-3 py-2). */}
      {chargement && (
        <div className="flex flex-col gap-4 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-6" aria-hidden>
          <div className="flex flex-col gap-2 rounded-lg border border-dj-bordure bg-dj-surface-haute px-3 py-2">
            {[100, 96, 88, 60, 100, 92, 84, 40].map((largeur, i) => (
              <Skeleton
                key={i}
                className="h-3.5 rounded"
                style={{ width: `${largeur}%`, animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-9 w-28 rounded-cgpt-bouton" style={{ animationDelay: "500ms" }} />
            <Skeleton className="h-9 w-32 rounded-cgpt-bouton" style={{ animationDelay: "580ms" }} />
          </div>
        </div>
      )}

      {!chargement && (
        <div className="flex flex-col gap-4 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-6">
          <textarea
            value={resume}
            onChange={(e) => setResume(e.target.value)}
            rows={10}
            placeholder="Rien d'enregistré pour l'instant, ça se remplit tout seul au fil de tes conversations."
            className="w-full resize-y rounded-lg border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={enregistrer}
              disabled={enregistrement}
              className="rounded-cgpt-bouton bg-dj-accent-1 px-5 py-2 text-sm font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
            >
              {enregistrement ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              onClick={toutOublier}
              disabled={enregistrement}
              className="rounded-cgpt-bouton border border-[var(--dj-erreur)] px-5 py-2 text-sm text-[var(--dj-erreur)] transition-colors hover:bg-[var(--dj-erreur)]/10 disabled:opacity-50"
            >
              Tout oublier
            </button>
            {message && <span className="text-sm text-dj-texte-muet">{message}</span>}
          </div>
          {erreur && <p className="text-sm text-[var(--dj-erreur)]">{erreur}</p>}
        </div>
      )}
    </div>
  );
}
