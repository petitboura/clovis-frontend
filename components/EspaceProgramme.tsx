"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, Pencil, Plus, Trash2, X, Check, ArrowUp, ArrowDown } from "lucide-react";
import {
  listerProgrammes,
  creerProgramme,
  modifierProgramme,
  supprimerProgramme,
  listerMatieresProgramme,
  creerMatiereProgramme,
  modifierMatiereProgramme,
  supprimerMatiereProgramme,
  listerChapitresMatiere,
  creerChapitreMatiere,
  modifierChapitreMatiere,
  supprimerChapitreMatiere,
  lireClassements,
  listerItemsClassement,
  supprimerClassement,
  supprimerItemClassement,
  type Programme,
  type MatiereDuProgramme,
  type ChapitreDeLaMatiere,
  type Classement,
  type ItemClassement,
  type TypeClassement,
  type CibleClassement,
} from "@/lib/api";
import { messageErreur, ErreurApi } from "@/lib/erreurs";
import { ecouterDonneesModifiees } from "@/lib/evenementsDonnees";
import { Skeleton } from "./Skeleton";
import { CTACompteRequis } from "./CTACompteRequis";
// Lot 5 -- contenu d'un chapitre (documents/exercices), examens/plugin au
// niveau programme, et bouton de classement transversal. Voir
// EspaceProgrammeContenu.tsx / AjouterAClassementBouton.tsx : fichiers
// séparés écrits pendant que ce fichier (lot 4) n'existait pas encore,
// branchés ici a posteriori sans reprendre la navigation elle-même.
import { VueChapitreContenu, VueProgrammeContenu } from "./EspaceProgrammeContenu";
import { SectionDocumentsBibliotheque } from "./SectionDocumentsBibliotheque";
import { SectionComportementsEmplacement } from "./SectionComportementsEmplacement";
import { AjouterAClassementBouton } from "./AjouterAClassementBouton";

// Onglet "Mon programme" (lot 4/5, chantier programme étudiant, brief
// "4-frontend-onglet-navigation.md"). Navigation à 3 niveaux : programmes
// (par niveau/classe) -> matières -> chapitres. Champ "limites" à chaque
// niveau (matière et chapitre) : texte libre décrivant le cadre du
// programme officiel, consulté par l'IA avant de générer du contenu --
// pas de validation front dessus, un champ texte simple.
//
// Contrat backend construit par le lot 1 en parallèle -- voir lib/api.ts.

type Vue =
  | { niveau: "programmes" }
  | { niveau: "matieres"; programme: Programme }
  | { niveau: "chapitres"; programme: Programme; matiere: MatiereDuProgramme }
  | { niveau: "chapitre"; programme: Programme; matiere: MatiereDuProgramme; chapitre: ChapitreDeLaMatiere };

// Onglet parallèle "Classements" (20/08/2026, demande Bourama : jusqu'ici
// AjouterAClassementBouton permettait d'AJOUTER un élément à un
// classement (semestre/année/section) depuis n'importe où, mais rien ne
// permettait de consulter un classement lui-même -- ni sa liste, ni son
// contenu. Onglet séparé de la navigation programme/matière/chapitre
// ci-dessus (un classement transverse par nature, pas rattaché à un
// point précis de cette hiérarchie).
type OngletHaut = "programme" | "classements";

