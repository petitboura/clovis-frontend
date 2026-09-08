"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck, Clock } from "lucide-react";
import {
  obtenirMesCascadesSupervision,
  resoudreCascadeSupervision,
  type CascadeSupervision,
} from "@/lib/api";
import { messageErreur, ErreurApi } from "@/lib/erreurs";
import { BoutonInfoSection } from "./BoutonInfoSection";
import { dateRelative } from "@/lib/dateRelative";

/**
 * Cascade de supervision (Point 6, Partie 10, 07/09/2026, dernière
 * partie du chantier "confiance pédagogique"). N'affiche que les
 * signalements de type B (comportement général mal configuré) : c'est
 * le seul endroit de l'app où ce contenu est consultable (voir la note
 * en tête de ListeCorrectionsProf.tsx, dédiée entièrement à ce
 * composant).
 *
 * Rien à afficher tant qu'aucune cascade n'est active (pas de squelette
 * permanent ni de carte vide) : contrairement à l'audit hebdomadaire,
 * cet indicateur n'a de sens que quand il y a effectivement quelque
 * chose à traiter.
 */
export function IndicateurCascadeSupervision() {
  const [cascades, setCascades] = useState<CascadeSupervision[] | undefined>(undefined);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [notesParCascade, setNotesParCascade] = useState<Record<string, string>>({});

  useEffect(() => {
    obtenirMesCascadesSupervision()
      .then(setCascades)
      .catch((e) => {
        if (!(e instanceof ErreurApi && e.statusCode === 401)) {
          setErreur(messageErreur(e));
        }
      });
  }, []);

  async function resoudre(cascadeId: string) {
    setEnCours(cascadeId);
    try {
      await resoudreCascadeSupervision(cascadeId, notesParCascade[cascadeId]);
      setCascades((prev) => (prev ? prev.filter((c) => c.id !== cascadeId) : prev));
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(null);
    }
  }

  if (erreur) return <p className="text-sm text-dj-texte-muet">{erreur}</p>;
  if (!cascades) return null;

  const actives = cascades.filter((c) => c.statut !== "resolu");
  if (actives.length === 0) return null;

  return (
    <div className="flex animate-dj-fade-in-rapide flex-col gap-3 rounded-xl border border-dj-accent-1/40 bg-dj-surface p-4">
      <div className="flex items-center gap-2">
        <ShieldAlert size={18} className="text-dj-accent-1" />
        <h2 className="text-sm font-medium text-dj-texte">Supervision en cours</h2>
        <BoutonInfoSection
          rubriqueId="cascade-supervision"
          texteCourt="Plusieurs élèves ont signalé le même comportement mal configuré. La règle en cause a été désactivée automatiquement le temps d'y regarder."
        />
      </div>

      {actives.map((c) => (
        <div key={c.id} className="flex flex-col gap-2 rounded-lg bg-dj-surface-haute/60 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-dj-texte">
              {c.compteur_signalements} signalement(s) similaire(s)
              {c.neutralisee_le && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-dj-texte-muet">
                  <ShieldCheck size={12} /> règle désactivée
                </span>
              )}
            </p>
            <span className="flex items-center gap-1 text-[11px] text-dj-texte-muet">
              <Clock size={11} />
              {c.statut === "j2_prof" && "en attente de ta réponse"}
              {c.statut === "j5_etablissement" && "établissement notifié"}
              {c.statut === "equipe_clovis" && "équipe Clovis notifiée"}
            </span>
          </div>

          {c.signalements.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {c.signalements.map((s, i) => (
                <div key={i} className="rounded-md bg-dj-fond/60 px-2.5 py-1.5">
                  <p className="text-xs text-dj-texte">{s.question_texte}</p>
                  {s.created_at && <p className="mt-0.5 text-[10px] text-dj-texte-muet">{dateRelative(s.created_at)}</p>}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={notesParCascade[c.id] || ""}
              onChange={(e) => setNotesParCascade((prev) => ({ ...prev, [c.id]: e.target.value }))}
              placeholder="Note optionnelle (ce que tu as corrigé)"
              className="flex-1 rounded-md border border-dj-bordure bg-dj-fond px-2.5 py-1.5 text-xs text-dj-texte placeholder:text-dj-texte-muet focus:outline-none focus:ring-1 focus:ring-dj-accent-1"
            />
            <button
              onClick={() => resoudre(c.id)}
              disabled={enCours === c.id}
              className="whitespace-nowrap rounded-md bg-dj-accent-1 px-3 py-1.5 text-xs font-medium text-dj-fond transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {enCours === c.id ? "..." : "Marquer résolu"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
