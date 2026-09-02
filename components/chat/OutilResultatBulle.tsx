"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Wrench, Link2 } from "lucide-react";
import { useOutilsRegistre } from "@/lib/outils";
import { SourcesBulle } from "./SourcesBulle";

// Affiche, pour CHAQUE outil utilisé, ce qu'il a concrètement exécuté /
// retourné -- dans sa propre section, avec l'icône de cet outil précis,
// dans l'ORDRE CHRONOLOGIQUE réel des appels (26/07, retour Bourama :
// avant, tout était regroupé par catégorie -- tout le raisonnement, PUIS
// tous les résultats d'outils, PUIS toutes les sources en bloc à la fin
// -- ça ne reflétait pas l'ordre réel "lit un fichier -> résultat ->
// recherche -> résultat -> sources -> génère un PDF -> résultat"). Les
// sources d'une recherche sont donc attachées à SON entrée précise, pas
// à un tableau global : voir ChatIA.tsx, l'événement "sources" est
// rattaché au DERNIER élément de outilsResultats plutôt qu'à un champ
// séparé du message -- fiable car le backend émet toujours
// outil_resultat puis sources pour un même appel, sans rien d'autre
// entre les deux (voir core/main.py:_traiter_appels).
//
// Distinct du raisonnement libre du modèle (RaisonnementBulle.tsx, reste
// affiché en premier/en haut) : ici c'est le VRAI contenu brut renvoyé
// par l'outil, pas ce que le modèle en a compris ou raconté.
//
// Icône reprise du registre vivant chargé depuis le backend (2026-08-15,
// voir lib/outils.ts:useOutilsRegistre -- avant : liste statique
// OUTILS_DISPONIBLES, incomplète pour ~40 outils internes qui tombaient
// donc sur ce repli générique) -- repli Wrench conservé pour tout outil
// malgré tout absent du registre (cas réseau en échec ET liste de
// secours elle-même incomplète, très rare).
//
// Fermé par défaut (26/07, retour Bourama : "il s'affiche
// automatiquement" n'était pas voulu) + glissement fluide à
// l'ouverture/fermeture (astuce grid-template-rows 0fr/1fr, même
// principe que RaisonnementBulle.tsx -- avant, c'était un
// affichage/masquage brut, sans transition).
//
// Menu "Sources" indépendant (31/07, demande Bourama) : avant, les
// sources n'étaient visibles qu'en dépliant le résultat brut complet de
// l'outil (JSON/texte technique) -- pas pratique pour juste vérifier
// d'où vient une réponse. Bouton dédié, son propre état ouvert/fermé,
// visible directement à côté du résultat de l'outil plutôt que niché
// dedans.
function iconePourOutil(outils: ReturnType<typeof useOutilsRegistre>["outils"], nomOutil: string) {
  return outils.find((o) => o.nom === nomOutil)?.Icone ?? Wrench;
}

export function OutilResultatBulle({
  resultats,
}: {
  resultats?: { nomOutil: string; nomLisible: string; resultat: string; sources?: { numero: number; titre: string; url: string; extrait?: string; url_extrait?: string; reperage?: string; position_type?: "page" | "timestamp"; position_valeur?: number; type_mime?: string | null }[] }[];
}) {
  const { outils } = useOutilsRegistre();
  const [ouverts, setOuverts] = useState<Record<number, boolean>>({});
  const [sourcesOuvertes, setSourcesOuvertes] = useState<Record<number, boolean>>({});

  if (!resultats || !resultats.length) return null;

  return (
    <div className="my-1.5 flex max-w-[85%] flex-col gap-1">
      {resultats.map((r, index) => {
        const Icone = iconePourOutil(outils, r.nomOutil);
        const ouvert = !!ouverts[index];
        const aDesSources = !!r.sources && r.sources.length > 0;
        const sourcesOuvert = !!sourcesOuvertes[index];
        return (
          <div key={index} className="animate-dj-fade-in">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <button
                onClick={() => setOuverts((prec) => ({ ...prec, [index]: !ouvert }))}
                className="flex items-center gap-1.5 text-[13px] text-dj-texte-muet transition-colors hover:text-dj-texte"
              >
                <Icone size={13} />
                <span>{r.nomLisible}</span>
                {ouvert ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
              {aDesSources && (
                <button
                  onClick={() => setSourcesOuvertes((prec) => ({ ...prec, [index]: !sourcesOuvert }))}
                  className="flex items-center gap-1.5 text-[13px] text-dj-texte-muet transition-colors hover:text-dj-texte"
                >
                  <Link2 size={13} />
                  <span>Sources ({r.sources!.length})</span>
                  {sourcesOuvert ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
              )}
            </div>
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                ouvert ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <pre className="mt-1.5 max-h-64 overflow-auto rounded-xl border border-dj-bordure bg-dj-surface p-2.5 text-[12px] leading-relaxed text-dj-texte-muet">
                  {r.resultat}
                </pre>
              </div>
            </div>
            {aDesSources && (
              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                  sourcesOuvert ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <SourcesBulle sources={r.sources} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
