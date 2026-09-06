"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  GitMerge,
  Upload,
  Check,
  Minus,
  X,
} from "lucide-react";
import {
  listerMesCodes,
  listerNotions,
  creerNotion,
  renommerNotion,
  changerStatutNotion,
  reordonnerNotions,
  fusionnerNotions,
  supprimerNotion,
  genererStructureNotions,
  type CodePartage,
  type Notion,
  type StatutNotion,
  type NotionProposee,
} from "@/lib/api";
import { messageErreur, ErreurApi } from "@/lib/erreurs";
import { Skeleton } from "./Skeleton";
import { CTACompteRequis } from "./CTACompteRequis";
import { BoutonInfoSection } from "./BoutonInfoSection";
import { SelectPersonnalise, type OptionMenu } from "./SelectPersonnalise";

/**
 * "Programme" (06/09/2026, Partie 2 du chantier "confiance pédagogique"
 * -- voir clovis-plan-travail-10-parties.md et
 * clovis-confiance-pedagogique.md Point 1). Structure de notions à
 * enseigner pour un code de partage donné, avec un statut d'avancement
 * par notion (à venir / en cours / acquis).
 *
 * Nouveau composant séparé de MesCodes.tsx (un code peut porter un
 * programme de notions EN PLUS de ses comportements/dossiers/texte
 * libre existants -- objet de données distinct côté backend, voir
 * djiguigne-backend/core/programme_notions.py). Affiché dans la section
 * Bureau à côté de MesCodes et EspaceEntrerCode.
 *
 * Rattaché à UN code à la fois : un sélecteur en tête de carte laisse
 * choisir lequel (un prof ayant plusieurs codes peut avoir un programme
 * différent par code). Pas de glisser-déposer (voir le document de
 * vision, Point 1 : "statut simple, affiché comme une case à cocher,
 * pas de drag and drop") -- réordonnancement via deux flèches.
 */

const DUREE_SORTIE_MS = 180; // même durée que lib/useFermetureAnimee.ts (DUREE_FERMETURE_MS)

const LIBELLES_STATUT: Record<StatutNotion, string> = {
  a_venir: "À venir",
  en_cours: "En cours",
  acquis: "Acquis",
};

const CYCLE_STATUT: StatutNotion[] = ["a_venir", "en_cours", "acquis"];

function statutSuivant(s: StatutNotion): StatutNotion {
  return CYCLE_STATUT[(CYCLE_STATUT.indexOf(s) + 1) % CYCLE_STATUT.length];
}

/**
 * Case à cocher à 3 états pour le statut d'une notion -- même langage
 * visuel que CaseACocher.tsx (case 4x4, bordure/fond dj-accent-1 une
 * fois pleine), adapté pour l'état intermédiaire "en cours". Un clic
 * fait avancer le cycle à_venir -> en_cours -> acquis -> à_venir.
 */
