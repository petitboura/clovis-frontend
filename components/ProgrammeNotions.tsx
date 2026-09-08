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
  Pencil,
} from "lucide-react";
import {
  listerMesCodes,
  listerNotions,
  creerNotion,
  renommerNotion,
  changerStatutNotion,
  definirRegleNotion,
  definirConsigneNotion,
  reordonnerNotions,
  fusionnerNotions,
  supprimerNotion,
  genererStructureNotions,
  type CodePartage,
  type Notion,
  type StatutNotion,
  type RegleComportementNotion,
  type NotionProposee,
} from "@/lib/api";
import { messageErreur, ErreurApi } from "@/lib/erreurs";
import { Skeleton } from "./Skeleton";
import { CTACompteRequis } from "./CTACompteRequis";
import { BoutonInfoSection } from "./BoutonInfoSection";
import { SelectPersonnalise, type OptionMenu } from "./SelectPersonnalise";
import { PanneauFlottant } from "./PanneauFlottant";

/**
 * "Programme" (06/09/2026, Partie 2 du chantier "confiance pédagogique"
 * -- voir clovis-plan-travail-10-parties.md et
 * clovis-confiance-pedagogique.md Point 1). Structure de notions à
 * enseigner pour un code de partage donné, avec un statut d'avancement
 * par notion (à venir / en cours / acquis).
 *
 * 08/09/2026, refonte visuelle complète demandée par Bourama : la liste
 * plate à cliquer-pour-déplier ("on ne comprend rien") devient un
 * regroupement à 2 niveaux -- Matière (bandeau coloré) puis Chapitre
 * (sous-groupe), chacun dépliable/repliable, avec tout le reste
 * (Partie/Notion/plus profond si besoin, l'arborescence reste libre --
 * voir docstring backend core/programme_notions.py) affiché À PLAT en
 * dessous, sans autre clic pour dérouler : chaque ligne montre le fil
 * d'ancêtres intermédiaires en petit au-dessus de son nom, et une
 * pastille de statut colorée cliquable. Cliquer une ligne (hors
 * pastille) ouvre un panneau d'édition unique (nom, statut, règle
 * bloquer/contourner/signaler, consigne texte libre pour l'IA,
 * réordonner/fusionner/supprimer/ajouter) -- toutes les actions
 * autrefois éparpillées en icônes sur chaque ligne sont regroupées là,
 * pour que la liste elle-même reste lisible d'un coup d'oeil.
 *
 * Rattaché à UN code à la fois : un sélecteur en tête de carte laisse
 * choisir lequel (un prof ayant plusieurs codes peut avoir un programme
 * différent par code).
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

const LIBELLES_REGLE: Record<RegleComportementNotion, string> = {
  bloquer: "Bloquer",
  contourner: "Contourner",
  signaler: "Signaler",
};

const OPTIONS_REGLE: OptionMenu[] = [
  { id: "", label: "Aucune règle" },
  { id: "bloquer", label: "Bloquer" },
  { id: "contourner", label: "Contourner" },
  { id: "signaler", label: "Signaler" },
];

/** 5 teintes cyclées par index de matière -- voir app/globals.css pour
 * la justification de cette dérogation scopée à "usage mesuré des
 * couleurs" (la couleur EST l'information ici, pas de la décoration). */
const COULEURS_MATIERE = [1, 2, 3, 4, 5].map((n) => ({
  conteneur: `var(--dj-mat-${n}-conteneur)`,
  texte: `var(--dj-mat-${n})`,
}));

/**
 * Pastille de statut colorée -- remplace l'ancienne case à cocher 4x4
 * (trop discrète pour porter, à elle seule, la lisibilité visuelle
 * demandée). Mêmes 3 états, même cycle au clic, mais en pilule colorée
 * pour se voir au premier coup d'oeil dans une liste dense.
 */
