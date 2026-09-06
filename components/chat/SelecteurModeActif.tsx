"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import {
  listerMesRattachementsCodes,
  obtenirModeActif,
  definirModeActif,
  type RattachementCode,
} from "@/lib/api";
import { Skeleton } from "../Skeleton";

/**
 * Sélecteur de mode actif (Partie 6, plan confiance pédagogique,
 * 06/09/2026, demande Bourama -- voir Point 3). Un utilisateur peut
 * avoir plusieurs codes rattachés en même temps (voir EspaceEntrerCode)
 * -- ce composant lui permet de choisir librement lequel s'applique à
 * la conversation en cours, avec indication permanente. Rien à afficher
 * s'il n'a aucun rattachement (rien à choisir).
 *
 * Placement (emplacement précisé dans la discussion de vision) : en
 * haut du chat sur mobile (position fixe, à droite du hamburger tiroir
 * qui occupe déjà la gauche -- voir AppSidebar.tsx), près de la barre
 * de saisie sur PC. Un seul composant, deux habillages CSS responsive
 * partageant le même état -- pas de double appel réseau.
 */
export function SelecteurModeActif({ conversationId }: { conversationId: string }) {
  const [rattachements, setRattachements] = useState<RattachementCode[]>([]);
  const [modeActifId, setModeActifId] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [ouvert, setOuvert] = useState(false);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    Promise.all([listerMesRattachementsCodes(), obtenirModeActif(conversationId)])
      .then(([rat, mode]) => {
        if (annule) return;
        setRattachements(rat);
        setModeActifId(mode.rattachement_id);
      })
      .catch(() => {
        // Silencieux (03/09, convention déjà en place pour le contenu
        // accessoire du chat) : l'absence de sélecteur ne doit jamais
        // bloquer la conversation elle-même.
      })
      .finally(() => !annule && setChargement(false));
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  async function choisir(rattachementId: string | null) {
    setOuvert(false);
    if (rattachementId === modeActifId) return;
    setEnCours(true);
    const precedent = modeActifId;
    setModeActifId(rattachementId); // optimiste, transition immédiate
    try {
      await definirModeActif(conversationId, rattachementId);
    } catch {
      setModeActifId(precedent); // échec silencieux -- reprend l'affichage précédent
    } finally {
      setEnCours(false);
    }
  }

  if (chargement) {
    return null; // évite un flash de squelette pour un élément aussi compact et périphérique
  }

  if (rattachements.length === 0) {
    return null;
  }

  const actif = rattachements.find((r) => r.rattachement_id === modeActifId) ?? null;
  const libelle = actif ? actif.nom_code || actif.code : "Choisir un mode";

  const pilule = (
    <div className="relative">
      <button
        onClick={() => setOuvert((v) => !v)}
        disabled={enCours}
        className={`flex items-center gap-1.5 rounded-full border border-dj-bordure bg-dj-surface px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors disabled:opacity-60 ${
          actif ? "text-dj-texte" : "text-dj-texte-muet"
        } hover:bg-dj-surface-haute`}
      >
        <span key={libelle} className="max-w-[9rem] truncate animate-dj-fade-in-rapide">
          {libelle}
        </span>
        <ChevronDown size={12} className={`flex-shrink-0 transition-transform duration-200 ${ouvert ? "rotate-180" : ""}`} />
      </button>

      {ouvert && (
        <div className="dj-scroll-isole absolute right-0 top-9 z-10 max-h-64 w-56 animate-dj-fade-in-rapide overflow-y-auto rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-1 shadow-lg">
          {rattachements.map((r) => (
            <button
              key={r.rattachement_id}
              onClick={() => choisir(r.rattachement_id)}
              className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-sm text-dj-texte transition-colors hover:bg-dj-surface-haute"
            >
              <span className="min-w-0">
                <span className="block truncate">{r.nom_code || r.code}</span>
                <span className="block truncate text-xs text-dj-texte-muet">Reçu de {r.proprietaire_nom}</span>
              </span>
              {r.rattachement_id === modeActifId && <Check size={14} className="flex-shrink-0 text-dj-accent-1-texte" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile : position fixe en haut, à droite (le hamburger tiroir
          occupe déjà la gauche à la même hauteur, voir AppSidebar.tsx). */}
      <div className="fixed right-2 top-[calc(0.5rem+var(--safe-top,0px))] z-40 md:hidden">{pilule}</div>

      {/* PC : juste au-dessus de la barre de saisie, alignée à droite. */}
      <div className="mb-2 hidden justify-end md:flex">{pilule}</div>
    </>
  );
}
