"use client";

import { useEffect, useRef, useState } from "react";
import {
  FileText,
  Plus,
  Trash2,
  Menu,
  ChevronRight,
  ChevronDown,
  GripVertical,
  Search,
  File as IconFichier,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import {
  listerPagesRacines,
  listerSousPages,
  rechercherPages,
  creerPage,
  obtenirPage,
  modifierPage,
  supprimerPage,
  creerBloc,
  modifierBloc,
  supprimerBloc,
  uploaderBlocFichier,
  type PageEspace,
  type PageDetail,
  type BlocEspace,
} from "@/lib/api";
import { ErreurApi } from "@/lib/erreurs";
import { CTACompteRequis } from "./CTACompteRequis";
import { Skeleton } from "./Skeleton";

// Section "Notion-like" -- Partie 2/2 de la refonte "vraiment comme
// Notion" (22/08/2026, demande explicite de Bourama : "go la partie 2,
// tout, go non stop"). Ajoute, PAR-DESSUS LA PARTIE 1 :
//   - blocs image / fichier (upload réel, POST /api/blocs/upload) et
//     vidéo / intégration (lien externe, YouTube détecté automatiquement)
//   - imbrication bloc-dans-bloc via le bloc "bascule" (toggle) --
//     schéma : blocs.parent_bloc_id (migration 2026_08_22_...)
//   - recherche globale (Ctrl/Cmd+K) sur le titre des pages
//   - liens entre pages via "[[" ou "@" dans un bloc texte, avec
//     autocomplete -- stocké en clair comme [[Titre|pageId]], rendu
//     comme lien cliquable (le titre affiché se fige à l'insertion ;
//     si la page cible est renommée ensuite, le lien reste correct
//     (id) mais le texte affiché ne se met pas à jour tout seul --
//     simplification assumée)
//   - propriétés avancées de base de données : relation (vers une AUTRE
//     base de données de LA MÊME PAGE seulement), rollup (agrège une
//     propriété via une relation : nombre/somme/liste texte), formule
//     (opération à deux opérandes entre deux propriétés de la même
//     ligne -- pas un langage d'expression complet)
// Portée volontairement limitée sur plusieurs points (voir commentaires
// ci-dessous) -- "simple et fiable", principe déjà établi ailleurs dans
// cette section par Bourama lui-même.

const TYPES_BLOCS: { id: string; label: string }[] = [
  { id: "texte", label: "Texte" },
  { id: "titre", label: "Titre" },
  { id: "liste_puces", label: "Liste à puces" },
  { id: "liste_numerotee", label: "Liste numérotée" },
  { id: "case_a_cocher", label: "Case à cocher" },
  { id: "citation", label: "Citation" },
  { id: "separateur", label: "Séparateur" },
  { id: "equation", label: "Équation (LaTeX)" },
  { id: "bascule", label: "Bascule (toggle)" },
  { id: "image", label: "Image" },
  { id: "fichier", label: "Fichier" },
  { id: "video", label: "Vidéo (lien)" },
  { id: "embed", label: "Intégration (lien)" },
  { id: "base_donnees", label: "Base de données" },
];

const EMOJIS_COURANTS = [
  "📄", "📝", "📚", "🎓", "🧠", "💡", "📌", "✅",
  "🗂️", "🔬", "🧮", "🌍", "🎯", "⭐", "🔥", "📖",
  "🧪", "🖊️", "📅", "🏆", "💻", "🔑", "🚀", "❤️",
];

// Types qui restent dans le même type à l'Entrée (comme Notion : une
// case à cocher suivie d'Entrée reste une case à cocher, etc.). Absent
// de cette table -> nouveau bloc "texte" (ex : un titre suivi d'Entrée
// redescend en texte normal, comme Notion).
const TYPES_CONTINUATION: Record<string, string> = {
  liste_puces: "liste_puces",
  liste_numerotee: "liste_numerotee",
  case_a_cocher: "case_a_cocher",
};

export function EspaceNotes() {
  const [racines, setRacines] = useState<PageEspace[] | null>(null);
  const [sansCompte, setSansCompte] = useState(false);
  const [pageActiveId, setPageActiveId] = useState<string | null>(null);
  const [enfants, setEnfants] = useState<Record<string, PageEspace[]>>({});
  const [ouverts, setOuverts] = useState<Record<string, boolean>>({});
  const [sidebarMobileOuverte, setSidebarMobileOuverte] = useState(false);
  const [rechercheOuverte, setRechercheOuverte] = useState(false);

  useEffect(() => {
    chargerRacines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recherche globale : Ctrl/Cmd+K depuis n'importe où dans la section.
  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setRechercheOuverte(true);
      }
    }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, []);

  function chargerRacines() {
    listerPagesRacines()
      .then((r) => {
        setRacines(r);
        setPageActiveId((prev) => prev ?? (r.length > 0 ? r[0].id : null));
      })
      .catch((e) => {
        if (e instanceof ErreurApi && e.statusCode === 401) setSansCompte(true);
        setRacines([]);
      });
  }

  function chargerEnfants(pageId: string) {
    listerSousPages(pageId).then((r) => setEnfants((prev) => ({ ...prev, [pageId]: r })));
  }

  function basculerNoeud(pageId: string) {
    setOuverts((prev) => {
      const ouvertMaintenant = !prev[pageId];
      if (ouvertMaintenant && !enfants[pageId]) chargerEnfants(pageId);
      return { ...prev, [pageId]: ouvertMaintenant };
    });
  }

  function rafraichirNoeud(parentId: string | null) {
    if (parentId === null) {
      chargerRacines();
      return;
    }
    chargerEnfants(parentId);
    setOuverts((prev) => ({ ...prev, [parentId]: true }));
  }

  function patcherPageDansArbre(pageId: string, champs: Partial<PageEspace>) {
    setRacines((prev) => prev?.map((p) => (p.id === pageId ? { ...p, ...champs } : p)) ?? prev);
    setEnfants((prev) => {
      const copie: Record<string, PageEspace[]> = {};
      for (const cle of Object.keys(prev)) copie[cle] = prev[cle].map((p) => (p.id === pageId ? { ...p, ...champs } : p));
      return copie;
    });
  }

  async function reordonnerFreres(parentId: string | null, depuisId: string, versId: string) {
    const liste = parentId === null ? racines : enfants[parentId];
    if (!liste) return;
    const ids = liste.map((p) => p.id);
    const depuisIndex = ids.indexOf(depuisId);
    const versIndex = ids.indexOf(versId);
    if (depuisIndex === -1 || versIndex === -1 || depuisIndex === versIndex) return;
    const nouveauxIds = [...ids];
    const [retire] = nouveauxIds.splice(depuisIndex, 1);
    nouveauxIds.splice(versIndex, 0, retire);
    const parId = new Map(liste.map((p) => [p.id, p]));
    const nouvelleListe = nouveauxIds.map((id, i) => ({ ...parId.get(id)!, ordre: i }));
    if (parentId === null) setRacines(nouvelleListe);
    else setEnfants((prev) => ({ ...prev, [parentId]: nouvelleListe }));
    await Promise.all(
      nouveauxIds.map((id, i) => (parId.get(id)!.ordre === i ? null : modifierPage(id, { ordre: i })))
        .filter((p): p is Promise<PageEspace> => p !== null)
    );
  }

  function naviguer(id: string) {
    setPageActiveId(id);
    setSidebarMobileOuverte(false);
  }

  async function creerPageRacine() {
    const page = await creerPage("Nouvelle page");
    setRacines((prev) => [...(prev ?? []), page]);
    naviguer(page.id);
  }

  if (sansCompte) {
    return <CTACompteRequis texte="Crée un compte pour organiser tes pages, fiches de révision et tâches dans Clovis." />;
  }

  return (
    <div className="flex h-full min-h-0">
      {rechercheOuverte && <ModaleRecherche onFermer={() => setRechercheOuverte(false)} onNaviguer={naviguer} />}

      {sidebarMobileOuverte && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarMobileOuverte(false)}
          aria-hidden="true"
        />
      )}

      <div className={`fixed inset-y-0 left-0 z-40 md:static md:z-auto ${sidebarMobileOuverte ? "flex" : "hidden"} md:flex`}>
        <SidebarArbre
          racines={racines}
          pageActiveId={pageActiveId}
          onNaviguer={naviguer}
          onRechercher={() => setRechercheOuverte(true)}
          onCreerRacine={creerPageRacine}
          enfants={enfants}
          ouverts={ouverts}
          onBasculer={basculerNoeud}
          onReordonnerFreres={reordonnerFreres}
        />
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="flex items-center gap-2 pb-1 pl-12 pt-3 md:hidden">
          <button
            onClick={() => setSidebarMobileOuverte(true)}
            aria-label="Ouvrir les pages"
            className="flex h-8 w-8 items-center justify-center rounded-md text-dj-texte-muet hover:bg-dj-surface-haute"
          >
            <Menu size={16} />
          </button>
        </div>

        <div className="mx-auto w-full max-w-3xl px-6 pb-24 pt-4 md:px-14 md:pt-12">
          {pageActiveId ? (
            <PanneauPage
              key={pageActiveId}
              pageId={pageActiveId}
              onNaviguer={naviguer}
              onSupprimee={(parentId) => {
                rafraichirNoeud(parentId);
                setPageActiveId(null);
              }}
              onArbreChange={rafraichirNoeud}
              onPageChange={patcherPageDansArbre}
              onReordonnerFreres={reordonnerFreres}
            />
          ) : (
            <p className="text-sm text-dj-texte-muet">Crée une page pour commencer.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Recherche globale (Ctrl/Cmd+K) -- titre des pages uniquement.
// ---------------------------------------------------------------------

function ModaleRecherche({ onFermer, onNaviguer }: { onFermer: () => void; onNaviguer: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [resultats, setResultats] = useState<PageEspace[]>([]);
  const refInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refInput.current?.focus();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      rechercherPages(q).then(setResultats);
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-24" onClick={onFermer}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-cgpt-carte border border-dj-bordure bg-dj-surface shadow-xl">
        <div className="flex items-center gap-2 border-b border-dj-bordure px-3">
          <Search size={14} className="shrink-0 text-dj-texte-muet" />
          <input
            ref={refInput}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onFermer();
            }}
            placeholder="Rechercher une page…"
            className="w-full bg-transparent py-3 text-sm outline-none"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {q.trim() && resultats.length === 0 && <p className="px-2.5 py-2 text-xs text-dj-texte-muet">Aucun résultat.</p>}
          {resultats.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onNaviguer(p.id);
                onFermer();
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-dj-texte hover:bg-dj-surface-haute"
            >
              {p.icone ? <span className="text-sm">{p.icone}</span> : <FileText size={14} className="text-dj-texte-muet" />}
              <span className="truncate">{p.titre || "Sans titre"}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Sidebar façon Notion -- arbre de pages, dépliable, glisser-déposer.
// ---------------------------------------------------------------------

function SidebarArbre({
  racines,
  pageActiveId,
  onNaviguer,
  onRechercher,
  onCreerRacine,
  enfants,
  ouverts,
  onBasculer,
  onReordonnerFreres,
}: {
  racines: PageEspace[] | null;
  pageActiveId: string | null;
  onNaviguer: (id: string) => void;
  onRechercher: () => void;
  onCreerRacine: () => void;
  enfants: Record<string, PageEspace[]>;
  ouverts: Record<string, boolean>;
  onBasculer: (id: string) => void;
  onReordonnerFreres: (parentId: string | null, depuisId: string, versId: string) => void;
}) {
  return (
    <nav className="flex h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-dj-bordure bg-dj-fond px-2 py-4">
      <button
        onClick={onRechercher}
        className="mb-1 flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-dj-texte hover:bg-dj-surface-haute"
      >
        <span className="flex items-center gap-2">
          <Search size={14} /> Rechercher
        </span>
        <span className="text-[10px] text-dj-texte-muet">Ctrl+K</span>
      </button>

      <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-dj-texte-muet">Pages</p>

      <div className="flex-1 space-y-0.5">
        {racines === null ? (
          <div className="space-y-1.5 px-2 py-1">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-4 w-24 rounded" />
          </div>
        ) : racines.length === 0 ? (
          <p className="px-2 py-1 text-xs text-dj-texte-muet">Aucune page.</p>
        ) : (
          racines.map((p) => (
            <NoeudArbre
              key={p.id}
              page={p}
              profondeur={0}
              pageActiveId={pageActiveId}
              onNaviguer={onNaviguer}
              enfants={enfants}
              ouverts={ouverts}
              onBasculer={onBasculer}
              onReordonnerFreres={onReordonnerFreres}
            />
          ))
        )}
      </div>

      <button
        onClick={onCreerRacine}
        className="mt-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-dj-texte-muet hover:bg-dj-surface-haute hover:text-dj-texte"
      >
        <Plus size={13} /> Nouvelle page
      </button>
    </nav>
  );
}

function NoeudArbre({
  page,
  profondeur,
  pageActiveId,
  onNaviguer,
  enfants,
  ouverts,
  onBasculer,
  onReordonnerFreres,
}: {
  page: PageEspace;
  profondeur: number;
  pageActiveId: string | null;
  onNaviguer: (id: string) => void;
  enfants: Record<string, PageEspace[]>;
  ouverts: Record<string, boolean>;
  onBasculer: (id: string) => void;
  onReordonnerFreres: (parentId: string | null, depuisId: string, versId: string) => void;
}) {
  const ouvert = ouverts[page.id] ?? false;
  const listeEnfants = enfants[page.id];
  const actif = pageActiveId === page.id;

  return (
    <div>
      <div
        onClick={() => onNaviguer(page.id)}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", page.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const idSource = e.dataTransfer.getData("text/plain");
          if (idSource && idSource !== page.id) onReordonnerFreres(page.parent_id, idSource, page.id);
        }}
        style={{ paddingLeft: 4 + profondeur * 14 }}
        className={`group flex cursor-pointer items-center gap-1 rounded-md py-1 pr-2 text-sm transition-colors ${
          actif ? "bg-dj-accent-1/15 text-dj-accent-2" : "text-dj-texte hover:bg-dj-surface-haute"
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBasculer(page.id);
          }}
          className="flex h-4 w-4 shrink-0 items-center justify-center text-dj-texte-muet"
          aria-label={ouvert ? "Replier" : "Déplier"}
        >
          {ouvert ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        {page.icone ? (
          <span className="w-[13px] shrink-0 text-center text-[13px] leading-none">{page.icone}</span>
        ) : (
          <FileText size={13} className="shrink-0 text-dj-texte-muet" />
        )}
        <span className="truncate">{page.titre || "Sans titre"}</span>
      </div>
      {ouvert && (
        <div>
          {listeEnfants === undefined ? (
            <div style={{ paddingLeft: 4 + (profondeur + 1) * 14 }} className="py-1">
              <Skeleton className="h-4 w-24 rounded" />
            </div>
          ) : (
            listeEnfants.map((enfant) => (
              <NoeudArbre
                key={enfant.id}
                page={enfant}
                profondeur={profondeur + 1}
                pageActiveId={pageActiveId}
                onNaviguer={onNaviguer}
                enfants={enfants}
                ouverts={ouverts}
                onBasculer={onBasculer}
                onReordonnerFreres={onReordonnerFreres}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Sélecteur d'icône emoji de page
// ---------------------------------------------------------------------

function SelecteurIcone({ icone, onChoisir }: { icone: string | null; onChoisir: (e: string | null) => void }) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOuvert((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-md text-2xl hover:bg-dj-surface-haute"
        title="Changer l'icône"
      >
        {icone || <FileText size={22} className="text-dj-texte-muet" />}
      </button>
      {ouvert && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-2 shadow-lg">
          <div className="grid grid-cols-8 gap-0.5">
            {EMOJIS_COURANTS.map((e) => (
              <button
                key={e}
                onClick={() => {
                  onChoisir(e);
                  setOuvert(false);
                }}
                className="flex h-6 w-6 items-center justify-center rounded text-base hover:bg-dj-surface-haute"
              >
                {e}
              </button>
            ))}
          </div>
          <div className="mt-2 border-t border-dj-bordure pt-2">
            <input
              maxLength={4}
              placeholder="Autre emoji puis Entrée…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.currentTarget.value.trim()) {
                  onChoisir(e.currentTarget.value.trim());
                  setOuvert(false);
                }
              }}
              className="w-full rounded border border-dj-bordure bg-dj-surface px-1.5 py-1 text-xs outline-none"
            />
          </div>
          {icone && (
            <button
              onClick={() => {
                onChoisir(null);
                setOuvert(false);
              }}
              className="mt-1.5 w-full rounded-md px-1.5 py-1 text-left text-[11px] text-dj-texte-muet hover:bg-dj-surface-haute"
            >
              Retirer l'icône
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Menu "+" réutilisable (page et bascules) -- liste des types de blocs.
// ---------------------------------------------------------------------

function MenuAjouterBloc({
  onChoisir,
  onSousPage,
}: {
  onChoisir: (type: string) => void;
  onSousPage?: () => void;
}) {
  return (
    <div className="absolute left-0 top-full z-10 mt-1 w-56 space-y-0.5 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-1.5 shadow-lg">
      {TYPES_BLOCS.filter((t) => t.id !== "texte").map((t) => (
        <button
          key={t.id}
          onClick={() => onChoisir(t.id)}
          className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-dj-texte hover:bg-dj-surface-haute"
        >
          {t.label}
        </button>
      ))}
      {onSousPage && (
        <button
          onClick={onSousPage}
          className="mt-0.5 block w-full rounded-md border-t border-dj-bordure px-2 py-1.5 pt-2 text-left text-xs text-dj-texte hover:bg-dj-surface-haute"
        >
          + Sous-page
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Panneau d'une page (icône, titre, blocs imbriqués, sous-pages, carrefour)
// ---------------------------------------------------------------------

function PanneauPage({
  pageId,
  onNaviguer,
  onSupprimee,
  onArbreChange,
  onPageChange,
  onReordonnerFreres,
}: {
  pageId: string;
  onNaviguer: (id: string) => void;
  onSupprimee: (parentId: string | null) => void;
  onArbreChange: (parentId: string | null) => void;
  onPageChange: (pageId: string, champs: Partial<PageEspace>) => void;
  onReordonnerFreres: (parentId: string | null, depuisId: string, versId: string) => void;
}) {
  const [page, setPage] = useState<PageDetail | null>(null);
  const [titreEnEdition, setTitreEnEdition] = useState("");
  const [menuAjoutOuvert, setMenuAjoutOuvert] = useState(false);
  const [activation, setActivation] = useState<{ id: string; position: "debut" | "fin" } | null>(null);

  useEffect(() => {
    setPage(null);
    setMenuAjoutOuvert(false);
    setActivation(null);
    obtenirPage(pageId).then((p) => {
      setPage(p);
      setTitreEnEdition(p.titre);
    });
  }, [pageId]);

  // Met à jour un ou plusieurs blocs directement dans l'état local, sans
  // repasser par le serveur -- élimine l'aller-retour réseau complet
  // (page + sous-pages + tous les blocs) après chaque frappe/action,
  // qui rendait l'éditeur lent (demande Bourama, 27/08/2026).
  function patcherBlocsLocal(patches: { id: string; champs: Partial<BlocEspace> }[]) {
    setPage((prev) => {
      if (!prev) return prev;
      const parId = new Map(patches.map((p) => [p.id, p.champs]));
      return { ...prev, blocs: prev.blocs.map((b) => (parId.has(b.id) ? { ...b, ...parId.get(b.id) } : b)) };
    });
  }

  function ajouterBlocsLocal(nouveaux: BlocEspace[]) {
    setPage((prev) => (prev ? { ...prev, blocs: [...prev.blocs, ...nouveaux] } : prev));
  }

  function retirerBlocLocal(blocId: string) {
    setPage((prev) => (prev ? { ...prev, blocs: prev.blocs.filter((b) => b.id !== blocId) } : prev));
  }

  function retirerBlocLocalEtSupprimer(blocId: string) {
    retirerBlocLocal(blocId);
    supprimerBloc(blocId).catch(() => {});
  }

  async function enregistrerTitre() {
    if (!page || titreEnEdition === page.titre) return;
    const maj = await modifierPage(pageId, { titre: titreEnEdition });
    setPage((prev) => (prev ? { ...prev, titre: maj.titre } : prev));
    onPageChange(pageId, { titre: maj.titre });
  }

  async function changerIcone(icone: string | null) {
    const maj = await modifierPage(pageId, { icone });
    setPage((prev) => (prev ? { ...prev, icone: maj.icone } : prev));
    onPageChange(pageId, { icone: maj.icone });
  }

  // Insère un bloc de `type` à la position `indexDansFreres` PARMI LES
  // BLOCS DE MÊME PARENT (parentBlocId) -- l'imbrication donne à chaque
  // niveau sa propre séquence d'ordre indépendante, pas besoin
  // d'interclasser avec les autres niveaux.
  async function inserterBlocA(indexDansFreres: number, type: string, parentBlocId: string | null) {
    if (!page) return;
    const freres = page.blocs.filter((b) => (b.parent_bloc_id ?? null) === parentBlocId);
    const nouveau = await creerBloc(pageId, type, {}, freres.length, parentBlocId);
    const idsOrdonnes = freres.map((b) => b.id);
    idsOrdonnes.splice(indexDansFreres, 0, nouveau.id);
    const parId = new Map<string, BlocEspace>(freres.map((b) => [b.id, b]));
    parId.set(nouveau.id, nouveau);
    // Affichage immédiat (optimiste) : le bloc apparaît tout de suite avec
    // le bon ordre local, sans attendre le serveur.
    const nouveauxOrdonnes = idsOrdonnes.map((id, i) => ({ ...parId.get(id)!, ordre: i }));
    setPage((prev) => {
      if (!prev) return prev;
      const autres = prev.blocs.filter((b) => (b.parent_bloc_id ?? null) !== parentBlocId);
      return { ...prev, blocs: [...autres, ...nouveauxOrdonnes] };
    });
    setActivation({ id: nouveau.id, position: "debut" });
    // Persistance du réordonnancement en arrière-plan -- n'empêche pas
    // l'utilisateur de continuer à taper pendant ce temps.
    Promise.all(
      idsOrdonnes.map((id, i) => {
        const b = parId.get(id)!;
        return b.ordre === i ? null : modifierBloc(id, { ordre: i });
      }).filter((p): p is Promise<BlocEspace> => p !== null)
    ).catch(() => {});
  }

  // Navigation clavier flèche haut/bas entre blocs de même parent --
  // permet de passer d'un bloc à l'autre sans cliquer, comme Notion.
  function naviguerVertical(depuisId: string, direction: "haut" | "bas") {
    if (!page) return;
    const bloc = page.blocs.find((b) => b.id === depuisId);
    if (!bloc) return;
    const freres = page.blocs.filter((b) => (b.parent_bloc_id ?? null) === (bloc.parent_bloc_id ?? null));
    const index = freres.findIndex((b) => b.id === depuisId);
    const cible = direction === "haut" ? freres[index - 1] : freres[index + 1];
    if (!cible) return;
    setActivation({ id: cible.id, position: direction === "haut" ? "fin" : "debut" });
  }

  // Retour arrière sur un bloc vide : le supprime et recule dans le
  // bloc précédent (fin de son texte), sans clic -- comme Notion.
  async function supprimerEtReculer(depuisId: string) {
    if (!page) return;
    const bloc = page.blocs.find((b) => b.id === depuisId);
    if (!bloc) return;
    const freres = page.blocs.filter((b) => (b.parent_bloc_id ?? null) === (bloc.parent_bloc_id ?? null));
    const index = freres.findIndex((b) => b.id === depuisId);
    const precedent = freres[index - 1];
    retirerBlocLocal(depuisId);
    if (precedent) setActivation({ id: precedent.id, position: "fin" });
    supprimerBloc(depuisId).catch(() => {});
  }

  // Choix dans le menu "+" : image/fichier passent par un vrai upload
  // (pas de bloc coquille créé avant que le fichier soit choisi), tout
  // le reste passe par inserterBlocA classique.
  function choisirTypeBloc(indexDansFreres: number, parentBlocId: string | null, type: string) {
    setMenuAjoutOuvert(false);
    if (type === "image" || type === "fichier") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = type === "image" ? "image/*" : "*/*";
      input.onchange = async () => {
        const f = input.files?.[0];
        if (!f || !page) return;
        const freres = page.blocs.filter((b) => (b.parent_bloc_id ?? null) === parentBlocId);
        const nouveau = await uploaderBlocFichier(pageId, type, f, freres.length, parentBlocId);
        ajouterBlocsLocal([nouveau]);
        setActivation({ id: nouveau.id, position: "debut" });
      };
      input.click();
      return;
    }
    inserterBlocA(indexDansFreres, type, parentBlocId);
  }

  async function deplacerBloc(idSource: string, idCible: string) {
    if (!page || idSource === idCible) return;
    const cible = page.blocs.find((b) => b.id === idCible);
    if (!cible) return;
    const parentBlocId = cible.parent_bloc_id ?? null;
    const freres = page.blocs.filter((b) => (b.parent_bloc_id ?? null) === parentBlocId);
    const ids = freres.map((b) => b.id);
    const depuisIndex = ids.indexOf(idSource);
    const versIndex = ids.indexOf(idCible);
    if (depuisIndex === -1 || versIndex === -1) return; // niveaux différents -- pas de déplacement inter-niveaux par glisser
    const nouveauxIds = [...ids];
    const [retire] = nouveauxIds.splice(depuisIndex, 1);
    nouveauxIds.splice(versIndex, 0, retire);
    const parId = new Map(freres.map((b) => [b.id, b]));
    const nouveauxOrdonnes = nouveauxIds.map((id, i) => ({ ...parId.get(id)!, ordre: i }));
    setPage((prev) => {
      if (!prev) return prev;
      const autres = prev.blocs.filter((b) => (b.parent_bloc_id ?? null) !== parentBlocId);
      return { ...prev, blocs: [...autres, ...nouveauxOrdonnes] };
    });
    Promise.all(
      nouveauxIds.map((id, i) => (parId.get(id)!.ordre === i ? null : modifierBloc(id, { ordre: i })))
        .filter((p): p is Promise<BlocEspace> => p !== null)
    ).catch(() => {});
  }

  // Imbrique idSource comme DERNIER enfant de idCible (glisser-déposer
  // sur la moitié droite d'un bloc, ou Tab en début de bloc) -- aucune
  // restriction de type, contrairement à l'ancienne version limitée au
  // seul bloc "bascule" (demande Bourama, 27/08/2026).
  async function imbriquerBloc(idSource: string, idCibleParent: string) {
    if (!page || idSource === idCibleParent) return;
    // Jamais imbriquer un bloc dans l'un de ses propres descendants.
    let curseur: string | null = idCibleParent;
    while (curseur) {
      if (curseur === idSource) return;
      curseur = page.blocs.find((b) => b.id === curseur)?.parent_bloc_id ?? null;
    }
    const freresCible = page.blocs.filter((b) => (b.parent_bloc_id ?? null) === idCibleParent);
    const nouvelOrdre = freresCible.length;
    patcherBlocsLocal([{ id: idSource, champs: { parent_bloc_id: idCibleParent, ordre: nouvelOrdre } }]);
    modifierBloc(idSource, { parent_bloc_id: idCibleParent, ordre: nouvelOrdre }).catch(() => {});
  }

  // Désimbrique idSource : remonte d'un niveau, devient le frère suivant
  // de son ancien parent (Shift+Tab).
  async function desimbriquerBloc(idSource: string) {
    if (!page) return;
    const bloc = page.blocs.find((b) => b.id === idSource);
    if (!bloc || !bloc.parent_bloc_id) return;
    const parent = page.blocs.find((b) => b.id === bloc.parent_bloc_id);
    if (!parent) return;
    const nouveauParentId = parent.parent_bloc_id ?? null;
    const nouveauxFreres = page.blocs.filter((b) => (b.parent_bloc_id ?? null) === nouveauParentId);
    const indexParent = nouveauxFreres.findIndex((b) => b.id === parent.id);
    const nouvelOrdre = indexParent + 1;
    patcherBlocsLocal([{ id: idSource, champs: { parent_bloc_id: nouveauParentId, ordre: nouvelOrdre } }]);
    modifierBloc(idSource, { parent_bloc_id: nouveauParentId, ordre: nouvelOrdre }).catch(() => {});
  }

  async function ajouterSousPage() {
    if (!page) return;
    setMenuAjoutOuvert(false);
    const sp = await creerPage("Nouvelle page", page.id);
    onArbreChange(page.id);
    onNaviguer(sp.id);
  }

  if (!page) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-2/3 rounded-md" />
        <Skeleton className="h-24 w-full rounded-md" />
      </div>
    );
  }

  // Colle plusieurs blocs d'un coup après une position donnée (résultat
  // du découpage d'un texte markdown collé) -- créés séquentiellement
  // côté serveur pour garder l'ordre, affichés localement sans attendre
  // de rechargement complet.
  async function collerBlocsApres(
    indexDansFreres: number,
    parentBlocId: string | null,
    blocsACreer: { type: string; texte: string }[]
  ) {
    if (!page || blocsACreer.length === 0) return;
    const freres = page.blocs.filter((b) => (b.parent_bloc_id ?? null) === parentBlocId);
    const crees: BlocEspace[] = [];
    let ordre = freres.length;
    for (const b of blocsACreer) {
      const cle = b.type === "equation" ? "latex" : "texte";
      const contenu = b.type === "separateur" ? {} : { [cle]: b.texte };
      const nouveau = await creerBloc(pageId, b.type, contenu, ordre, parentBlocId);
      crees.push(nouveau);
      ordre += 1;
    }
    const idsOrdonnes = freres.map((f) => f.id);
    idsOrdonnes.splice(indexDansFreres, 0, ...crees.map((c) => c.id));
    const parId = new Map<string, BlocEspace>([...freres, ...crees].map((b) => [b.id, b]));
    const nouveauxOrdonnes = idsOrdonnes.map((id, i) => ({ ...parId.get(id)!, ordre: i }));
    setPage((prev) => {
      if (!prev) return prev;
      const autres = prev.blocs.filter((b) => (b.parent_bloc_id ?? null) !== parentBlocId);
      return { ...prev, blocs: [...autres, ...nouveauxOrdonnes] };
    });
    if (crees.length > 0) setActivation({ id: crees[crees.length - 1].id, position: "fin" });
    Promise.all(
      idsOrdonnes
        .map((id, i) => (parId.get(id)!.ordre === i ? null : modifierBloc(id, { ordre: i })))
        .filter((p): p is Promise<BlocEspace> => p !== null)
    ).catch(() => {});
  }

  function patcherUnBloc(blocId: string, champs: Partial<BlocEspace>) {
    patcherBlocsLocal([{ id: blocId, champs }]);
  }

  return (
    <div>
      <div className="group/titre flex items-start gap-2">
        <SelecteurIcone icone={page.icone} onChoisir={changerIcone} />
        <input
          value={titreEnEdition}
          onChange={(e) => setTitreEnEdition(e.target.value)}
          onBlur={enregistrerTitre}
          placeholder="Sans titre"
          className="mt-1 w-full bg-transparent font-display text-3xl font-bold text-dj-texte outline-none placeholder:text-dj-texte-muet/50"
        />
        <button
          onClick={async () => {
            if (!confirm("Supprimer cette page et tout son contenu ?")) return;
            const parentId = page.parent_id;
            await supprimerPage(pageId);
            onSupprimee(parentId);
          }}
          className="mt-2.5 shrink-0 rounded-md p-1.5 text-dj-texte-muet opacity-0 transition-opacity hover:bg-dj-surface-haute hover:text-red-500 group-hover/titre:opacity-100"
          title="Supprimer la page"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="mt-6">
        <ListeBlocs
          tousLesBlocs={page.blocs}
          parentBlocId={null}
          onChange={patcherUnBloc}
          onSupprimerBloc={retirerBlocLocalEtSupprimer}
          onDeplacer={deplacerBloc}
          onImbriquer={imbriquerBloc}
          onDesimbriquer={desimbriquerBloc}
          onAjouterA={(index, parentId, type) => inserterBlocA(index, type, parentId)}
          onCollerBlocsApres={collerBlocsApres}
          onNaviguer={onNaviguer}
          onNaviguerVertical={naviguerVertical}
          onSupprimerEtReculer={supprimerEtReculer}
          activation={activation}
          onActivationConsommee={() => setActivation(null)}
        />
        {/* Clic n'importe où sous le dernier bloc = comme s'il n'y avait
            qu'un seul bloc texte : on va à sa fin s'il est déjà de type
            texte, sinon on en crée un nouveau à la fin -- jamais besoin
            de passer par "+ Ajouter" pour écrire du texte. */}
        <div
          className="min-h-[2.5rem] w-full cursor-text"
          onClick={() => {
            const racines = page.blocs.filter((b) => !b.parent_bloc_id).sort((a, b) => a.ordre - b.ordre);
            const dernier = racines[racines.length - 1];
            if (dernier && dernier.type === "texte") {
              setActivation({ id: dernier.id, position: "fin" });
            } else {
              inserterBlocA(racines.length, "texte", null);
            }
          }}
        />
      </div>

      {page.sous_pages.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {page.sous_pages.map((sp) => (
            <div
              key={sp.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", sp.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const idSource = e.dataTransfer.getData("text/plain");
                if (idSource && idSource !== sp.id) onReordonnerFreres(page.id, idSource, sp.id);
              }}
            >
              <button
                onClick={() => onNaviguer(sp.id)}
                className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-dj-texte hover:bg-dj-surface-haute"
              >
                {sp.icone ? (
                  <span className="w-[15px] shrink-0 text-center text-sm leading-none">{sp.icone}</span>
                ) : (
                  <FileText size={15} className="shrink-0 text-dj-texte-muet" />
                )}
                <span className="truncate underline decoration-dj-bordure underline-offset-4">{sp.titre || "Sans titre"}</span>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative mt-1 inline-block">
        <button
          onClick={() => setMenuAjoutOuvert((v) => !v)}
          className="-mx-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-dj-texte-muet/70 hover:bg-dj-surface-haute hover:text-dj-texte-muet"
        >
          <Plus size={14} /> Ajouter
        </button>
        {menuAjoutOuvert && (
          <MenuAjouterBloc
            onChoisir={(type) => choisirTypeBloc(page.blocs.filter((b) => !b.parent_bloc_id).length, null, type)}
            onSousPage={ajouterSousPage}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Liste récursive des blocs d'un niveau (racine de page, ou enfants
// d'une bascule) -- glisser-déposer scopé au niveau, "+" scopé au niveau.
// ---------------------------------------------------------------------

function ListeBlocs({
  tousLesBlocs,
  parentBlocId,
  onChange,
  onSupprimerBloc,
  onDeplacer,
  onImbriquer,
  onDesimbriquer,
  onAjouterA,
  onCollerBlocsApres,
  onNaviguer,
  onNaviguerVertical,
  onSupprimerEtReculer,
  activation,
  onActivationConsommee,
}: {
  tousLesBlocs: BlocEspace[];
  parentBlocId: string | null;
  onChange: (blocId: string, champs: Partial<BlocEspace>) => void;
  onSupprimerBloc: (blocId: string) => void;
  onDeplacer: (idSource: string, idCible: string) => void;
  onImbriquer: (idSource: string, idCibleParent: string) => void;
  onDesimbriquer: (idSource: string) => void;
  onAjouterA: (indexDansFreres: number, parentId: string | null, type: string) => void;
  onCollerBlocsApres: (indexDansFreres: number, parentId: string | null, blocs: { type: string; texte: string }[]) => void;
  onNaviguer: (id: string) => void;
  onNaviguerVertical: (depuisId: string, direction: "haut" | "bas") => void;
  onSupprimerEtReculer: (depuisId: string) => void;
  activation: { id: string; position: "debut" | "fin" } | null;
  onActivationConsommee: () => void;
}) {
  const freres = tousLesBlocs.filter((b) => (b.parent_bloc_id ?? null) === parentBlocId);
  const [menuOuvertPourIndex, setMenuOuvertPourIndex] = useState<number | null>(null);

  return (
    <div className={parentBlocId ? "ml-4 space-y-0.5 border-l border-dj-bordure pl-3" : "space-y-0.5"}>
      {freres.map((b, i) => (
        <div key={b.id}>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const idSource = e.dataTransfer.getData("text/plain");
              if (!idSource) return;
              // Déposer sur la partie droite d'un bloc l'imbrique dedans
              // (devient enfant) ; sur la partie gauche/milieu, réordonne
              // comme frère -- même geste que Notion (27/08/2026).
              const rect = e.currentTarget.getBoundingClientRect();
              const positionRelative = (e.clientX - rect.left) / rect.width;
              if (positionRelative > 0.6) onImbriquer(idSource, b.id);
              else if (idSource !== b.id) onDeplacer(idSource, b.id);
            }}
            className="group/ligne flex items-start gap-1"
          >
            <span
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", b.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              className="mt-1.5 shrink-0 cursor-grab text-dj-texte-muet opacity-0 transition-opacity group-hover/ligne:opacity-100"
              title="Glisser pour réordonner (déposer à droite pour imbriquer)"
            >
              <GripVertical size={13} />
            </span>
            <div className="min-w-0 flex-1">
              <LigneBloc
                bloc={b}
                onChange={onChange}
                onSupprimer={() => onSupprimerBloc(b.id)}
                onIndenter={() => i > 0 && onImbriquer(b.id, freres[i - 1].id)}
                onDesindenter={() => onDesimbriquer(b.id)}
                onNouveauBlocApres={(type) => onAjouterA(i + 1, parentBlocId, type ?? "texte")}
                onCollerApres={(blocsListe) => onCollerBlocsApres(i + 1, parentBlocId, blocsListe)}
                onNaviguer={onNaviguer}
                onNaviguerVertical={(direction) => onNaviguerVertical(b.id, direction)}
                onSupprimerEtReculer={() => onSupprimerEtReculer(b.id)}
                estActif={activation?.id === b.id}
                positionActivation={activation?.id === b.id ? activation.position : "debut"}
                onActivationConsommee={onActivationConsommee}
              />
            </div>
          </div>

          {(b.type === "bascule"
            ? Boolean(b.contenu?.ouvert)
            : tousLesBlocs.some((x) => (x.parent_bloc_id ?? null) === b.id)) && (
            <div className="mt-0.5">
              <ListeBlocs
                tousLesBlocs={tousLesBlocs}
                parentBlocId={b.id}
                onChange={onChange}
                onSupprimerBloc={onSupprimerBloc}
                onDeplacer={onDeplacer}
                onImbriquer={onImbriquer}
                onDesimbriquer={onDesimbriquer}
                onAjouterA={onAjouterA}
                onCollerBlocsApres={onCollerBlocsApres}
                onNaviguer={onNaviguer}
                onNaviguerVertical={onNaviguerVertical}
                onSupprimerEtReculer={onSupprimerEtReculer}
                activation={activation}
                onActivationConsommee={onActivationConsommee}
              />
              {b.type === "bascule" && (
                <div className="relative ml-4 mt-0.5 inline-block pl-3">
                  <button
                    onClick={() => setMenuOuvertPourIndex(menuOuvertPourIndex === i ? null : i)}
                    className="-mx-2 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-dj-texte-muet/70 hover:bg-dj-surface-haute hover:text-dj-texte-muet"
                  >
                    <Plus size={12} /> Ajouter
                  </button>
                  {menuOuvertPourIndex === i && (
                    <MenuAjouterBloc
                      onChoisir={(type) => {
                        setMenuOuvertPourIndex(null);
                        onAjouterA(tousLesBlocs.filter((x) => (x.parent_bloc_id ?? null) === b.id).length, b.id, type);
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// Mise en forme inline + liens de page -- syntaxe maison légère.
// **gras**, *italique*, __souligné__, `code`, [[Titre|pageId]].
// ---------------------------------------------------------------------

const REGEX_FORMAT = /(\*\*.+?\*\*|__.+?__|`.+?`|\*.+?\*|\[\[.+?\|[^\]|]+?\]\])/g;

function RenduTexteFormatte({ texte, onNaviguer }: { texte: string; onNaviguer?: (id: string) => void }) {
  const morceaux = texte.split(REGEX_FORMAT);
  return (
    <>
      {morceaux.map((m, i) => {
        if (m.startsWith("[[") && m.endsWith("]]")) {
          const interieur = m.slice(2, -2);
          const idxSep = interieur.lastIndexOf("|");
          const titre = idxSep === -1 ? interieur : interieur.slice(0, idxSep);
          const id = idxSep === -1 ? "" : interieur.slice(idxSep + 1);
          return (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                if (id && onNaviguer) onNaviguer(id);
              }}
              className="rounded bg-dj-surface-haute px-1 py-0.5 text-dj-texte hover:underline"
            >
              📄 {titre}
            </button>
          );
        }
        if (m.startsWith("**") && m.endsWith("**") && m.length >= 4) return <strong key={i}>{m.slice(2, -2)}</strong>;
        if (m.startsWith("__") && m.endsWith("__") && m.length >= 4) return <u key={i}>{m.slice(2, -2)}</u>;
        if (m.startsWith("`") && m.endsWith("`") && m.length >= 2)
          return (
            <code key={i} className="rounded bg-dj-surface-haute px-1 py-0.5 font-mono text-[0.85em]">
              {m.slice(1, -1)}
            </code>
          );
        if (m.startsWith("*") && m.endsWith("*") && m.length >= 2) return <em key={i}>{m.slice(1, -1)}</em>;
        return <span key={i}>{m}</span>;
      })}
    </>
  );
}

function BarreFormatage({ onFormat }: { onFormat: (marque: string) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-dj-bordure bg-dj-surface p-0.5 shadow-lg">
      <button onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("**")} className="flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-dj-texte hover:bg-dj-surface-haute" title="Gras">
        B
      </button>
      <button onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("*")} className="flex h-6 w-6 items-center justify-center rounded text-xs italic text-dj-texte hover:bg-dj-surface-haute" title="Italique">
        I
      </button>
      <button onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("__")} className="flex h-6 w-6 items-center justify-center rounded text-xs underline text-dj-texte hover:bg-dj-surface-haute" title="Souligné">
        U
      </button>
      <button onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat("`")} className="flex h-6 w-6 items-center justify-center rounded font-mono text-[10px] text-dj-texte hover:bg-dj-surface-haute" title="Code">
        {"</>"}
      </button>
    </div>
  );
}

// Détecte un déclencheur de lien de page en cours de frappe juste avant
// le curseur : "[[" non refermé, ou "@" sans espace depuis. Renvoie la
// position de début du déclencheur + la requête tapée depuis.
function detecterDeclencheurLien(texte: string, curseur: number): { debut: number; requete: string } | null {
  const avant = texte.slice(0, curseur);
  const idxCrochets = avant.lastIndexOf("[[");
  if (idxCrochets !== -1 && !avant.slice(idxCrochets).includes("]]")) {
    return { debut: idxCrochets, requete: avant.slice(idxCrochets + 2) };
  }
  const idxArobase = avant.lastIndexOf("@");
  if (idxArobase !== -1) {
    const depuis = avant.slice(idxArobase + 1);
    if (!/\s/.test(depuis) && depuis.length < 40) {
      return { debut: idxArobase, requete: depuis };
    }
  }
  return null;
}

// Raccourcis markdown en tapant : "# " -> titre, "- "/"* " -> liste à
// puces, "1. " -> liste numérotée, "> " -> citation, "[] "/"[ ] " ->
// case à cocher -- comme Notion, converti dès la frappe de l'espace qui
// suit le marqueur, marqueur retiré (demande Bourama, 27/08/2026).
function detecterRaccourciMarkdown(v: string): { type: string; reste: string } | null {
  let m: RegExpMatchArray | null;
  if ((m = v.match(/^#{1,3} ([\s\S]*)$/))) return { type: "titre", reste: m[1] };
  if ((m = v.match(/^[-*] ([\s\S]*)$/))) return { type: "liste_puces", reste: m[1] };
  if ((m = v.match(/^\d+\. ([\s\S]*)$/))) return { type: "liste_numerotee", reste: m[1] };
  if ((m = v.match(/^> ([\s\S]*)$/))) return { type: "citation", reste: m[1] };
  if ((m = v.match(/^\[ ?\] ([\s\S]*)$/))) return { type: "case_a_cocher", reste: m[1] };
  return null;
}

// Découpe un texte collé (potentiellement multi-lignes/markdown) en
// blocs typés -- réutilise le même détecteur que la frappe.
function decouperTexteEnBlocs(texte: string): { type: string; texte: string }[] {
  return texte
    .split("\n")
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne.length > 0)
    .map((ligne) => {
      const conv = detecterRaccourciMarkdown(ligne);
      if (conv) return { type: conv.type, texte: conv.reste };
      if (/^---+$/.test(ligne)) return { type: "separateur", texte: "" };
      return { type: "texte", texte: ligne };
    });
}

function extraireIdYoutube(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------
// Un bloc, selon son type -- "/" pour changer de type, "[[" ou "@" pour
// lier une page, Entrée pour créer un nouveau bloc juste après, barre
// de mise en forme au survol d'une sélection.
// ---------------------------------------------------------------------

function LigneBloc({
  bloc,
  onChange,
  onSupprimer,
  onIndenter,
  onDesindenter,
  onNouveauBlocApres,
  onCollerApres,
  onNaviguer,
  onNaviguerVertical,
  onSupprimerEtReculer,
  estActif,
  positionActivation,
  onActivationConsommee,
}: {
  bloc: BlocEspace;
  onChange: (blocId: string, champs: Partial<BlocEspace>) => void;
  onSupprimer: () => void;
  onIndenter: () => void;
  onDesindenter: () => void;
  onNouveauBlocApres: (type?: string) => void;
  onCollerApres: (blocs: { type: string; texte: string }[]) => void;
  onNaviguer: (id: string) => void;
  onNaviguerVertical: (direction: "haut" | "bas") => void;
  onSupprimerEtReculer: () => void;
  estActif: boolean;
  positionActivation: "debut" | "fin";
  onActivationConsommee: () => void;
}) {
  const [enEdition, setEnEdition] = useState(estActif);
  const cle = bloc.type === "equation" ? "latex" : "texte";
  const [valeur, setValeur] = useState((bloc.contenu?.[cle] as string) ?? "");
  const [selection, setSelection] = useState<{ debut: number; fin: number } | null>(null);
  const [lienTrigger, setLienTrigger] = useState<{ debut: number; requete: string } | null>(null);
  const [resultatsLien, setResultatsLien] = useState<PageEspace[]>([]);
  const refZone = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  // Un bloc "activé" (nouveau bloc créé par Entrée, ou cible d'une
  // navigation flèche haut/bas) passe en édition puis récupère le focus
  // avec le curseur au bon endroit -- sans clic, comme Notion. Deux
  // temps : (1) passer en édition pour que le textarea/input existe
  // dans le DOM, (2) le focuser une fois qu'il existe.
  useEffect(() => {
    if (estActif && !enEdition && bloc.type !== "bascule") setEnEdition(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estActif]);

  useEffect(() => {
    if (!estActif) return;
    const zone = refZone.current;
    if (!zone || document.activeElement === zone) return;
    zone.focus();
    const pos = positionActivation === "debut" ? 0 : valeur.length;
    if ("setSelectionRange" in zone) zone.setSelectionRange(pos, pos);
    onActivationConsommee();
  });

  useEffect(() => {
    if (!lienTrigger) {
      setResultatsLien([]);
      return;
    }
    rechercherPages(lienTrigger.requete).then(setResultatsLien);
  }, [lienTrigger?.requete]);

  async function enregistrer() {
    setEnEdition(false);
    setSelection(null);
    setLienTrigger(null);
    if (valeur === ((bloc.contenu?.[cle] as string) ?? "")) return;
    const contenu = { ...bloc.contenu, [cle]: valeur };
    await modifierBloc(bloc.id, { contenu });
    onChange(bloc.id, { contenu });
  }

  async function convertirEnType(type: string) {
    setValeur("");
    setEnEdition(false);
    await modifierBloc(bloc.id, { type, contenu: {} });
    onChange(bloc.id, { type, contenu: {} });
  }

  // Raccourci markdown en tapant ("# ", "- ", "1. ", "> ", "[] ") --
  // convertit le bloc courant sans effacer ni quitter l'édition,
  // contrairement à convertirEnType (utilisée par le menu slash) qui
  // repart d'un bloc vide (demande Bourama, 27/08/2026).
  async function convertirEnTypeAvecTexte(type: string, texte: string) {
    const cleNouvelle = type === "equation" ? "latex" : "texte";
    const contenu = { [cleNouvelle]: texte };
    setValeur(texte);
    await modifierBloc(bloc.id, { type, contenu });
    onChange(bloc.id, { type, contenu });
    requestAnimationFrame(() => {
      const zone = refZone.current;
      if (zone) {
        zone.focus();
        if ("setSelectionRange" in zone) zone.setSelectionRange(texte.length, texte.length);
      }
    });
  }

  function appliquerFormat(marque: string) {
    const zone = refZone.current;
    if (!zone || zone.selectionStart === null || zone.selectionEnd === null) return;
    const debut = zone.selectionStart;
    const fin = zone.selectionEnd;
    if (debut === fin) return;
    const nouveau = `${valeur.slice(0, debut)}${marque}${valeur.slice(debut, fin)}${marque}${valeur.slice(fin)}`;
    setValeur(nouveau);
    requestAnimationFrame(() => {
      zone.focus();
      zone.setSelectionRange(debut + marque.length, fin + marque.length);
    });
  }

  function surSelection() {
    const zone = refZone.current;
    if (zone && zone.selectionStart !== zone.selectionEnd) setSelection({ debut: zone.selectionStart!, fin: zone.selectionEnd! });
    else setSelection(null);
  }

  function surChangement(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    if (bloc.type === "texte") {
      const conv = detecterRaccourciMarkdown(v);
      if (conv) {
        convertirEnTypeAvecTexte(conv.type, conv.reste);
        return;
      }
    }
    setValeur(v);
    const curseur = e.target.selectionStart ?? v.length;
    setLienTrigger(detecterDeclencheurLien(v, curseur));
  }

  // Collage markdown multi-lignes -- éclate en plusieurs blocs typés au
  // lieu de tout déverser en texte brut dans un seul bloc (demande
  // Bourama, 27/08/2026). Un collage simple (une ligne, pas de syntaxe
  // markdown de bloc) garde le comportement natif du navigateur.
  async function surCollage(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const texte = e.clipboardData.getData("text/plain");
    if (!texte.includes("\n")) return;
    const blocsACreer = decouperTexteEnBlocs(texte);
    if (blocsACreer.length === 0) return;
    e.preventDefault();
    // Le premier bloc collé remplace le contenu du bloc courant (s'il
    // était vide) ou continue le texte déjà tapé ; les suivants sont
    // insérés juste après.
    const [premier, ...suite] = blocsACreer;
    const nouveauTexte = valeur + premier.texte;
    await convertirEnTypeAvecTexte(premier.type, nouveauTexte);
    if (suite.length > 0) onCollerApres(suite);
  }

  function choisirLien(p: PageEspace) {
    const zone = refZone.current;
    if (!zone || !lienTrigger) return;
    const curseur = zone.selectionStart ?? valeur.length;
    const nouveau = `${valeur.slice(0, lienTrigger.debut)}[[${(p.titre || "Sans titre").replace(/[[\]|]/g, "")}|${p.id}]] ${valeur.slice(curseur)}`;
    setValeur(nouveau);
    setLienTrigger(null);
    requestAnimationFrame(() => zone.focus());
  }

  const menuSlash = !lienTrigger && valeur.startsWith("/") && bloc.type !== "equation";
  const requeteSlash = valeur.slice(1);

  function surTouche(e: React.KeyboardEvent) {
    if (lienTrigger) {
      if (e.key === "Escape") {
        e.preventDefault();
        setLienTrigger(null);
      }
      return;
    }
    if (menuSlash) {
      if (e.key === "Escape") {
        e.preventDefault();
        setValeur("");
      }
      return;
    }

    const zone = refZone.current;
    const curseur = zone?.selectionStart ?? 0;
    const finSelection = zone?.selectionEnd ?? 0;
    const pasDeSelection = curseur === finSelection;

    // Flèche haut sur la première ligne (ou bas sur la dernière) du
    // bloc -> passe au bloc précédent/suivant, sans clic, comme Notion.
    if (e.key === "ArrowUp" && pasDeSelection && valeur.slice(0, curseur).indexOf("\n") === -1) {
      e.preventDefault();
      enregistrer();
      onNaviguerVertical("haut");
      return;
    }
    if (e.key === "ArrowDown" && pasDeSelection && valeur.slice(curseur).indexOf("\n") === -1) {
      e.preventDefault();
      enregistrer();
      onNaviguerVertical("bas");
      return;
    }
    // Retour arrière sur un bloc déjà vide -> le supprime et recule
    // dans le bloc précédent, comme Notion (jamais pour "bascule",
    // qui peut contenir d'autres blocs -- suppression accidentelle
    // trop risquée pour un simple Retour arrière).
    if (e.key === "Backspace" && valeur === "" && curseur === 0 && finSelection === 0 && bloc.type !== "bascule") {
      e.preventDefault();
      onSupprimerEtReculer();
      return;
    }

    // Tab / Shift+Tab -- imbrique/désimbrique le bloc, quel que soit son
    // type (avant, réservé au seul bloc "bascule"). Demande Bourama,
    // 27/08/2026.
    if (e.key === "Tab") {
      e.preventDefault();
      enregistrer();
      if (e.shiftKey) onDesindenter();
      else onIndenter();
      return;
    }

    // "---" puis Entrée -> ligne de séparation, comme Notion.
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && bloc.type === "texte" && /^---+$/.test(valeur.trim())) {
      e.preventDefault();
      convertirEnType("separateur");
      onNouveauBlocApres();
      return;
    }

    // Ctrl/Cmd+Entrée, comme Shift+Entrée : saut de ligne DANS le bloc,
    // ne le quitte pas -- ne pas intercepter, laisser le textarea gérer.
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const continuation = TYPES_CONTINUATION[bloc.type];
      if (continuation && valeur.trim() === "") {
        // Ligne vide dans une liste/case à cocher -> en sort (devient
        // texte) au lieu de créer un nouveau bloc, comme Notion.
        convertirEnType("texte");
        return;
      }
      enregistrer();
      onNouveauBlocApres(continuation);
    }
    if (e.key === "Escape") {
      setEnEdition(false);
      setValeur((bloc.contenu?.[cle] as string) ?? "");
    }
  }

  if (bloc.type === "separateur") {
    return (
      <div className="group -mx-2 flex items-center gap-2 rounded-md px-2 py-1.5">
        <hr className="flex-1 border-dj-bordure" />
        <button onClick={onSupprimer} className="text-dj-texte-muet opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100">
          <Trash2 size={13} />
        </button>
      </div>
    );
  }

  if (bloc.type === "bascule") {
    return (
      <div className="group flex items-center gap-1 -mx-2 rounded-md px-2 py-1 hover:bg-dj-surface-haute/60">
        <button
          onClick={async () => {
            const contenu = { ...bloc.contenu, ouvert: !bloc.contenu?.ouvert };
            await modifierBloc(bloc.id, { contenu });
            onChange(bloc.id, { contenu });
          }}
          className="shrink-0 text-dj-texte-muet"
        >
          {bloc.contenu?.ouvert ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <input
          ref={refZone as React.RefObject<HTMLInputElement>}
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          onBlur={async () => {
            if (valeur === ((bloc.contenu?.texte as string) ?? "")) return;
            const contenu = { ...bloc.contenu, texte: valeur };
            await modifierBloc(bloc.id, { contenu });
            onChange(bloc.id, { contenu });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
              e.preventDefault();
              e.currentTarget.blur();
              onNouveauBlocApres();
              return;
            }
            if (e.key === "ArrowUp" && e.currentTarget.selectionStart === e.currentTarget.selectionEnd) {
              e.preventDefault();
              e.currentTarget.blur();
              onNaviguerVertical("haut");
              return;
            }
            if (e.key === "ArrowDown" && e.currentTarget.selectionStart === e.currentTarget.selectionEnd) {
              e.preventDefault();
              e.currentTarget.blur();
              onNaviguerVertical("bas");
            }
          }}
          placeholder="Bascule sans titre"
          className="flex-1 bg-transparent text-sm font-medium text-dj-texte outline-none placeholder:text-dj-texte-muet/50"
        />
        <button onClick={onSupprimer} className="shrink-0 text-dj-texte-muet opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100">
          <Trash2 size={13} />
        </button>
      </div>
    );
  }

  if (bloc.type === "image") {
    return (
      <div className="group relative -mx-2 rounded-md px-2 py-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={String(bloc.contenu?.url ?? "")}
          alt={String(bloc.contenu?.nom ?? "")}
          className="max-h-[420px] w-full rounded-md object-contain"
        />
        <button
          onClick={onSupprimer}
          className="absolute right-3 top-1 rounded-md bg-dj-fond/80 p-1.5 text-dj-texte-muet opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
        >
          <Trash2 size={13} />
        </button>
      </div>
    );
  }

  if (bloc.type === "fichier") {
    return (
      <div className="group -mx-2 flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-dj-surface-haute/60">
        <a
          href={String(bloc.contenu?.url ?? "")}
          target="_blank"
          rel="noreferrer"
          className="flex min-w-0 items-center gap-2 text-sm text-dj-texte hover:underline"
        >
          <IconFichier size={15} className="shrink-0" />
          <span className="truncate">{String(bloc.contenu?.nom ?? "Fichier")}</span>
        </a>
        <button onClick={onSupprimer} className="shrink-0 text-dj-texte-muet opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100">
          <Trash2 size={13} />
        </button>
      </div>
    );
  }

  if (bloc.type === "video" || bloc.type === "embed") {
    const url = String(bloc.contenu?.url ?? "");
    if (!url) {
      return (
        <div className="group -mx-2 flex items-center gap-2 rounded-md px-2 py-1.5">
          <input
            placeholder={bloc.type === "video" ? "Colle un lien vidéo (YouTube…) puis Entrée" : "Colle un lien à intégrer puis Entrée"}
            onKeyDown={async (e) => {
              if (e.key === "Enter" && e.currentTarget.value.trim()) {
                const contenu = { url: e.currentTarget.value.trim() };
                await modifierBloc(bloc.id, { contenu });
                onChange(bloc.id, { contenu });
              }
            }}
            className="w-full rounded-md border border-dj-bordure bg-dj-surface px-2 py-1 text-sm outline-none"
          />
          <button onClick={onSupprimer} className="shrink-0 text-dj-texte-muet opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100">
            <Trash2 size={13} />
          </button>
        </div>
      );
    }
    const idYoutube = bloc.type === "video" ? extraireIdYoutube(url) : null;
    return (
      <div className="group -mx-2 rounded-md px-2 py-1">
        {idYoutube ? (
          <iframe src={`https://www.youtube.com/embed/${idYoutube}`} className="aspect-video w-full rounded-md" allowFullScreen />
        ) : bloc.type === "video" ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={url} controls className="w-full rounded-md" />
        ) : (
          <iframe src={url} className="h-96 w-full rounded-md border border-dj-bordure" />
        )}
        <div className="mt-1 flex items-center justify-between">
          <a href={url} target="_blank" rel="noreferrer" className="text-xs text-dj-texte-muet hover:text-dj-texte hover:underline">
            Ouvrir dans un nouvel onglet
          </a>
          <button onClick={onSupprimer} className="text-dj-texte-muet opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    );
  }

  const classesParType: Record<string, string> = {
    titre: "font-display text-xl font-bold",
    liste_puces: "before:content-['•_'] before:text-dj-texte-muet",
    liste_numerotee: "before:content-['–_'] before:text-dj-texte-muet",
    citation: "border-l-2 border-dj-inactif pl-3 italic text-dj-texte-muet",
  };

  return (
    <div className="group -mx-2 flex items-start gap-2 rounded-md px-2 py-1 transition-colors hover:bg-dj-surface-haute/60">
      {bloc.type === "case_a_cocher" && (
        <input
          type="checkbox"
          className="mt-1.5 shrink-0"
          checked={Boolean(bloc.contenu?.coche)}
          onChange={async (e) => {
            const contenu = { ...bloc.contenu, coche: e.target.checked };
            await modifierBloc(bloc.id, { contenu });
            onChange(bloc.id, { contenu });
          }}
        />
      )}
      <div className={`relative min-w-0 flex-1 text-sm text-dj-texte ${classesParType[bloc.type] ?? ""}`}>
        {enEdition && selection && bloc.type !== "equation" && (
          <div className="absolute -top-9 left-0 z-10">
            <BarreFormatage onFormat={appliquerFormat} />
          </div>
        )}
        {enEdition ? (
          bloc.type === "equation" ? (
            <input
              ref={refZone as React.RefObject<HTMLInputElement>}
              autoFocus
              value={valeur}
              onChange={(e) => setValeur(e.target.value)}
              onBlur={enregistrer}
              onKeyDown={surTouche}
              placeholder="ex : x^2 + y^2 = r^2"
              className="w-full rounded-md border border-dj-bordure-forte bg-dj-surface px-2 py-1 font-mono text-sm outline-none"
            />
          ) : (
            <>
              <textarea
                ref={refZone as React.RefObject<HTMLTextAreaElement>}
                autoFocus
                value={valeur}
                onChange={surChangement}
                onPaste={surCollage}
                onSelect={surSelection}
                onBlur={enregistrer}
                onKeyDown={surTouche}
                rows={Math.max(1, valeur.split("\n").length)}
                placeholder="Écris, tape / pour changer le type, [[ pour lier une page…"
                className="w-full resize-none bg-transparent outline-none"
              />
              {menuSlash && (
                <div className="absolute left-0 top-full z-10 mt-1 w-56 space-y-0.5 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-1.5 shadow-lg">
                  {TYPES_BLOCS.filter((t) => t.label.toLowerCase().includes(requeteSlash.toLowerCase())).map((t) => (
                    <button
                      key={t.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => convertirEnType(t.id)}
                      className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-dj-texte hover:bg-dj-surface-haute"
                    >
                      {t.label}
                    </button>
                  ))}
                  {TYPES_BLOCS.filter((t) => t.label.toLowerCase().includes(requeteSlash.toLowerCase())).length === 0 && (
                    <p className="px-2 py-1 text-xs text-dj-texte-muet">Aucun type ne correspond.</p>
                  )}
                </div>
              )}
              {lienTrigger && (
                <div className="absolute left-0 top-full z-10 mt-1 max-h-56 w-64 space-y-0.5 overflow-y-auto rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-1.5 shadow-lg">
                  {resultatsLien.length === 0 ? (
                    <p className="px-2 py-1 text-xs text-dj-texte-muet">
                      {lienTrigger.requete ? "Aucune page ne correspond." : "Tape le nom d'une page…"}
                    </p>
                  ) : (
                    resultatsLien.map((p) => (
                      <button
                        key={p.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => choisirLien(p)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-dj-texte hover:bg-dj-surface-haute"
                      >
                        {p.icone ? <span>{p.icone}</span> : <FileText size={12} className="text-dj-texte-muet" />}
                        <span className="truncate">{p.titre || "Sans titre"}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )
        ) : (
          <div onClick={() => setEnEdition(true)} className="min-h-[1.5rem] cursor-text">
            {bloc.type === "equation" ? (
              valeur ? (
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{`$$${valeur}$$`}</ReactMarkdown>
              ) : (
                <span className="text-dj-texte-muet">Clique pour écrire une équation…</span>
              )
            ) : valeur ? (
              <RenduTexteFormatte texte={valeur} onNaviguer={onNaviguer} />
            ) : (
              <span className="text-dj-texte-muet">Clique pour écrire…</span>
            )}
          </div>
        )}
      </div>
      <button onClick={onSupprimer} className="shrink-0 text-dj-texte-muet opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100">
        <Trash2 size={13} />
      </button>
    </div>
  );
}