function PastilleStatut({ statut, onChange }: { statut: StatutNotion; onChange: (s: StatutNotion) => void }) {
  const styleParStatut: Record<StatutNotion, string> = {
    a_venir: "border border-dj-bordure bg-dj-surface-haute text-dj-texte-muet",
    en_cours: "border border-transparent bg-[var(--dj-accent-1-conteneur)] text-dj-accent-1-texte",
    acquis: "border border-transparent bg-[var(--dj-succes-conteneur)] text-dj-succes",
  };
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange(statutSuivant(statut));
      }}
      aria-label={`Statut : ${LIBELLES_STATUT[statut]}. Toucher pour changer.`}
      title={LIBELLES_STATUT[statut]}
      className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${styleParStatut[statut]}`}
    >
      {LIBELLES_STATUT[statut]}
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

/** Aplati l'arbre en options pour le sélecteur de cible de fusion, avec
 * indentation visuelle selon la profondeur -- exclut idExclu (et tous
 * ses descendants, une fusion ne doit jamais créer de cycle, déjà
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

/** Aplatit tout ce qu'il y a sous un chapitre (Partie, Notion, et plus
 * profond si le prof a réorganisé librement -- l'arborescence reste
 * libre côté backend) en une simple liste ordonnée, avec le fil des
 * noms d'ancêtres intermédiaires (entre le chapitre et le noeud, les
 * deux exclus) pour affichage en petit au-dessus du nom. */
type LigneAplatie = { noeud: NoeudNotion; chemin: string[] };

function aplatirSousChapitre(noeud: NoeudNotion, chemin: string[] = []): LigneAplatie[] {
  const resultat: LigneAplatie[] = [];
  for (const enfant of noeud.enfants) {
    resultat.push({ noeud: enfant, chemin });
    resultat.push(...aplatirSousChapitre(enfant, [...chemin, enfant.nom]));
  }
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

  const [ajoutParentId, setAjoutParentId] = useState<string | null>(null); // null = pas d'ajout en cours, "" = ajout à la racine (nouvelle matière)
  const [valeurAjout, setValeurAjout] = useState("");

  const [ouverts, setOuverts] = useState<Set<string>>(new Set()); // matières/chapitres dépliés

  // Panneau d'édition unique (nom, statut, règle, consigne, actions) --
  // remplace l'ancien état d'édition inline dispersé sur chaque ligne.
  const [notionEnEditionId, setNotionEnEditionId] = useState<string | null>(null);
  const [formNom, setFormNom] = useState("");
  const [formRegle, setFormRegle] = useState("");
  const [formConsigne, setFormConsigne] = useState("");
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
  const [erreurEdition, setErreurEdition] = useState<string | null>(null);
  const [fusionOuverte, setFusionOuverte] = useState(false);
  const [cibleFusion, setCibleFusion] = useState("");

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
  const notionEnEdition = notionEnEditionId ? (notions || []).find((n) => n.id === notionEnEditionId) : undefined;

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

  async function changerStatut(notion: Notion, statut: StatutNotion) {
    if (!codeId) return;
    // Optimiste : le statut est l'action la plus fréquente de cette
    // carte, une pastille qui met plusieurs centaines de ms à réagir se
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
      setFusionOuverte(false);
      setCibleFusion("");
      setNotionEnEditionId(null);
      charger();
    } catch (e) {
      setErreurEdition(messageErreur(e));
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
    setNotionEnEditionId(null);
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

  function ouvrirEdition(noeud: Notion) {
    setNotionEnEditionId(noeud.id);
    setFormNom(noeud.nom);
    setFormRegle(noeud.regle_comportement || "");
    setFormConsigne(noeud.consigne_llm || "");
    setErreurEdition(null);
    setFusionOuverte(false);
    setCibleFusion("");
  }

  async function enregistrerEdition() {
    if (!codeId || !notionEnEdition) return;
    setEnregistrementEnCours(true);
    setErreurEdition(null);
    try {
      const nomTrim = formNom.trim();
      if (nomTrim && nomTrim !== notionEnEdition.nom) {
        const maj = await renommerNotion(codeId, notionEnEdition.id, nomTrim);
        setNotions((prec) => (prec || []).map((n) => (n.id === maj.id ? maj : n)));
      }
      const regleVoulue = (formRegle || null) as RegleComportementNotion | null;
      if (regleVoulue !== (notionEnEdition.regle_comportement || null)) {
        const maj = await definirRegleNotion(codeId, notionEnEdition.id, regleVoulue);
        setNotions((prec) => (prec || []).map((n) => (n.id === maj.id ? maj : n)));
      }
      const consigneVoulue = formConsigne.trim() || null;
      if (consigneVoulue !== (notionEnEdition.consigne_llm || null)) {
        const maj = await definirConsigneNotion(codeId, notionEnEdition.id, consigneVoulue);
        setNotions((prec) => (prec || []).map((n) => (n.id === maj.id ? maj : n)));
      }
      setNotionEnEditionId(null);
    } catch (e) {
      setErreurEdition(messageErreur(e));
    } finally {
      setEnregistrementEnCours(false);
    }
  }

  function LigneAjout({ parentId, placeholder }: { parentId: string | null; placeholder: string }) {
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
          placeholder={placeholder}
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

  /** Ligne à plat (Partie / Notion / plus profond) : fil d'ancêtres en
   * petit au-dessus du nom, pastille de statut cliquable, tout le reste
   * de l'édition se fait via le panneau (clic n'importe où sur la
   * ligne, hors pastille). */
  function LigneAplatie({ item }: { item: LigneAplatie }) {
    const { noeud, chemin } = item;
    const enSortie = idsEnSortie.has(noeud.id);
    return (
      <div
        className={`transition-all duration-150 ${enSortie ? "pointer-events-none scale-[0.98] opacity-0" : "animate-dj-fade-in-rapide opacity-100"}`}
      >
        <button
          type="button"
          onClick={() => ouvrirEdition(noeud)}
          className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-dj-surface-haute"
        >
          <div className="min-w-0 flex-1">
            {chemin.length > 0 && (
              <div className="truncate text-[11px] text-dj-texte-muet">{chemin.join(" › ")}</div>
            )}
            <div className="truncate text-sm text-dj-texte">{noeud.nom}</div>
          </div>
          <PastilleStatut statut={noeud.statut} onChange={(s) => changerStatut(noeud, s)} />
        </button>
        {ajoutParentId === noeud.id && (
          <div className="pl-4">
            <LigneAjout parentId={noeud.id} placeholder="Nom de la sous-partie" />
          </div>
        )}
      </div>
    );
  }

  /** En-tête de groupe partagé par Matière et Chapitre -- seule la
   * couleur (bandeau plein pour Matière, simple liseré pour Chapitre)
   * change, voir GroupeMatiere/GroupeChapitre plus bas. */
  function EnteteGroupe({
    noeud,
    ouvert,
    onToggle,
    onAjouter,
    style,
    libelleAjout,
  }: {
    noeud: NoeudNotion;
    ouvert: boolean;
    onToggle: () => void;
    onAjouter: () => void;
    style: React.CSSProperties;
    libelleAjout: string;
  }) {
    const enSortie = idsEnSortie.has(noeud.id);
    return (
      <div
        style={style}
        className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-all duration-150 ${
          enSortie ? "pointer-events-none scale-[0.98] opacity-0" : "animate-dj-fade-in-rapide opacity-100"
        }`}
      >
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
          <span className="flex-shrink-0" aria-hidden>
            {noeud.enfants.length > 0 ? (
              ouvert ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )
            ) : (
              <span className="inline-block w-3.5" />
            )}
          </span>
          <span className="truncate font-medium">{noeud.nom}</span>
        </button>
        <button
          type="button"
          onClick={onAjouter}
          className="flex-shrink-0 rounded p-1 opacity-80 hover:opacity-100"
          aria-label={libelleAjout}
          title={libelleAjout}
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          onClick={() => ouvrirEdition(noeud)}
          className="flex-shrink-0 rounded p-1 opacity-80 hover:opacity-100"
          aria-label="Modifier"
          title="Modifier"
        >
          <Pencil size={13} />
        </button>
      </div>
    );
  }

  function GroupeChapitre({ noeud }: { noeud: NoeudNotion }) {
    const ouvert = ouverts.has(noeud.id);
    const lignes = aplatirSousChapitre(noeud);
    return (
      <div className="ml-1">
        <EnteteGroupe
          noeud={noeud}
          ouvert={ouvert}
          onToggle={() => basculerOuvert(noeud.id)}
          onAjouter={() => {
            setAjoutParentId(noeud.id);
            setOuverts((prec) => new Set(prec).add(noeud.id));
          }}
          libelleAjout="Ajouter un élément"
          style={{ color: "var(--dj-texte)", borderLeft: "2px solid var(--dj-bordure)" }}
        />
        {ouvert && (
          <div className="ml-3 flex flex-col gap-0.5 border-l border-dj-bordure pl-2">
            {lignes.length === 0 && ajoutParentId !== noeud.id && (
              <p className="px-2.5 py-1.5 text-xs text-dj-texte-muet">Aucun élément pour l&apos;instant.</p>
            )}
            {lignes.map((item) => (
              <LigneAplatie key={item.noeud.id} item={item} />
            ))}
            {ajoutParentId === noeud.id && <LigneAjout parentId={noeud.id} placeholder="Nom de la partie/notion" />}
          </div>
        )}
      </div>
    );
  }

  function GroupeMatiere({ noeud, index }: { noeud: NoeudNotion; index: number }) {
    const ouvert = ouverts.has(noeud.id);
    const couleur = COULEURS_MATIERE[index % COULEURS_MATIERE.length];
    return (
      <div>
        <EnteteGroupe
          noeud={noeud}
          ouvert={ouvert}
          onToggle={() => basculerOuvert(noeud.id)}
          onAjouter={() => {
            setAjoutParentId(noeud.id);
            setOuverts((prec) => new Set(prec).add(noeud.id));
          }}
          libelleAjout="Ajouter un chapitre"
          style={{ background: couleur.conteneur, color: couleur.texte }}
        />
        {ouvert && (
          <div className="mt-1 flex flex-col gap-2">
            {noeud.enfants.map((enfant) => (
              <GroupeChapitre key={enfant.id} noeud={enfant} />
            ))}
            {ajoutParentId === noeud.id && (
              <div className="ml-1">
                <LigneAjout parentId={noeud.id} placeholder="Nom du chapitre" />
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
            texteCourt="Organise le programme (matière > chapitre > partie > notion) et coche l'avancement."
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
                  <Skeleton key={i} className="h-9 w-full rounded-lg" style={{ animationDelay: `${i * 80}ms` }} />
                ))}
              </div>
            ) : (
              <>
                {arbre.length === 0 && ajoutParentId !== "" && (
                  <p className="rounded-xl border border-dashed border-dj-bordure px-3 py-4 text-center text-xs text-dj-texte-muet">
                    Aucune matière pour l&apos;instant.
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  {arbre.map((noeud, index) => (
                    <GroupeMatiere key={noeud.id} noeud={noeud} index={index} />
                  ))}
                </div>
                <div className="mt-2">
                  {ajoutParentId === "" ? (
                    <LigneAjout parentId={null} placeholder="Nom de la matière" />
                  ) : (
                    <button
                      onClick={() => setAjoutParentId("")}
                      className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-dj-accent-1-texte hover:bg-dj-surface-haute"
                    >
                      <Plus size={14} /> Nouvelle matière
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {notionEnEdition && (
        <PanneauFlottant
          onFerme={() => setNotionEnEditionId(null)}
          entete={
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-dj-texte">Modifier</h3>
              <PastilleStatut statut={notionEnEdition.statut} onChange={(s) => changerStatut(notionEnEdition, s)} />
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-dj-texte-muet">Nom</label>
              <input
                value={formNom}
                onChange={(e) => setFormNom(e.target.value)}
                className="w-full rounded-lg border border-dj-bordure bg-dj-surface px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-dj-texte-muet">
                Règle de comportement (élève, notion pas encore vue)
              </label>
              <SelectPersonnalise options={OPTIONS_REGLE} valeur={formRegle} onChange={setFormRegle} />
              <p className="mt-1 text-[11px] text-dj-texte-muet">
                Bloquer : l&apos;IA n&apos;aide pas tant que ce n&apos;est pas vu en classe. Contourner : elle aide sans utiliser
                cette notion. Signaler : elle aide normalement en le précisant.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-dj-texte-muet">
                Consigne pour l&apos;IA (texte libre, s&apos;applique aussi aux sous-notions sans consigne propre)
              </label>
              <textarea
                value={formConsigne}
                onChange={(e) => setFormConsigne(e.target.value)}
                placeholder="Ex. : toujours donner des exemples avec des fractions de pizza pour cette notion."
                rows={3}
                className="w-full resize-none rounded-lg border border-dj-bordure bg-dj-surface px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
              />
            </div>

            {erreurEdition && <p className="text-xs text-[var(--dj-erreur)]">{erreurEdition}</p>}

            <div className="flex items-center gap-2">
              <button
                onClick={enregistrerEdition}
                disabled={enregistrementEnCours}
                className="rounded-md bg-dj-accent-1 px-3 py-1.5 text-xs font-bold text-[#1A0D02] disabled:opacity-50"
              >
                {enregistrementEnCours ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button
                onClick={() => setNotionEnEditionId(null)}
                className="rounded-md border border-dj-bordure px-3 py-1.5 text-xs font-medium text-dj-texte"
              >
                Annuler
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1 border-t border-dj-bordure pt-3">
              <button
                type="button"
                onClick={() => deplacer(notionEnEdition, -1)}
                className="flex items-center gap-1 rounded p-1.5 text-xs text-dj-texte-muet hover:bg-dj-surface-haute hover:text-dj-texte"
              >
                <ArrowUp size={13} /> Monter
              </button>
              <button
                type="button"
                onClick={() => deplacer(notionEnEdition, 1)}
                className="flex items-center gap-1 rounded p-1.5 text-xs text-dj-texte-muet hover:bg-dj-surface-haute hover:text-dj-texte"
              >
                <ArrowDown size={13} /> Descendre
              </button>
              <button
                type="button"
                onClick={() => {
                  setAjoutParentId(notionEnEdition.id);
                  setOuverts((prec) => new Set(prec).add(notionEnEdition.id));
                  setNotionEnEditionId(null);
                }}
                className="flex items-center gap-1 rounded p-1.5 text-xs text-dj-texte-muet hover:bg-dj-surface-haute hover:text-dj-texte"
              >
                <Plus size={13} /> Sous-élément
              </button>
              <button
                type="button"
                onClick={() => setFusionOuverte((v) => !v)}
                className="flex items-center gap-1 rounded p-1.5 text-xs text-dj-texte-muet hover:bg-dj-surface-haute hover:text-dj-texte"
              >
                <GitMerge size={13} /> Fusionner
              </button>
              <button
                type="button"
                onClick={() => supprimer(notionEnEdition.id)}
                className="flex items-center gap-1 rounded p-1.5 text-xs text-dj-texte-muet hover:bg-[var(--dj-erreur)]/10 hover:text-[var(--dj-erreur)]"
              >
                <Trash2 size={13} /> Supprimer
              </button>
            </div>

            {fusionOuverte && (
              <div className="flex animate-dj-fade-in-rapide items-center gap-2">
                <div className="min-w-0 flex-1">
                  <SelectPersonnalise
                    options={optionsPourFusion(arbre, notionEnEdition.id)}
                    valeur={cibleFusion}
                    onChange={setCibleFusion}
                    placeholder="Fusionner dans…"
                  />
                </div>
                <button
                  type="button"
                  disabled={!cibleFusion}
                  onClick={() => fusionner(notionEnEdition.id)}
                  className="flex-shrink-0 rounded-md bg-dj-accent-1 px-2 py-1 text-xs font-bold text-[#1A0D02] disabled:opacity-50"
                >
                  Fusionner
                </button>
              </div>
            )}
          </div>
        </PanneauFlottant>
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
