"use client";

import { useEffect, useRef, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Download, Check } from "lucide-react";
import { telechargerImage } from "@/lib/telechargerImageGraphique";

// Rend un bloc ```chart du markdown -- convention documentée dans la
// page Notion "IA Conversationnelle" (section Affichage > Graphiques de
// données) : le modèle écrit du JSON structuré, schéma fixe :
//   { "type": "line" | "bar" | "pie", "data": [{...}], "labels"?: {...} }
// "data" : un tableau d'objets plats, une clé par série. Pour line/bar,
// la première clé sert d'axe X, les suivantes sont tracées comme séries.
// Pour pie, on attend {name, value}.
//
// Le prompt système (djiguigne-backend) doit documenter cette
// convention pour que le modèle la respecte -- ce composant ne fait que
// le rendu, il ne peut pas deviner un format non respecté (dans ce cas :
// message d'erreur discret, jamais de JSON brut affiché).
const COULEURS = ["var(--dj-accent-1)", "var(--dj-accent-2)", "var(--dj-code-accent)", "var(--dj-logo-3)", "var(--dj-texte-muet)"];

type Chart = {
  type: "line" | "bar" | "pie";
  data: Record<string, string | number>[];
  titre?: string;
};

// telechargerImage/dessinerLegende extraites vers lib/telechargerImageGraphique.ts
// (01/08, audit vitesse) : fonctions génériques sans dépendance à
// recharts, réutilisées aussi par SchemaGeometrique.tsx -- les garder
// ici aurait forcé SchemaGeometrique.tsx à importer tout ce fichier (et
// donc recharts) juste pour cette fonction de téléchargement PNG.