export function EspaceProgramme() {
  const [vue, setVue] = useState<Vue>({ niveau: "programmes" });
  const [ongletHaut, setOngletHaut] = useState<OngletHaut>("programme");

  return (
    <div className="flex animate-dj-fade-in-rapide flex-col gap-4">
      <p className="text-sm text-dj-texte-muet">
        Organise ton programme par classe, matière et chapitre. C&apos;est ce cadre que Clovis respecte quand
        il génère du contenu pour toi, jamais hors programme, jamais hors niveau.
      </p>

      <div className="flex gap-1 self-start rounded-lg border border-dj-bordure bg-dj-surface p-1 text-sm">
        <button
          onClick={() => setOngletHaut("programme")}
          className={`rounded-md px-3 py-1.5 transition-colors ${
            ongletHaut === "programme" ? "bg-dj-accent-1 text-[#1A0D02] font-semibold" : "text-dj-texte-muet hover:text-dj-texte"
          }`}
        >
          Programme
        </button>
        <button
          onClick={() => setOngletHaut("classements")}
          className={`rounded-md px-3 py-1.5 transition-colors ${
            ongletHaut === "classements" ? "bg-dj-accent-1 text-[#1A0D02] font-semibold" : "text-dj-texte-muet hover:text-dj-texte"
          }`}
        >
          Classements
        </button>
      </div>

      {ongletHaut === "classements" && <VueClassements />}

      {ongletHaut === "programme" && (
        <>
      {vue.niveau === "programmes" && <ListeProgrammes onOuvrir={(programme) => setVue({ niveau: "matieres", programme })} />}

      {vue.niveau === "matieres" && (
        <ListeMatieres
          programme={vue.programme}
          onRetour={() => setVue({ niveau: "programmes" })}
          onOuvrir={(matiere) => setVue({ niveau: "chapitres", programme: vue.programme, matiere })}
        />
      )}

      {vue.niveau === "chapitres" && (
        <ListeChapitres
          programme={vue.programme}
          matiere={vue.matiere}
          onRetour={() => setVue({ niveau: "matieres", programme: vue.programme })}
          onOuvrir={(chapitre) => setVue({ niveau: "chapitre", programme: vue.programme, matiere: vue.matiere, chapitre })}
        />
      )}

      {vue.niveau === "chapitre" && (
        <div className="flex flex-col gap-3">
          <FilAriane
            elements={[
              { label: vue.programme.nom || vue.programme.niveau, onClick: () => setVue({ niveau: "matieres", programme: vue.programme }) },
              { label: vue.matiere.nom, onClick: () => setVue({ niveau: "chapitres", programme: vue.programme, matiere: vue.matiere }) },
              { label: vue.chapitre.nom },
            ]}
            onRetour={() => setVue({ niveau: "chapitres", programme: vue.programme, matiere: vue.matiere })}
          />
          <VueChapitreContenu chapitreId={vue.chapitre.id} />
        </div>
      )}
        </>
      )}
    </div>
  );
}

/* ------------------------------- Classements ------------------------------ */