function CaseStatutNotion({ statut, onChange }: { statut: StatutNotion; onChange: (s: StatutNotion) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(statutSuivant(statut))}
      aria-label={`Statut : ${LIBELLES_STATUT[statut]}. Toucher pour changer.`}
      title={LIBELLES_STATUT[statut]}
      className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
        statut === "acquis"
          ? "border-dj-accent-1 bg-dj-accent-1"
          : statut === "en_cours"
            ? "border-dj-accent-1 bg-dj-surface"
            : "border-dj-bordure bg-dj-surface hover:border-dj-bordure-forte"
      }`}
    >
      {statut === "acquis" && <Check size={11} strokeWidth={3} className="text-[#1A0D02]" />}
      {statut === "en_cours" && <Minus size={11} strokeWidth={3} className="text-dj-accent-1-texte" />}
    </button>
  );
}

type NoeudNotion = Notion & { enfants: NoeudNotion[] };

function construireArbre(notions: Notion[]): NoeudNotion[] {
  const parId = new Map<string, NoeudNotion>();
  notions.forEach((n) => parId.set(n.id, { ...n, enfants: [] }));
  const racines: NoeudNotion[] = [];
  parId.forEach((n) => {
    const parent = n.notion_parent_id ? parId.get(n.notion_parent_id) : undefined;
    if (parent) parent.enfants.push(n);
    else racines.push(n);
  });
  const trier = (liste: NoeudNotion[]) => {
    liste.sort((a, b) => a.ordre - b.ordre);
    liste.forEach((n) => trier(n.enfants));
  };
  trier(racines);
  return racines;
}

/** Aplati l'arbre en options pour le sélecteur de cible de fusion,
 * avec indentation visuelle selon la profondeur -- exclut idExclu (et
 * tous ses descendants, une fusion ne doit jamais créer de cycle, déjà
 * vérifié côté backend mais évite ici de proposer un choix qui
 * échouerait de toute façon). */
function optionsPourFusion(racines: NoeudNotion[], idExclu: string): OptionMenu[] {
  const resultat: OptionMenu[] = [];
  const idsExclus = new Set<string>();
  const marquerExclus = (n: NoeudNotion) => {
    idsExclus.add(n.id);
    n.enfants.forEach(marquerExclus);
  };
  const trouverEtMarquer = (liste: NoeudNotion[]) => {
    for (const n of liste) {
      if (n.id === idExclu) marquerExclus(n);
      else trouverEtMarquer(n.enfants);
    }
  };
  trouverEtMarquer(racines);

  const parcourir = (liste: NoeudNotion[], profondeur: number) => {
    for (const n of liste) {
      if (!idsExclus.has(n.id)) {
        resultat.push({ id: n.id, label: `${"— ".repeat(profondeur)}${n.nom}` });
      }
      parcourir(n.enfants, profondeur + 1);
    }
  };
  parcourir(racines, 0);
  return resultat;
}

export function ProgrammeNotions() {
  const [codes, setCodes] = useState<CodePartage[] | undefined>(undefined);
  const [codeId, setCodeId] = useState<string | null>(null);
  const [notions, setNotions] = useState<Notion[] | undefined>(undefined);
  const [erreur, setErreur] = useState<string | null>(null);
  const [sansCompte, setSansCompte] = useState(false);

  // Lignes en cours de disparition animée (voir supprimer() plus bas) --
  // gardées dans `notions` avec opacity-0/scale réduite le temps de
  // l'animation, puis réellement retirées de l'état.
  const [idsEnSortie, setIdsEnSortie] = useState<Set<string>>(new Set());

  const [ajoutParentId, setAjoutParentId] = useState<string | null>(null); // null = pas d'ajout en cours, "" = ajout à la racine
  const [valeurAjout, setValeurAjout] = useState("");

  const [editionId, setEditionId] = useState<string | null>(null);
  const [valeurEdition, setValeurEdition] = useState("");

  const [fusionPourId, setFusionPourId] = useState<string | null>(null);
  const [cibleFusion, setCibleFusion] = useState("");

  const [ouverts, setOuverts] = useState<Set<string>>(new Set()); // notions dépliées

  const [genererOuvert, setGenererOuvert] = useState(false);
  const [genererEnCours, setGenererEnCours] = useState(false);
  const [structureProposee, setStructureProposee] = useState<NotionProposee[] | null>(null);
  const [erreurGeneration, setErreurGeneration] = useState<string | null>(null);
  const inputFichierRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listerMesCodes()
      .then((c) => {
        setCodes(c);
        if (c.length > 0) setCodeId((prec) => prec ?? c[0].id);
      })
      .catch((e) => {
        if (e instanceof ErreurApi && e.statusCode === 401) setSansCompte(true);
        else setErreur(messageErreur(e));
      });
  }, []);

  function charger() {
    if (!codeId) return;
    listerNotions(codeId)
      .then(setNotions)
      .catch((e) => setErreur(messageErreur(e)));
  }

  useEffect(() => {
    setNotions(undefined);
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeId]);

  if (sansCompte) {
    return <CTACompteRequis texte="Crée un compte pour organiser un programme de notions." />;
  }

  const arbre = notions ? construireArbre(notions) : [];

  function basculerOuvert(id: string) {
    setOuverts((prec) => {
      const copie = new Set(prec);
      if (copie.has(id)) copie.delete(id);
      else copie.add(id);
      return copie;
    });
  }

  async function ajouter(parentId: string | null) {
    const nom = valeurAjout.trim();
    if (!nom || !codeId) return;
    try {
      const creee = await creerNotion(codeId, nom, parentId);
      setNotions((prec) => [...(prec || []), creee]);
      if (parentId) setOuverts((prec) => new Set(prec).add(parentId));
      setValeurAjout("");
      setAjoutParentId(null);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  async function renommer(notionId: string) {
    const nom = valeurEdition.trim();
    if (!nom || !codeId) return;
    try {
      const maj = await renommerNotion(codeId, notionId, nom);
      setNotions((prec) => (prec || []).map((n) => (n.id === notionId ? maj : n)));
      setEditionId(null);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  async function changerStatut(notion: Notion, statut: StatutNotion) {
    if (!codeId) return;
    // Optimiste : le statut est l'action la plus fréquente de cette
    // carte, une case qui met plusieurs centaines de ms à réagir se
    // ressent immédiatement au clic.
    setNotions((prec) => (prec || []).map((n) => (n.id === notion.id ? { ...n, statut } : n)));
    try {
      await changerStatutNotion(codeId, notion.id, statut);
    } catch (e) {
      setErreur(messageErreur(e));
      charger();
    }
  }

  async function deplacer(notion: Notion, direction: -1 | 1) {
    if (!notions || !codeId) return;
    const fratrie = notions
      .filter((n) => n.notion_parent_id === notion.notion_parent_id)
      .sort((a, b) => a.ordre - b.ordre);
    const index = fratrie.findIndex((n) => n.id === notion.id);
    const nouvelIndex = index + direction;
    if (nouvelIndex < 0 || nouvelIndex >= fratrie.length) return;
    const copie = [...fratrie];
    [copie[index], copie[nouvelIndex]] = [copie[nouvelIndex], copie[index]];
    try {
      await reordonnerNotions(codeId, notion.notion_parent_id, copie.map((n) => n.id));
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  async function fusionner(notionSourceId: string) {
    if (!codeId || !cibleFusion) return;
    try {
      await fusionnerNotions(codeId, notionSourceId, cibleFusion);
      setFusionPourId(null);
      setCibleFusion("");
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  function supprimer(notionId: string) {
    if (!codeId) return;
    // Disparition animée (règle transversale du dépôt : pas de
    // disparition brute) -- la ligne (et ses éventuels descendants,
    // supprimés en cascade côté backend) reste montée avec une classe de
    // sortie le temps de l'animation, puis retirée réellement.
    const idsDescendants = new Set<string>([notionId]);
    let changement = true;
    while (changement) {
      changement = false;
      (notions || []).forEach((n) => {
        if (n.notion_parent_id && idsDescendants.has(n.notion_parent_id) && !idsDescendants.has(n.id)) {
          idsDescendants.add(n.id);
          changement = true;
        }
      });
    }
    setIdsEnSortie((prec) => new Set([...prec, ...idsDescendants]));
    setTimeout(() => {
      setNotions((prec) => (prec || []).filter((n) => !idsDescendants.has(n.id)));
      setIdsEnSortie((prec) => {
        const copie = new Set(prec);
        idsDescendants.forEach((id) => copie.delete(id));
        return copie;
      });
    }, DUREE_SORTIE_MS);
    supprimerNotion(codeId, notionId).catch((e) => {
      setErreur(messageErreur(e));
      charger();
    });
  }

  async function choisirFichier(fichier: File) {
    if (!codeId) return;
    setErreurGeneration(null);
    setGenererEnCours(true);
    setStructureProposee(null);
    try {
      const resultat = await genererStructureNotions(codeId, fichier);
      setStructureProposee(resultat.notions);
    } catch (err) {
      setErreurGeneration(messageErreur(err));
    } finally {
      setGenererEnCours(false);
    }
  }

  async function appliquerNoeudPropose(noeud: NotionProposee, parentId: string | null) {
    if (!codeId) return;
    const creee = await creerNotion(codeId, noeud.nom, parentId);
    for (const enfant of noeud.enfants) {
      await appliquerNoeudPropose(enfant, creee.id);
    }
  }

  async function appliquerStructureProposee() {
    if (!structureProposee || !codeId) return;
    setGenererEnCours(true);
    try {
      for (const racine of structureProposee) {
        await appliquerNoeudPropose(racine, null);
      }
      setStructureProposee(null);
      setGenererOuvert(false);
      charger();
    } catch (e) {
      setErreurGeneration(messageErreur(e));
    } finally {
      setGenererEnCours(false);
    }
  }

  function LigneAjout({ parentId }: { parentId: string | null }) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ajouter(parentId);
        }}
        className="flex animate-dj-fade-in-rapide items-center gap-2 rounded-lg border border-dashed border-dj-bordure px-2.5 py-2"
      >
        <input
          autoFocus
          value={valeurAjout}
          onChange={(e) => setValeurAjout(e.target.value)}
          placeholder={parentId ? "Nom de la sous-notion" : "Nom de la notion"}
          className="min-w-0 flex-1 bg-transparent text-sm text-dj-texte outline-none placeholder:text-dj-texte-muet"
        />
        <button type="submit" className="flex-shrink-0 rounded-md bg-dj-accent-1 px-2 py-1 text-xs font-bold text-[#1A0D02]">
          Ajouter
        </button>
        <button
          type="button"
          onClick={() => {
            setAjoutParentId(null);
            setValeurAjout("");
          }}
          className="flex-shrink-0 text-dj-texte-muet"
          aria-label="Annuler"
        >
          <X size={16} />
        </button>
      </form>
    );
  }

  function Ligne({ noeud, profondeur }: { noeud: NoeudNotion; profondeur: number }) {
    const enSortie = idsEnSortie.has(noeud.id);
    const ouvert = ouverts.has(noeud.id);
    const enEdition = editionId === noeud.id;
    const enFusion = fusionPourId === noeud.id;

    return (
      <div
        className={`transition-all duration-150 ${enSortie ? "pointer-events-none scale-[0.98] opacity-0" : "animate-dj-fade-in-rapide opacity-100"}`}
      >
        <div
          style={{ paddingLeft: Math.min(profondeur, 5) * 16 }}
          className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-dj-surface-haute"
        >
          <button
            type="button"
            onClick={() => basculerOuvert(noeud.id)}
            className={`flex h-4 w-4 flex-shrink-0 items-center justify-center text-dj-texte-muet ${noeud.enfants.length === 0 ? "invisible" : ""}`}
            aria-label={ouvert ? "Replier" : "Déplier"}
          >
            {ouvert ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          <CaseStatutNotion statut={noeud.statut} onChange={(s) => changerStatut(noeud, s)} />

          {enEdition ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                renommer(noeud.id);
              }}
              className="flex min-w-0 flex-1 items-center gap-1.5"
            >
              <input
                autoFocus
                value={valeurEdition}
                onChange={(e) => setValeurEdition(e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-dj-bordure bg-dj-surface px-1.5 py-0.5 text-sm text-dj-texte outline-none"
              />
              <button type="submit" className="flex-shrink-0 text-dj-accent-1-texte" aria-label="Valider">
                <Check size={15} />
              </button>
              <button type="button" onClick={() => setEditionId(null)} className="flex-shrink-0 text-dj-texte-muet" aria-label="Annuler">
                <X size={15} />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditionId(noeud.id);
                setValeurEdition(noeud.nom);
              }}
              className="min-w-0 flex-1 truncate text-left text-sm text-dj-texte"
              title="Renommer"
            >
              {noeud.nom}
            </button>
          )}

          {!enEdition && (
            <div className="flex flex-shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => deplacer(noeud, -1)}
                className="rounded p-1 text-dj-texte-muet hover:bg-dj-surface hover:text-dj-texte"
                aria-label="Monter"
              >
                <ArrowUp size={13} />
              </button>
              <button
                type="button"
                onClick={() => deplacer(noeud, 1)}
                className="rounded p-1 text-dj-texte-muet hover:bg-dj-surface hover:text-dj-texte"
                aria-label="Descendre"
              >
                <ArrowDown size={13} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setAjoutParentId(noeud.id);
                  setOuverts((prec) => new Set(prec).add(noeud.id));
                }}
                className="rounded p-1 text-dj-texte-muet hover:bg-dj-surface hover:text-dj-texte"
                aria-label="Ajouter une sous-notion"
              >
                <Plus size={13} />
              </button>
              <button
                type="button"
                onClick={() => setFusionPourId(enFusion ? null : noeud.id)}
                className="rounded p-1 text-dj-texte-muet hover:bg-dj-surface hover:text-dj-texte"
                aria-label="Fusionner avec une autre notion"
              >
                <GitMerge size={13} />
              </button>
              <button
                type="button"
                onClick={() => supprimer(noeud.id)}
                className="rounded p-1 text-dj-texte-muet hover:bg-[var(--dj-erreur)]/10 hover:text-[var(--dj-erreur)]"
                aria-label="Supprimer"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>

        {enFusion && (
          <div
            style={{ paddingLeft: Math.min(profondeur, 5) * 16 + 20 }}
            className="mb-1.5 flex animate-dj-fade-in-rapide items-center gap-2"
          >
            <div className="min-w-0 flex-1">
              <SelectPersonnalise
                options={optionsPourFusion(arbre, noeud.id)}
                valeur={cibleFusion}
                onChange={setCibleFusion}
                placeholder="Fusionner dans…"
              />
            </div>
            <button
              type="button"
              disabled={!cibleFusion}
              onClick={() => fusionner(noeud.id)}
              className="flex-shrink-0 rounded-md bg-dj-accent-1 px-2 py-1 text-xs font-bold text-[#1A0D02] disabled:opacity-50"
            >
              Fusionner
            </button>
            <button
              type="button"
              onClick={() => {
                setFusionPourId(null);
                setCibleFusion("");
              }}
              className="flex-shrink-0 text-dj-texte-muet"
              aria-label="Annuler"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {ouvert && (
          <div>
            {noeud.enfants.map((enfant) => (
              <Ligne key={enfant.id} noeud={enfant} profondeur={profondeur + 1} />
            ))}
            {ajoutParentId === noeud.id && (
              <div style={{ paddingLeft: Math.min(profondeur + 1, 5) * 16 }}>
                <LigneAjout parentId={noeud.id} />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <h2 className="font-display text-base font-semibold text-dj-texte">Programme</h2>
          <BoutonInfoSection
            rubriqueId="programme-notions"
            texteCourt="Organise les notions à enseigner pour ce code et coche leur avancement."
          />
        </div>
        {codes && codes.length > 0 && (
          <button
            onClick={() => setGenererOuvert((v) => !v)}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-cgpt-bouton border border-dj-bordure px-3 py-2 text-xs font-bold text-dj-texte transition-colors hover:bg-dj-surface-haute"
          >
            <Upload size={14} /> Importer un document
          </button>
        )}
      </div>

      {erreur && <p className="mt-3 text-sm text-[var(--dj-erreur)]">{erreur}</p>}

      {codes === undefined ? (
        <div className="mt-4 flex flex-col gap-2" aria-hidden>
          <Skeleton className="h-8 w-full rounded-cgpt-bouton" />
          <Skeleton className="h-10 w-full rounded-xl" style={{ animationDelay: "80ms" }} />
          <Skeleton className="h-10 w-4/5 rounded-xl" style={{ animationDelay: "160ms" }} />
        </div>
      ) : codes.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-dj-bordure px-3 py-4 text-center text-xs text-dj-texte-muet">
          Crée d&apos;abord un code (ci-dessus) pour pouvoir lui associer un programme de notions.
        </p>
      ) : (
        <>
          <div className="mt-4">
            <SelectPersonnalise
              options={codes.map((c) => ({ id: c.id, label: c.nom || c.code }))}
              valeur={codeId || ""}
              onChange={(id) => {
                setCodeId(id);
                setGenererOuvert(false);
                setStructureProposee(null);
              }}
            />
          </div>

          {genererOuvert && (
            <div className="mt-3 animate-dj-fade-in-rapide rounded-xl border border-dj-bordure bg-dj-surface-haute p-3">
              {structureProposee ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-dj-texte-muet">
                    Structure proposée -- vérifie avant d&apos;appliquer (les notions existantes ne sont pas touchées) :
                  </p>
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-dj-bordure bg-dj-surface p-2">
                    <ArbrePropose noeuds={structureProposee} profondeur={0} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={appliquerStructureProposee}
                      disabled={genererEnCours}
                      className="rounded-md bg-dj-accent-1 px-3 py-1.5 text-xs font-bold text-[#1A0D02] disabled:opacity-50"
                    >
                      {genererEnCours ? "Application…" : "Appliquer"}
                    </button>
                    <button
                      onClick={() => setStructureProposee(null)}
                      disabled={genererEnCours}
                      className="rounded-md border border-dj-bordure px-3 py-1.5 text-xs font-medium text-dj-texte"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : genererEnCours ? (
                <div className="flex flex-col gap-2" aria-hidden>
                  <Skeleton className="h-3 w-2/3 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" style={{ animationDelay: "80ms" }} />
                  <Skeleton className="h-3 w-3/5 rounded" style={{ animationDelay: "160ms" }} />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-dj-texte-muet">
                    Dépose un document (PDF, Word ou Excel) -- un sommaire, un plan de cours, une table des matières. Une structure
                    de notions te sera proposée pour validation.
                  </p>
                  <input
                    ref={inputFichierRef}
                    type="file"
                    accept=".pdf,.docx,.xlsx"
                    className="hidden"
                    onChange={(e) => {
                      const fichier = e.target.files?.[0];
                      e.target.value = "";
                      if (fichier) choisirFichier(fichier);
                    }}
                  />
                  <button
                    onClick={() => inputFichierRef.current?.click()}
                    className="self-start rounded-md border border-dj-bordure px-3 py-1.5 text-xs font-medium text-dj-texte hover:bg-dj-surface"
                  >
                    Choisir un fichier
                  </button>
                  {erreurGeneration && <p className="text-xs text-[var(--dj-erreur)]">{erreurGeneration}</p>}
                </div>
              )}
            </div>
          )}

          <div className="mt-4">
            {notions === undefined ? (
              <div className="flex flex-col gap-2" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-8 w-full rounded-lg" style={{ animationDelay: `${i * 80}ms` }} />
                ))}
              </div>
            ) : (
              <>
                {arbre.length === 0 && ajoutParentId !== "" && (
                  <p className="rounded-xl border border-dashed border-dj-bordure px-3 py-4 text-center text-xs text-dj-texte-muet">
                    Aucune notion pour l&apos;instant.
                  </p>
                )}
                <div className="flex flex-col gap-0.5">
                  {arbre.map((noeud) => (
                    <Ligne key={noeud.id} noeud={noeud} profondeur={0} />
                  ))}
                </div>
                <div className="mt-2">
                  {ajoutParentId === "" ? (
                    <LigneAjout parentId={null} />
                  ) : (
                    <button
                      onClick={() => setAjoutParentId("")}
                      className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-dj-accent-1-texte hover:bg-dj-surface-haute"
                    >
                      <Plus size={14} /> Nouvelle notion
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** Affichage en lecture seule de l'arbre proposé par la génération,
 * avant application -- pas d'édition ici (le prof édite en éditant
 * chaque notion normalement une fois créée, voir docstring de
 * api/programme_notions.py::generer côté backend). */
function ArbrePropose({ noeuds, profondeur }: { noeuds: NotionProposee[]; profondeur: number }) {
  return (
    <ul>
      {noeuds.map((n, i) => (
        <li key={i} style={{ paddingLeft: Math.min(profondeur, 5) * 16 }} className="py-0.5 text-xs text-dj-texte">
          {n.nom}
          {n.enfants.length > 0 && <ArbrePropose noeuds={n.enfants} profondeur={profondeur + 1} />}
        </li>
      ))}
    </ul>
  );
}