export function GraphiqueDonnees({ code }: { code: string }) {
  const conteneurRef = useRef<HTMLDivElement>(null);
  const [telecharge, setTelecharge] = useState(false);
  const [chart, setChart] = useState<Chart | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // CORRECTIF 2026-07-30 (audit UX) : avant, le JSON était re-parsé de
  // façon SYNCHRONE à chaque rendu, et le moindre échec de parsing --
  // qu'il soit transitoire (JSON encore incomplet, streaming en cours)
  // ou définitif (JSON réellement cassé) -- affichait indéfiniment
  // "Construction du graphique...", sans jamais distinguer les deux cas.
  // Même principe déjà appliqué à Mermaid.tsx (qui, lui, avait déjà été
  // corrigé) : on attend que le texte arrête de changer pendant 500ms
  // avant de tenter le parsing -- s'il échoue à ce moment-là, ce n'est
  // plus un JSON "en cours d'arrivée", c'est une vraie erreur à afficher.
  useEffect(() => {
    const delai = setTimeout(() => {
      try {
        setChart(JSON.parse(code));
        setErreur(null);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : String(e));
      }
    }, 500);
    return () => clearTimeout(delai);
  }, [code]);

  if (!chart) {
    if (erreur) {
      return (
        <div className="my-3 rounded-xl border border-dj-bordure bg-dj-surface p-4 text-xs text-dj-texte-muet">
          <span className="text-[var(--dj-erreur)]">Graphique invalide :</span> format JSON non reconnu.
        </div>
      );
    }
    return (
      <div className="my-3 flex h-40 items-center justify-center rounded-xl border border-dj-bordure bg-dj-surface text-xs text-dj-texte-muet">
        <span className="h-2 w-2 animate-dj-glow rounded-full bg-dj-texte-muet" />
        <span className="ml-2">Construction du graphique...</span>
      </div>
    );
  }

  if (!Array.isArray(chart.data) || chart.data.length === 0) {
    return (
      <div className="my-3 rounded-xl border border-dj-bordure bg-dj-surface p-4 text-xs text-dj-texte-muet">
        Graphique invalide (format non reconnu).
      </div>
    );
  }

  const cleAxeX = Object.keys(chart.data[0])[0];
  const clesSeries = Object.keys(chart.data[0]).filter((c) => c !== cleAxeX);

  // CORRECTIF 2026-07-31 (audit UX) : pour "pie", la convention documentée
  // en tête de fichier est {name, value} -- mais avant, la clé utilisée
  // pour la valeur du camembert était choisie par pure POSITION dans
  // l'objet ("la deuxième clé"), jamais par son nom réel. Si le modèle
  // inversait l'ordre ({value, name} au lieu de {name, value}) ou
  // n'incluait qu'une seule clé, le camembert se retrouvait à tracer du
  // texte comme s'il s'agissait de nombres -- résultat : un camembert
  // vide ou cassé, sans aucun message pour expliquer pourquoi.
  // On cherche maintenant la clé "value" par son NOM si elle existe,
  // avec repli sur la position seulement si absente -- et on vérifie
  // que les valeurs obtenues sont bien numériques avant de tracer quoi
  // que ce soit.
  const cleNomPie = "name" in chart.data[0] ? "name" : cleAxeX;
  const cleValeurPie = "value" in chart.data[0] ? "value" : clesSeries[0];
  const pieValide =
    chart.type !== "pie" ||
    (cleValeurPie !== undefined && chart.data.every((d) => typeof d[cleValeurPie] === "number"));

  if (chart.type === "pie" && !pieValide) {
    return (
      <div className="my-3 rounded-xl border border-dj-bordure bg-dj-surface p-4 text-xs text-dj-texte-muet">
        <span className="text-[var(--dj-erreur)]">Graphique invalide :</span> un camembert attend des paires{" "}
        <code className="text-dj-texte">{"{ name, value }"}</code> avec des valeurs numériques.
      </div>
    );
  }

  // CORRECTIF 2026-07-31 (audit UX) : avant, un type non reconnu ("donut",
  // "area", une faute de frappe du modèle...) retombait silencieusement
  // sur LineChart -- le "else" final du ternaire ci-dessous attrapait
  // tout ce qui n'était ni "pie" ni "bar". La personne voyait alors un
  // graphique different de ce qui avait ete demande (un modele peut
  // suivre une demande utilisateur trop littéralement -- ex. "graphique
  // en anneau" -- et écrire un type non supporté dans le JSON), sans
  // aucune indication que quelque chose s'était mal passé.
  const TYPES_SUPPORTES = ["line", "bar", "pie"] as const;
  if (!TYPES_SUPPORTES.includes(chart.type as (typeof TYPES_SUPPORTES)[number])) {
    return (
      <div className="my-3 rounded-xl border border-dj-bordure bg-dj-surface p-4 text-xs text-dj-texte-muet">
        <span className="text-[var(--dj-erreur)]">Graphique invalide :</span> type "{String(chart.type)}" non pris en charge
        (attendu : line, bar ou pie).
      </div>
    );
  }

  // Légende à reconstruire nous-mêmes pour l'export PNG (voir
  // dessinerLegende ci-dessus) : pour un camembert, une part par entrée
  // de données ; pour ligne/barres, une série par clé (hors axe X).
  const legendeExport =
    chart.type === "pie"
      ? chart.data.map((d, i) => ({ libelle: String(d[cleNomPie]), couleur: COULEURS[i % COULEURS.length] }))
      : clesSeries.map((cle, i) => ({ libelle: cle, couleur: COULEURS[i % COULEURS.length] }));

  return (
    <div className="my-3 animate-dj-fade-in rounded-xl border border-dj-bordure bg-dj-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        {chart.titre ? (
          <p className="text-sm font-semibold text-dj-texte">{chart.titre}</p>
        ) : (
          <span />
        )}
        <button
          onClick={() =>
            telechargerImage(
              conteneurRef.current,
              `${chart?.titre ? chart.titre.replace(/[^a-z0-9-_]+/gi, "_") : "graphique"}.png`,
              () => {
                setTelecharge(true);
                setTimeout(() => setTelecharge(false), 1500);
              },
              legendeExport
            )
          }
          aria-label="Télécharger le graphique en image"
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-dj-texte-muet transition-colors hover:text-dj-texte"
        >
          {telecharge ? (
            <>
              <Check size={12} /> Téléchargé
            </>
          ) : (
            <>
              <Download size={12} /> Télécharger
            </>
          )}
        </button>
      </div>
      {/* CORRECTIF 2026-07-31 (audit UX/fiabilité) : la référence passée à
          telechargerImage() était sur la carte ENTIÈRE (titre + bouton
          Télécharger, avec ses propres icônes lucide), ce qui forçait
          l'heuristique "on prend le plus grand <svg>" à départager le
          vrai graphique de tout ce qui traîne alentour. En scopant la
          référence à CE SEUL wrapper (rien d'autre à l'intérieur que le
          graphique recharts lui-même, légende HTML comprise -- voir
          dessinerLegende plus haut), il ne reste plus qu'un candidat
          plausible : le tie-break par taille devient une garantie, pas
          une supposition. */}
      <div ref={conteneurRef}>
        <ResponsiveContainer width="100%" height={260}>
          {chart.type === "pie" ? (
            <PieChart>
              <Pie
                data={chart.data}
                dataKey={cleValeurPie}
                nameKey={cleNomPie}
                outerRadius={90}
                label
              >
                {chart.data.map((_, index) => (
                  <Cell key={index} fill={COULEURS[index % COULEURS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--dj-surface-haute)", border: "1px solid var(--dj-bordure)" }} />
              <Legend />
            </PieChart>
          ) : chart.type === "bar" ? (
            <BarChart data={chart.data}>
              <CartesianGrid stroke="var(--dj-bordure)" />
              <XAxis dataKey={cleAxeX} stroke="var(--dj-texte-muet)" fontSize={12} />
              <YAxis stroke="var(--dj-texte-muet)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--dj-surface-haute)", border: "1px solid var(--dj-bordure)" }} />
              <Legend />
              {clesSeries.map((cle, index) => (
                <Bar key={cle} dataKey={cle} fill={COULEURS[index % COULEURS.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          ) : (
            <LineChart data={chart.data}>
              <CartesianGrid stroke="var(--dj-bordure)" />
              <XAxis dataKey={cleAxeX} stroke="var(--dj-texte-muet)" fontSize={12} />
              <YAxis stroke="var(--dj-texte-muet)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--dj-surface-haute)", border: "1px solid var(--dj-bordure)" }} />
              <Legend />
              {clesSeries.map((cle, index) => (
                <Line
                  key={cle}
                  type="monotone"
                  dataKey={cle}
                  stroke={COULEURS[index % COULEURS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