function VueClassements() {
  const [classements, setClassements] = useState<Classement[] | null>(null);
  const [ouvert, setOuvert] = useState<Classement | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  function charger() {
    lireClassements()
      .then(setClassements)
      .catch((e) => setErreur(messageErreur(e)));
  }

  useEffect(() => {
    charger();
  }, []);

  useEffect(() => ecouterDonneesModifiees("programme", charger), []);

  async function supprimer(c: Classement) {
    if (!window.confirm(`Supprimer le classement « ${c.label} » ? Les éléments qu'il contenait ne seront pas supprimés.`)) return;
    try {
      await supprimerClassement(c.id);
      setClassements((prec) => (prec || []).filter((x) => x.id !== c.id));
      if (ouvert?.id === c.id) setOuvert(null);
    } catch (e) {
      window.alert(messageErreur(e));
    }
  }

  if (ouvert) {
    return <VueClassementContenu classement={ouvert} onRetour={() => setOuvert(null)} onSupprime={() => supprimer(ouvert)} />;
  }

  const LABELS_TYPE: Record<TypeClassement, string> = { semestre: "Semestre", annee: "Année", section: "Section" };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-dj-texte-muet">
        Un classement (semestre, année, section libre) regroupe des matières, chapitres, documents, exercices ou
        examens venant de n&apos;importe où dans ton programme -- utile pour organiser une révision transverse.
        Ajoute-les depuis le bouton « + » à côté de chaque élément.
      </p>

      {erreur && <p className="text-xs text-[var(--dj-erreur)]">{erreur}</p>}

      {classements === null && (
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton className="h-14 rounded-xl border border-dj-bordure" />
        </div>
      )}

      {classements?.length === 0 && (
        <p className="text-sm text-dj-texte-muet">
          Aucun classement pour l&apos;instant -- crée-en un depuis le bouton « + » à côté d&apos;une matière, d&apos;un
          chapitre, d&apos;un document, d&apos;un exercice ou d&apos;un examen.
        </p>
      )}

      {classements && classements.length > 0 && (
        <div className="flex flex-col gap-2">
          {classements.map((c) => (
            <div
              key={c.id}
              onClick={() => setOuvert(c)}
              className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-dj-bordure bg-dj-surface px-4 py-3 transition-colors hover:border-dj-bordure-forte"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex-shrink-0 rounded-full bg-dj-surface-haute px-2 py-0.5 text-[10px] text-dj-texte-muet">
                  {LABELS_TYPE[c.type]}
                </span>
                <span className="truncate text-sm font-semibold text-dj-texte">{c.label}</span>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => supprimer(c)}
                  title="Supprimer"
                  className="rounded-lg p-1.5 text-dj-texte-muet transition-colors hover:bg-[var(--dj-erreur)]/10 hover:text-[var(--dj-erreur)]"
                >
                  <Trash2 size={14} />
                </button>
                <ChevronRight size={16} className="text-dj-texte-muet" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VueClassementContenu({
  classement,
  onRetour,
  onSupprime,
}: {
  classement: Classement;
  onRetour: () => void;
  onSupprime: () => void;
}) {
  const [items, setItems] = useState<ItemClassement[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  function charger() {
    listerItemsClassement(classement.id)
      .then(setItems)
      .catch((e) => setErreur(messageErreur(e)));
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classement.id]);

  useEffect(() => ecouterDonneesModifiees("programme", charger), [classement.id]);

  async function retirer(item: ItemClassement) {
    try {
      await supprimerItemClassement(classement.id, item.id);
      setItems((prec) => (prec || []).filter((i) => i.id !== item.id));
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  const LABELS_CIBLE: Record<CibleClassement, string> = {
    matiere: "Matière",
    chapitre: "Chapitre",
    document: "Document",
    exercice: "Exercice",
    examen: "Examen",
  };

  return (
    <div className="flex flex-col gap-3">
      <FilAriane elements={[{ label: classement.label }]} onRetour={onRetour} />

      <SectionComportementsEmplacement typeCible="section" cibleId={classement.id} titre="Skills" />

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-dj-texte">Contenu</p>
        <button
          onClick={onSupprime}
          className="flex items-center gap-1 text-xs text-dj-texte-muet transition-colors hover:text-[var(--dj-erreur)]"
        >
          <Trash2 size={12} /> Supprimer ce classement
        </button>
      </div>

      {erreur && <p className="text-xs text-[var(--dj-erreur)]">{erreur}</p>}

      {items === null && <Skeleton className="h-12 w-full rounded-xl border border-dj-bordure" />}
      {items?.length === 0 && (
        <p className="text-sm text-dj-texte-muet">
          Rien ici pour l&apos;instant -- ajoute des éléments depuis le bouton « + » à côté d&apos;une matière, d&apos;un
          chapitre, d&apos;un document, d&apos;un exercice ou d&apos;un examen.
        </p>
      )}
      {items && items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-dj-bordure bg-dj-surface px-4 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex-shrink-0 rounded-full bg-dj-surface-haute px-2 py-0.5 text-[10px] text-dj-texte-muet">
                  {LABELS_CIBLE[item.cible_type]}
                </span>
                <span className="truncate text-sm text-dj-texte">{item.libelle || "(introuvable)"}</span>
              </div>
              <button
                onClick={() => retirer(item)}
                title="Retirer de ce classement"
                className="flex-shrink-0 rounded-lg p-1.5 text-dj-texte-muet transition-colors hover:bg-[var(--dj-erreur)]/10 hover:text-[var(--dj-erreur)]"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilAriane({
  elements,
  onRetour,
}: {
  elements: { label: string; onClick?: () => void }[];
  onRetour: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      <button
        onClick={onRetour}
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-dj-texte-muet transition-colors hover:bg-dj-surface hover:text-dj-texte"
      >
        <ArrowLeft size={14} />
      </button>
      {elements.map((e, i) => {
        const dernier = i === elements.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={12} className="text-dj-texte-muet" />}
            {e.onClick && !dernier ? (
              <button
                onClick={e.onClick}
                className="rounded-lg px-1 py-0.5 text-dj-texte-muet transition-colors hover:bg-dj-surface hover:text-dj-texte"
              >
                {e.label}
              </button>
            ) : (
              <span className={dernier ? "font-semibold text-dj-texte" : "text-dj-texte-muet"}>{e.label}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function ChampLimites({
  valeur,
  onChange,
  placeholder = "Ex : ne pas dépasser le programme officiel de cette classe…",
}: {
  valeur: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={valeur}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={2}
      className="w-full resize-none rounded-xl border border-dj-bordure bg-dj-fond px-3 py-2 text-xs text-dj-texte outline-none focus:border-dj-bordure-forte"
    />
  );
}

/* ------------------------------- Programmes ------------------------------ */

function ListeProgrammes({ onOuvrir }: { onOuvrir: (p: Programme) => void }) {
  const [programmes, setProgrammes] = useState<Programme[] | null>(null);
  const [creation, setCreation] = useState(false);
  const [niveauNouveau, setNiveauNouveau] = useState("");
  const [nomNouveau, setNomNouveau] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [edition, setEdition] = useState<{ id: string; niveau: string; nom: string } | null>(null);
  // Refonte "Mon espace = l'app" : onglet auparavant inatteignable sans
  // compte, même détection 401 que les autres sections.
  const [sansCompte, setSansCompte] = useState(false);

  useEffect(() => {
    charger();
  }, []);

  // 15/08 (demande Bourama) : voir lib/evenementsDonnees.ts.
  useEffect(() => ecouterDonneesModifiees("programme", charger), []);

  function charger() {
    listerProgrammes()
      .then(setProgrammes)
      .catch((e) => {
        if (e instanceof ErreurApi && e.statusCode === 401) {
          setSansCompte(true);
        }
        setProgrammes([]);
      });
  }

  if (sansCompte) {
    return <CTACompteRequis texte="Crée un compte pour organiser ton programme." />;
  }

  async function creer() {
    const niveau = niveauNouveau.trim();
    if (!niveau) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await creerProgramme(niveau, nomNouveau.trim() || undefined);
      setNiveauNouveau("");
      setNomNouveau("");
      setCreation(false);
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  }

  async function enregistrerEdition() {
    if (!edition) return;
    const niveau = edition.niveau.trim();
    if (!niveau) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await modifierProgramme(edition.id, { niveau, nom: edition.nom.trim() || undefined });
      setEdition(null);
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  }

  async function supprimer(p: Programme) {
    if (!window.confirm(`Supprimer le programme « ${p.nom || p.niveau} » et tout son contenu (matières, chapitres) ?`))
      return;
    try {
      await supprimerProgramme(p.id);
      charger();
    } catch (e) {
      window.alert(messageErreur(e));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {programmes === null && (
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton className="h-14 rounded-xl border border-dj-bordure" />
          <Skeleton className="h-14 rounded-xl border border-dj-bordure" style={{ animationDelay: "100ms" }} />
        </div>
      )}

      {programmes?.length === 0 && !creation && (
        <p className="text-sm text-dj-texte-muet">Aucun programme pour l&apos;instant.</p>
      )}

      {programmes && programmes.length > 0 && (
        <div className="flex flex-col gap-2">
          {programmes.map((p) =>
            edition?.id === p.id ? (
              <div key={p.id} className="flex flex-col gap-2 rounded-xl border border-dj-bordure-forte bg-dj-surface p-3">
                <input
                  value={edition.niveau}
                  onChange={(e) => setEdition({ ...edition, niveau: e.target.value })}
                  placeholder="Niveau / classe"
                  className="rounded-lg border border-dj-bordure bg-dj-fond px-3 py-1.5 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
                />
                <input
                  value={edition.nom}
                  onChange={(e) => setEdition({ ...edition, nom: e.target.value })}
                  placeholder="Nom (optionnel)"
                  className="rounded-lg border border-dj-bordure bg-dj-fond px-3 py-1.5 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setEdition(null)}
                    disabled={envoi}
                    className="rounded-lg px-3 py-1.5 text-xs text-dj-texte-muet transition-colors hover:bg-dj-surface-haute disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={enregistrerEdition}
                    disabled={envoi || !edition.niveau.trim()}
                    className="flex items-center gap-1 rounded-lg bg-dj-accent-1 px-3 py-1.5 text-xs font-semibold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
                  >
                    <Check size={12} /> Enregistrer
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={p.id}
                onClick={() => onOuvrir(p)}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-dj-bordure bg-dj-surface px-4 py-3 transition-colors hover:border-dj-bordure-forte"
              >
                <div className="flex min-w-0 flex-1 flex-col items-start text-left">
                  <span className="truncate text-sm font-semibold text-dj-texte">{p.nom || p.niveau}</span>
                  {p.nom && <span className="truncate text-xs text-dj-texte-muet">{p.niveau}</span>}
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEdition({ id: p.id, niveau: p.niveau, nom: p.nom || "" });
                    }}
                    title="Modifier"
                    className="rounded-lg p-1.5 text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      supprimer(p);
                    }}
                    title="Supprimer"
                    className="rounded-lg p-1.5 text-dj-texte-muet transition-colors hover:bg-[var(--dj-erreur)]/10 hover:text-[var(--dj-erreur)]"
                  >
                    <Trash2 size={14} />
                  </button>
                  <ChevronRight size={16} className="text-dj-texte-muet" />
                </div>
              </div>
            )
          )}
        </div>
      )}

      {creation ? (
        <div className="flex flex-col gap-2 rounded-xl border border-dj-bordure bg-dj-surface p-3">
          <input
            autoFocus
            value={niveauNouveau}
            onChange={(e) => setNiveauNouveau(e.target.value)}
            placeholder="Niveau / classe (ex : MPSI)"
            className="rounded-lg border border-dj-bordure bg-dj-fond px-3 py-1.5 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
          />
          <input
            value={nomNouveau}
            onChange={(e) => setNomNouveau(e.target.value)}
            placeholder="Nom (optionnel)"
            className="rounded-lg border border-dj-bordure bg-dj-fond px-3 py-1.5 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
          />
          {erreur && <p className="text-xs text-[var(--dj-erreur)]">{erreur}</p>}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setCreation(false);
                setErreur(null);
              }}
              disabled={envoi}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-dj-texte-muet transition-colors hover:bg-dj-surface-haute disabled:opacity-50"
            >
              <X size={12} /> Annuler
            </button>
            <button
              onClick={creer}
              disabled={envoi || !niveauNouveau.trim()}
              className="flex items-center gap-1 rounded-lg bg-dj-accent-1 px-3 py-1.5 text-xs font-semibold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
            >
              <Plus size={12} /> {envoi ? "Création…" : "Créer"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreation(true)}
          className="flex items-center justify-center gap-1.5 self-start rounded-cgpt-bouton border border-dj-bordure px-4 py-2 text-sm font-semibold text-dj-texte transition-colors hover:border-dj-bordure-forte hover:bg-dj-surface"
        >
          <Plus size={14} /> Nouveau programme
        </button>
      )}
    </div>
  );
}

/* -------------------------------- Matières -------------------------------- */

function ListeMatieres({
  programme,
  onRetour,
  onOuvrir,
}: {
  programme: Programme;
  onRetour: () => void;
  onOuvrir: (m: MatiereDuProgramme) => void;
}) {
  const [matieres, setMatieres] = useState<MatiereDuProgramme[] | null>(null);
  const [creation, setCreation] = useState(false);
  const [nomNouveau, setNomNouveau] = useState("");
  const [limitesNouvelles, setLimitesNouvelles] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [edition, setEdition] = useState<{ id: string; nom: string; limites: string } | null>(null);

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programme.id]);

  // 15/08 (demande Bourama) : voir lib/evenementsDonnees.ts.
  useEffect(() => ecouterDonneesModifiees("programme", charger), [programme.id]);

  function charger() {
    listerMatieresProgramme(programme.id)
      .then(setMatieres)
      .catch(() => setMatieres([]));
  }

  async function creer() {
    const nom = nomNouveau.trim();
    if (!nom) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await creerMatiereProgramme(programme.id, nom, limitesNouvelles.trim() || undefined);
      setNomNouveau("");
      setLimitesNouvelles("");
      setCreation(false);
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  }

  async function enregistrerEdition() {
    if (!edition) return;
    const nom = edition.nom.trim();
    if (!nom) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await modifierMatiereProgramme(edition.id, { nom, limites: edition.limites.trim() || undefined });
      setEdition(null);
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  }

  async function supprimer(m: MatiereDuProgramme) {
    if (!window.confirm(`Supprimer la matière « ${m.nom} » et tous ses chapitres ?`)) return;
    try {
      await supprimerMatiereProgramme(m.id);
      charger();
    } catch (e) {
      window.alert(messageErreur(e));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <FilAriane elements={[{ label: programme.nom || programme.niveau }]} onRetour={onRetour} />

      <SectionDocumentsBibliotheque typeCible="programme" cibleId={programme.id} titre="Documents du programme" />

      {matieres === null && (
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton className="h-16 rounded-xl border border-dj-bordure" />
          <Skeleton className="h-16 rounded-xl border border-dj-bordure" style={{ animationDelay: "100ms" }} />
        </div>
      )}

      {matieres?.length === 0 && !creation && (
        <p className="text-sm text-dj-texte-muet">Aucune matière pour l&apos;instant.</p>
      )}

      {matieres && matieres.length > 0 && (
        <div className="flex flex-col gap-2">
          {matieres.map((m) =>
            edition?.id === m.id ? (
              <div key={m.id} className="flex flex-col gap-2 rounded-xl border border-dj-bordure-forte bg-dj-surface p-3">
                <input
                  value={edition.nom}
                  onChange={(e) => setEdition({ ...edition, nom: e.target.value })}
                  placeholder="Nom de la matière"
                  className="rounded-lg border border-dj-bordure bg-dj-fond px-3 py-1.5 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
                />
                <ChampLimites valeur={edition.limites} onChange={(v) => setEdition({ ...edition, limites: v })} />
                <SectionComportementsEmplacement typeCible="matiere" cibleId={m.id} titre="Skills" />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setEdition(null)}
                    disabled={envoi}
                    className="rounded-lg px-3 py-1.5 text-xs text-dj-texte-muet transition-colors hover:bg-dj-surface-haute disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={enregistrerEdition}
                    disabled={envoi || !edition.nom.trim()}
                    className="flex items-center gap-1 rounded-lg bg-dj-accent-1 px-3 py-1.5 text-xs font-semibold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
                  >
                    <Check size={12} /> Enregistrer
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={m.id}
                onClick={() => onOuvrir(m)}
                className="flex cursor-pointer flex-col gap-1.5 rounded-xl border border-dj-bordure bg-dj-surface px-4 py-3 transition-colors hover:border-dj-bordure-forte"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-dj-texte">{m.nom}</span>
                  <div className="flex flex-shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <AjouterAClassementBouton cibleType="matiere" cibleId={m.id} />
                    <button
                      onClick={() => setEdition({ id: m.id, nom: m.nom, limites: m.limites || "" })}
                      title="Modifier"
                      className="rounded-lg p-1.5 text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => supprimer(m)}
                      title="Supprimer"
                      className="rounded-lg p-1.5 text-dj-texte-muet transition-colors hover:bg-[var(--dj-erreur)]/10 hover:text-[var(--dj-erreur)]"
                    >
                      <Trash2 size={14} />
                    </button>
                    <ChevronRight size={16} className="text-dj-texte-muet" />
                  </div>
                </div>
                {m.limites && <p className="truncate text-xs text-dj-texte-muet">{m.limites}</p>}
              </div>
            )
          )}
        </div>
      )}

      {creation ? (
        <div className="flex flex-col gap-2 rounded-xl border border-dj-bordure bg-dj-surface p-3">
          <input
            autoFocus
            value={nomNouveau}
            onChange={(e) => setNomNouveau(e.target.value)}
            placeholder="Nom de la matière (ex : Mathématiques)"
            className="rounded-lg border border-dj-bordure bg-dj-fond px-3 py-1.5 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
          />
          <ChampLimites valeur={limitesNouvelles} onChange={setLimitesNouvelles} />
          {erreur && <p className="text-xs text-[var(--dj-erreur)]">{erreur}</p>}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setCreation(false);
                setErreur(null);
              }}
              disabled={envoi}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-dj-texte-muet transition-colors hover:bg-dj-surface-haute disabled:opacity-50"
            >
              <X size={12} /> Annuler
            </button>
            <button
              onClick={creer}
              disabled={envoi || !nomNouveau.trim()}
              className="flex items-center gap-1 rounded-lg bg-dj-accent-1 px-3 py-1.5 text-xs font-semibold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
            >
              <Plus size={12} /> {envoi ? "Création…" : "Créer"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreation(true)}
          className="flex items-center justify-center gap-1.5 self-start rounded-cgpt-bouton border border-dj-bordure px-4 py-2 text-sm font-semibold text-dj-texte transition-colors hover:border-dj-bordure-forte hover:bg-dj-surface"
        >
          <Plus size={14} /> Nouvelle matière
        </button>
      )}

      <div className="mt-2 border-t border-dj-bordure pt-4">
        <SectionExamensDuProgramme programme={programme} matieres={matieres || []} />
      </div>
    </div>
  );
}

// Lot 5 -- au niveau "programme sélectionné" (au-dessus des matières) :
// examens/devoirs multi-chapitres + publication en plugin (VueProgramme-
// Contenu, voir EspaceProgrammeContenu.tsx). Un examen peut couvrir des
// chapitres de plusieurs matières à la fois, donc on aplatit ici les
// chapitres de toutes les matières du programme (un appel par matière),
// préfixés par leur matière pour rester lisibles dans le sélecteur.
function SectionExamensDuProgramme({
  programme,
  matieres,
}: {
  programme: Programme;
  matieres: MatiereDuProgramme[];
}) {
  const [chapitres, setChapitres] = useState<{ id: string; titre: string }[] | null>(null);

  function charger() {
    if (matieres.length === 0) {
      setChapitres([]);
      return;
    }
    setChapitres(null);
    Promise.all(
      matieres.map((m) =>
        listerChapitresMatiere(m.id)
          .then((chs) => chs.map((c) => ({ id: c.id, titre: `${m.nom} — ${c.nom}` })))
          .catch(() => [] as { id: string; titre: string }[])
      )
    ).then((listes) => setChapitres(listes.flat()));
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programme.id, matieres.map((m) => m.id).join(",")]);

  // 15/08 (demande Bourama) : voir lib/evenementsDonnees.ts.
  useEffect(() => ecouterDonneesModifiees("programme", charger), [programme.id, matieres.map((m) => m.id).join(",")]);

  if (chapitres === null) {
    return <Skeleton className="h-24 rounded-cgpt-carte border border-dj-bordure" />;
  }

  return <VueProgrammeContenu programmeId={programme.id} chapitres={chapitres} />;
}

/* ------------------------------- Chapitres -------------------------------- */

function ListeChapitres({
  programme,
  matiere,
  onRetour,
  onOuvrir,
}: {
  programme: Programme;
  matiere: MatiereDuProgramme;
  onRetour: () => void;
  onOuvrir: (c: ChapitreDeLaMatiere) => void;
}) {
  const [chapitres, setChapitres] = useState<ChapitreDeLaMatiere[] | null>(null);
  const [creation, setCreation] = useState(false);
  const [nomNouveau, setNomNouveau] = useState("");
  const [limitesNouvelles, setLimitesNouvelles] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [edition, setEdition] = useState<{ id: string; nom: string; limites: string } | null>(null);
  const [reordonnancementEnCours, setReordonnancementEnCours] = useState(false);

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matiere.id]);

  // 15/08 (demande Bourama) : voir lib/evenementsDonnees.ts.
  useEffect(() => ecouterDonneesModifiees("programme", charger), [matiere.id]);

  function charger() {
    listerChapitresMatiere(matiere.id)
      .then(setChapitres)
      .catch(() => setChapitres([]));
  }

  async function creer() {
    const nom = nomNouveau.trim();
    if (!nom) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await creerChapitreMatiere(matiere.id, nom, undefined, limitesNouvelles.trim() || undefined);
      setNomNouveau("");
      setLimitesNouvelles("");
      setCreation(false);
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  }

  async function enregistrerEdition() {
    if (!edition) return;
    const nom = edition.nom.trim();
    if (!nom) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await modifierChapitreMatiere(edition.id, { nom, limites: edition.limites.trim() || undefined });
      setEdition(null);
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  }

  async function supprimer(c: ChapitreDeLaMatiere) {
    if (!window.confirm(`Supprimer le chapitre « ${c.nom} » ?`)) return;
    try {
      await supprimerChapitreMatiere(c.id);
      charger();
    } catch (e) {
      window.alert(messageErreur(e));
    }
  }

  // Réordonnancement : échange l'ordre du chapitre avec son voisin direct
  // (haut/bas), deux PATCH séquentiels puis rechargement de la liste.
  async function deplacer(index: number, direction: -1 | 1) {
    if (!chapitres) return;
    const autre = index + direction;
    if (autre < 0 || autre >= chapitres.length || reordonnancementEnCours) return;

    const a = chapitres[index];
    const b = chapitres[autre];
    setReordonnancementEnCours(true);
    try {
      await Promise.all([
        modifierChapitreMatiere(a.id, { ordre: b.ordre }),
        modifierChapitreMatiere(b.id, { ordre: a.ordre }),
      ]);
      charger();
    } catch (e) {
      window.alert(messageErreur(e));
    } finally {
      setReordonnancementEnCours(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <FilAriane
        elements={[{ label: programme.nom || programme.niveau, onClick: onRetour }, { label: matiere.nom }]}
        onRetour={onRetour}
      />

      <SectionDocumentsBibliotheque typeCible="matiere" cibleId={matiere.id} titre="Documents de la matière" />

      {chapitres === null && (
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton className="h-16 rounded-xl border border-dj-bordure" />
          <Skeleton className="h-16 rounded-xl border border-dj-bordure" style={{ animationDelay: "100ms" }} />
        </div>
      )}

      {chapitres?.length === 0 && !creation && (
        <p className="text-sm text-dj-texte-muet">Aucun chapitre pour l&apos;instant.</p>
      )}

      {chapitres && chapitres.length > 0 && (
        <div className="flex flex-col gap-2">
          {chapitres.map((c, index) =>
            edition?.id === c.id ? (
              <div key={c.id} className="flex flex-col gap-2 rounded-xl border border-dj-bordure-forte bg-dj-surface p-3">
                <input
                  value={edition.nom}
                  onChange={(e) => setEdition({ ...edition, nom: e.target.value })}
                  placeholder="Nom du chapitre"
                  className="rounded-lg border border-dj-bordure bg-dj-fond px-3 py-1.5 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
                />
                <ChampLimites valeur={edition.limites} onChange={(v) => setEdition({ ...edition, limites: v })} />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setEdition(null)}
                    disabled={envoi}
                    className="rounded-lg px-3 py-1.5 text-xs text-dj-texte-muet transition-colors hover:bg-dj-surface-haute disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={enregistrerEdition}
                    disabled={envoi || !edition.nom.trim()}
                    className="flex items-center gap-1 rounded-lg bg-dj-accent-1 px-3 py-1.5 text-xs font-semibold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
                  >
                    <Check size={12} /> Enregistrer
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={c.id}
                onClick={() => onOuvrir(c)}
                className="flex cursor-pointer items-start gap-2 rounded-xl border border-dj-bordure bg-dj-surface px-4 py-3 transition-colors hover:border-dj-bordure-forte"
              >
                <div
                  className="flex flex-shrink-0 flex-col items-center gap-0.5 pt-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => deplacer(index, -1)}
                    disabled={index === 0 || reordonnancementEnCours}
                    title="Monter"
                    className="rounded p-0.5 text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte disabled:opacity-20"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    onClick={() => deplacer(index, 1)}
                    disabled={index === chapitres.length - 1 || reordonnancementEnCours}
                    title="Descendre"
                    className="rounded p-0.5 text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte disabled:opacity-20"
                  >
                    <ArrowDown size={13} />
                  </button>
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-semibold text-dj-texte">{c.nom}</span>
                  {c.limites && <p className="truncate text-xs text-dj-texte-muet">{c.limites}</p>}
                </div>
                <div className="flex flex-shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <AjouterAClassementBouton cibleType="chapitre" cibleId={c.id} />
                  <button
                    onClick={() => setEdition({ id: c.id, nom: c.nom, limites: c.limites || "" })}
                    title="Modifier"
                    className="rounded-lg p-1.5 text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => supprimer(c)}
                    title="Supprimer"
                    className="rounded-lg p-1.5 text-dj-texte-muet transition-colors hover:bg-[var(--dj-erreur)]/10 hover:text-[var(--dj-erreur)]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {creation ? (
        <div className="flex flex-col gap-2 rounded-xl border border-dj-bordure bg-dj-surface p-3">
          <input
            autoFocus
            value={nomNouveau}
            onChange={(e) => setNomNouveau(e.target.value)}
            placeholder="Nom du chapitre"
            className="rounded-lg border border-dj-bordure bg-dj-fond px-3 py-1.5 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
          />
          <ChampLimites valeur={limitesNouvelles} onChange={setLimitesNouvelles} />
          {erreur && <p className="text-xs text-[var(--dj-erreur)]">{erreur}</p>}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setCreation(false);
                setErreur(null);
              }}
              disabled={envoi}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-dj-texte-muet transition-colors hover:bg-dj-surface-haute disabled:opacity-50"
            >
              <X size={12} /> Annuler
            </button>
            <button
              onClick={creer}
              disabled={envoi || !nomNouveau.trim()}
              className="flex items-center gap-1 rounded-lg bg-dj-accent-1 px-3 py-1.5 text-xs font-semibold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
            >
              <Plus size={12} /> {envoi ? "Création…" : "Créer"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreation(true)}
          className="flex items-center justify-center gap-1.5 self-start rounded-cgpt-bouton border border-dj-bordure px-4 py-2 text-sm font-semibold text-dj-texte transition-colors hover:border-dj-bordure-forte hover:bg-dj-surface"
        >
          <Plus size={14} /> Nouveau chapitre
        </button>
      )}
    </div>
  );
}
