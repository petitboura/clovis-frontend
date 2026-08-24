"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, X, Check, Link as IconLien, FileText, Rocket, ExternalLink, Paperclip } from "lucide-react";
import {
  lireDocumentsChapitre,
  ajouterDocumentChapitre,
  supprimerDocumentChapitre,
  type DocumentChapitre,
  lireExercicesChapitre,
  ajouterExerciceChapitre,
  modifierExerciceChapitre,
  supprimerExerciceChapitre,
  type ExerciceChapitre,
  lireExamensProgramme,
  creerExamen,
  supprimerExamen,
  type Examen,
  type TypeExamen,
  publierProgrammeCommePlugin,
  examensTransversesProgramme,
  type ExamenTransverse,
  classerDocumentEmplacement,
  ajouterFichierBibliothequePersonnelle,
} from "@/lib/api";
import { messageErreur } from "@/lib/erreurs";
import { ecouterDonneesModifiees } from "@/lib/evenementsDonnees";
import { Skeleton } from "./Skeleton";
import { AjouterAClassementBouton } from "./AjouterAClassementBouton";
import { LinkPreview } from "./chat/LinkPreview";
import { SectionDocumentsBibliotheque } from "./SectionDocumentsBibliotheque";
import { SectionComportementsEmplacement } from "./SectionComportementsEmplacement";
import { SelectPersonnalise } from "./SelectPersonnalise";
import { PanneauFlottant } from "./PanneauFlottant";
import { useFermetureAnimee } from "@/lib/useFermetureAnimee";

// Lot 5 (chantier programme étudiant) -- au moment où ce fichier a été
// écrit, components/EspaceProgramme.tsx (lot 4 : navigation
// programme/matière/chapitre) n'existe pas encore dans le dépôt. Fichier
// séparé comme prévu dans le brief : Bourama branche lui-même
// <VueChapitreContenu> et <VueProgrammeContenu> ci-dessous au bon endroit
// une fois le lot 4 en place, plutôt que de deviner sa structure.
//
// Ne couvre PAS la création/édition/liste des programmes, matières ou
// chapitres eux-mêmes (hors périmètre du lot 5).

// ---------------------------------------------------------------------------
// Vue "chapitre sélectionné" : documents + exercices du chapitre.

export function VueChapitreContenu({ chapitreId }: { chapitreId: string }) {
  return (
    <div className="flex flex-col gap-6">
      <SectionDocumentsBibliotheque typeCible="chapitre" cibleId={chapitreId} titre="Documents" />
      <SectionComportementsEmplacement typeCible="chapitre" cibleId={chapitreId} titre="Skills" />
      <SectionDocuments chapitreId={chapitreId} />
      <SectionExercices chapitreId={chapitreId} />
    </div>
  );
}

const URL_REGEX = /^https?:\/\/\S+$/i;

function SectionDocuments({ chapitreId }: { chapitreId: string }) {
  const [documents, setDocuments] = useState<DocumentChapitre[] | null>(null);
  const [titre, setTitre] = useState("");
  const [urlOuContenu, setUrlOuContenu] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // 17/08 (Bourama : "rien pour ouvrir chaque type dans l'app") -- même
  // besoin que EspaceBibliotheque.tsx/VisionneuseBibliotheque.tsx, mais
  // ici le "document" n'est qu'un titre + un lien OU un texte tapé à la
  // main (pas de vrai fichier, voir api/contenu_programme.py), donc pas
  // besoin d'une visionneuse par type MIME -- juste lien vs texte brut.
  const [documentOuvert, setDocumentOuvert] = useState<DocumentChapitre | null>(null);
  const { enSortie: documentEnSortie, demarrerFermeture: fermerDocumentAnime } = useFermetureAnimee();
  // Demande Bourama 17/08 : ici, texte/lien tapé à la main doit rester
  // discret par rapport à la bibliothèque (SectionDocumentsBibliotheque,
  // juste au-dessus dans VueChapitreContenu) -- formulaire replié par
  // défaut, ouvert via un simple lien texte plutôt qu'un gros bloc
  // toujours visible.
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);

  useEffect(() => {
    setDocuments(null);
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapitreId]);

  // 15/08 (demande Bourama) : voir lib/evenementsDonnees.ts.
  useEffect(() => ecouterDonneesModifiees("programme", charger), [chapitreId]);

  function charger() {
    lireDocumentsChapitre(chapitreId)
      .then(setDocuments)
      .catch(() => setDocuments([]));
  }

  async function ajouter() {
    if (!titre.trim() || !urlOuContenu.trim()) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await ajouterDocumentChapitre(chapitreId, titre.trim(), urlOuContenu.trim());
      setTitre("");
      setUrlOuContenu("");
      setFormulaireOuvert(false);
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  }

  async function supprimer(id: string, titreDoc: string) {
    if (!window.confirm(`Supprimer le document « ${titreDoc} » ?`)) return;
    try {
      await supprimerDocumentChapitre(id);
      charger();
    } catch (e) {
      window.alert(messageErreur(e));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {!formulaireOuvert ? (
        <button
          type="button"
          onClick={() => setFormulaireOuvert(true)}
          className="w-fit text-xs text-dj-texte-muet underline decoration-dotted transition-colors hover:text-dj-texte"
        >
          Ajouter un lien ou un texte à la main
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4 sm:flex-row sm:items-center">
          <input
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="Titre du document"
            className="rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-4 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte sm:w-48"
          />
          <input
            value={urlOuContenu}
            onChange={(e) => setUrlOuContenu(e.target.value)}
            placeholder="Colle un lien, ou écris le contenu…"
            className="flex-1 rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-4 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
          />
          <button
            type="button"
            onClick={ajouter}
            disabled={envoi || !titre.trim() || !urlOuContenu.trim()}
            className="self-end rounded-cgpt-bouton bg-dj-accent-1 px-5 py-2 text-sm font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50 sm:self-auto"
          >
            {envoi ? "Envoi…" : "Ajouter"}
          </button>
        </div>
      )}

      {erreur && <p className="text-sm text-[var(--dj-erreur)]">{erreur}</p>}

      {documents === null && (
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton className="h-12 rounded-xl border border-dj-bordure" />
          <Skeleton className="h-12 rounded-xl border border-dj-bordure" style={{ animationDelay: "100ms" }} />
        </div>
      )}
      {documents?.length === 0 && <p className="text-sm text-dj-texte-muet">Aucun document pour l&apos;instant.</p>}
      {documents && documents.length > 0 && (
        <div className="flex flex-col gap-2">
          {documents.map((d) => {
            const estLien = URL_REGEX.test(d.url_ou_contenu);
            const Icone = estLien ? IconLien : FileText;
            return (
              <div
                key={d.id}
                onClick={() => setDocumentOuvert(d)}
                className="flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded-xl border border-dj-bordure bg-dj-surface px-4 py-3 transition-colors hover:border-dj-bordure-forte"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Icone size={14} className="flex-shrink-0 text-dj-texte-muet" />
                  <span className={`truncate text-left text-sm ${estLien ? "text-dj-texte hover:underline" : "text-dj-texte"}`}>
                    {d.titre}
                  </span>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <AjouterAClassementBouton cibleType="document" cibleId={d.id} />
                  <button
                    onClick={() => supprimer(d.id, d.titre)}
                    className="text-xs text-dj-texte-muet transition-colors hover:text-[var(--dj-erreur)]"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {documentOuvert && (
        <PanneauFlottant
          onFerme={() => fermerDocumentAnime(() => setDocumentOuvert(null))}
          enSortie={documentEnSortie}
          entete={
            <div className="flex items-center justify-between">
              <span className="truncate text-sm text-dj-texte-muet">{documentOuvert.titre}</span>
              <button
                onClick={() => fermerDocumentAnime(() => setDocumentOuvert(null))}
                className="flex flex-shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs text-dj-texte-muet transition-colors hover:bg-dj-surface-haute"
              >
                <X size={14} /> Fermer
              </button>
            </div>
          }
        >
          {URL_REGEX.test(documentOuvert.url_ou_contenu) ? (
            <div className="flex flex-col gap-3 py-2">
              <LinkPreview href={documentOuvert.url_ou_contenu} texteLien={documentOuvert.titre} />
              <button
                onClick={() => window.open(documentOuvert.url_ou_contenu, "_blank", "noopener,noreferrer")}
                className="flex w-fit items-center gap-1.5 rounded-lg border border-dj-bordure px-3 py-1.5 text-xs text-dj-texte-muet transition-colors hover:border-dj-bordure-forte hover:text-dj-texte"
              >
                <ExternalLink size={13} /> Ouvrir le site
              </button>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap break-words rounded-xl border border-dj-bordure bg-dj-surface-haute px-4 py-3 font-sans text-sm text-dj-texte">
              {documentOuvert.url_ou_contenu}
            </pre>
          )}
        </PanneauFlottant>
      )}
    </div>
  );
}

function SectionExercices({ chapitreId }: { chapitreId: string }) {
  const [exercices, setExercices] = useState<ExerciceChapitre[] | null>(null);
  const [nouvelEnonce, setNouvelEnonce] = useState("");
  const [ajoutEnCours, setAjoutEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [panneau, setPanneau] = useState<ExerciceChapitre | null>(null);
  const { enSortie, demarrerFermeture } = useFermetureAnimee();
  const [texteOuvert, setTexteOuvert] = useState("");
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [erreurOuvert, setErreurOuvert] = useState<string | null>(null);

  // 17/08 (demande Bourama : "attacher un fichier au lieu de taper
  // l'énoncé" -- "qui écrit un exercice à la main ?") : crée un
  // exercice vide puis y classe directement le(s) fichier(s) choisis,
  // sans passer par la zone de texte. Le texte et le fichier cohabitent
  // (voir aussi les pièces jointes dans le panneau ci-dessous, pour un
  // exercice déjà créé).
  const [envoiFichierEnCours, setEnvoiFichierEnCours] = useState(false);
  // 17/08 (Bourama : "c'est l'upload qui doit être en avant, je ne sais
  // pas qui va aller écrire l'énoncé d'un exercice à la main") -- le
  // formulaire texte passe en option repliée, comme pour SectionDocuments
  // plus haut.
  const [formulaireTexteOuvert, setFormulaireTexteOuvert] = useState(false);

  async function ajouterParFichier(fichiers: File[]) {
    if (fichiers.length === 0) return;
    setEnvoiFichierEnCours(true);
    setErreur(null);
    try {
      const cree = await ajouterExerciceChapitre(chapitreId, nouvelEnonce.trim());
      for (const fichier of fichiers) {
        const ligne = await ajouterFichierBibliothequePersonnelle(fichier, "", "");
        await classerDocumentEmplacement("exercice", cree.id, ligne.id);
      }
      setExercices((prec) => [...(prec || []), cree]);
      setNouvelEnonce("");
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoiFichierEnCours(false);
    }
  }

  useEffect(() => {
    setExercices(null);
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapitreId]);

  // 15/08 (demande Bourama) : voir lib/evenementsDonnees.ts.
  useEffect(() => ecouterDonneesModifiees("programme", charger), [chapitreId]);

  function charger() {
    lireExercicesChapitre(chapitreId)
      .then(setExercices)
      .catch(() => setExercices([]));
  }

  async function ajouter() {
    if (!nouvelEnonce.trim()) return;
    setAjoutEnCours(true);
    setErreur(null);
    try {
      const cree = await ajouterExerciceChapitre(chapitreId, nouvelEnonce.trim());
      setExercices((prec) => [...(prec || []), cree]);
      setNouvelEnonce("");
      setFormulaireTexteOuvert(false);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setAjoutEnCours(false);
    }
  }

  function ouvrir(ex: ExerciceChapitre) {
    setPanneau(ex);
    setTexteOuvert(ex.enonce);
    setErreurOuvert(null);
  }

  function fermer() {
    setPanneau(null);
  }

  async function enregistrer() {
    if (!panneau) return;
    const enonce = texteOuvert.trim();
    if (!enonce || enonce === panneau.enonce) {
      demarrerFermeture(fermer);
      return;
    }
    setEnregistrementEnCours(true);
    setErreurOuvert(null);
    try {
      const maj = await modifierExerciceChapitre(panneau.id, enonce);
      setExercices((prec) => (prec || []).map((e) => (e.id === panneau.id ? maj : e)));
      demarrerFermeture(fermer);
    } catch (e) {
      setErreurOuvert(messageErreur(e));
    } finally {
      setEnregistrementEnCours(false);
    }
  }

  async function supprimer() {
    if (!panneau) return;
    setSuppressionEnCours(true);
    setErreurOuvert(null);
    try {
      await supprimerExerciceChapitre(panneau.id);
      setExercices((prec) => (prec || []).filter((e) => e.id !== panneau.id));
      demarrerFermeture(fermer);
    } catch (e) {
      setErreurOuvert(messageErreur(e));
      setSuppressionEnCours(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-dj-texte">Exercices du chapitre</h3>

      {exercices === null && (
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton className="h-10 rounded-xl border border-dj-bordure" />
          <Skeleton className="h-10 rounded-xl border border-dj-bordure" style={{ animationDelay: "100ms" }} />
        </div>
      )}
      {exercices?.length === 0 && <p className="text-sm text-dj-texte-muet">Aucun exercice pour l&apos;instant.</p>}
      {exercices && exercices.length > 0 && (
        <div className="flex flex-col gap-2">
          {exercices.map((ex) => (
            <div
              key={ex.id}
              onClick={() => ouvrir(ex)}
              className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-dj-bordure bg-dj-surface px-4 py-3 transition-colors hover:border-dj-bordure-forte"
            >
              <span className="min-w-0 flex-1 truncate text-left text-sm text-dj-texte">
                {ex.enonce.trim() ? (
                  ex.enonce
                ) : (
                  <span className="flex items-center gap-1.5 italic text-dj-texte-muet">
                    <Paperclip size={12} /> Exercice sans texte (voir pièce jointe)
                  </span>
                )}
              </span>
              <div onClick={(e) => e.stopPropagation()}>
                <AjouterAClassementBouton cibleType="exercice" cibleId={ex.id} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-3">
        <label
          title="Créer un exercice à partir d'un fichier"
          className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-cgpt-bouton bg-dj-accent-1 py-2.5 text-sm font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          aria-disabled={envoiFichierEnCours}
        >
          <Paperclip size={16} />
          {envoiFichierEnCours ? "Envoi…" : "Ajouter un fichier"}
          <input
            type="file"
            multiple
            disabled={envoiFichierEnCours}
            accept="*/*"
            onChange={(e) => {
              const fichiers = Array.from(e.target.files ?? []);
              e.target.value = "";
              ajouterParFichier(fichiers);
            }}
            className="hidden"
          />
        </label>
      </div>
      {!formulaireTexteOuvert ? (
        <button
          type="button"
          onClick={() => setFormulaireTexteOuvert(true)}
          className="w-fit text-xs text-dj-texte-muet underline decoration-dotted transition-colors hover:text-dj-texte"
        >
          Ou taper un énoncé à la main
        </button>
      ) : (
        <div className="flex items-center gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-3">
          <textarea
            autoFocus
            value={nouvelEnonce}
            onChange={(e) => setNouvelEnonce(e.target.value)}
            placeholder="Énoncé du nouvel exercice…"
            rows={2}
            className="min-w-0 flex-1 resize-none rounded-xl border border-dj-bordure bg-dj-fond px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
          />
          <button
            onClick={ajouter}
            disabled={ajoutEnCours || !nouvelEnonce.trim()}
            title="Ajouter"
            className="flex-shrink-0 rounded-cgpt-bouton bg-dj-accent-1 p-2.5 text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
          >
            <Plus size={16} />
          </button>
        </div>
      )}
      {erreur && <p className="text-sm text-[var(--dj-erreur)]">{erreur}</p>}

      {panneau && (
        <PanneauFlottant
          onFerme={enregistrementEnCours || suppressionEnCours ? undefined : () => demarrerFermeture(fermer)}
          large
          enSortie={enSortie}
          entete={
            <div className="flex items-center justify-between">
              <span className="text-sm text-dj-texte-muet">Modifier cet exercice</span>
              <button
                onClick={() => demarrerFermeture(fermer)}
                disabled={enregistrementEnCours || suppressionEnCours}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-dj-texte-muet transition-colors hover:bg-dj-surface-haute disabled:opacity-50"
              >
                <X size={14} /> Fermer
              </button>
            </div>
          }
        >
          <textarea
            autoFocus
            value={texteOuvert}
            onChange={(e) => setTexteOuvert(e.target.value)}
            rows={8}
            className="w-full flex-1 resize-none rounded-xl border border-dj-bordure bg-dj-surface-haute px-4 py-3 text-base text-dj-texte outline-none focus:border-dj-bordure-forte"
          />

          <div className="w-full pt-4">
            <SectionDocumentsBibliotheque typeCible="exercice" cibleId={panneau.id} titre="Pièces jointes" />
            <SectionComportementsEmplacement typeCible="exercice" cibleId={panneau.id} titre="Skills" />
          </div>

          <div className="flex w-full flex-col gap-2 pt-4 sm:flex-row sm:items-center sm:justify-between">
            {erreurOuvert ? (
              <p className="text-xs text-[var(--dj-erreur)]">{erreurOuvert}</p>
            ) : (
              <span className="hidden sm:block" />
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={supprimer}
                disabled={enregistrementEnCours || suppressionEnCours}
                className="flex items-center gap-1.5 rounded-lg border border-dj-bordure px-3 py-2 text-sm text-[var(--dj-erreur)] transition-colors hover:bg-[var(--dj-erreur)]/10 disabled:opacity-50"
              >
                <Trash2 size={14} /> Supprimer
              </button>
              <button
                onClick={enregistrer}
                disabled={enregistrementEnCours || suppressionEnCours || !texteOuvert.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-dj-accent-1 px-4 py-2 text-sm font-semibold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
              >
                <Check size={14} /> {enregistrementEnCours ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </PanneauFlottant>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vue "programme sélectionné" : examens/devoirs multi-chapitres + publier
// comme plugin. `chapitres` est fourni par l'appelant (lot 4) -- c'est lui
// qui connaît la liste chargée des chapitres du programme, ce composant ne
// la recharge pas lui-même pour éviter un double appel.

const TYPES_EXAMEN: { id: TypeExamen; label: string }[] = [
  { id: "examen", label: "Examen" },
  { id: "devoir", label: "Devoir" },
  { id: "probleme_composite", label: "Problème composite" },
];

export function VueProgrammeContenu({
  programmeId,
  chapitres,
}: {
  programmeId: string;
  chapitres: { id: string; titre: string }[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <SectionComportementsEmplacement typeCible="programme" cibleId={programmeId} titre="Skills" />
      <SectionExamens programmeId={programmeId} chapitres={chapitres} />
      <SectionPublierPlugin programmeId={programmeId} />
    </div>
  );
}

function SectionExamens({
  programmeId,
  chapitres,
}: {
  programmeId: string;
  chapitres: { id: string; titre: string }[];
}) {
  const [examens, setExamens] = useState<Examen[] | null>(null);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [titre, setTitre] = useState("");
  const [type, setType] = useState<TypeExamen>("examen");
  const [chapitreIdsChoisis, setChapitreIdsChoisis] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function charger() {
    setExamens(null);
    lireExamensProgramme(programmeId)
      .then(setExamens)
      .catch(() => setExamens([]));
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programmeId]);

  // 15/08 (demande Bourama) : voir lib/evenementsDonnees.ts.
  useEffect(() => ecouterDonneesModifiees("programme", charger), [programmeId]);

  function basculerChapitre(id: string) {
    setChapitreIdsChoisis((prec) => (prec.includes(id) ? prec.filter((c) => c !== id) : [...prec, id]));
  }

  async function creer() {
    if (!titre.trim() || chapitreIdsChoisis.length === 0) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const cree = await creerExamen(titre.trim(), type, chapitreIdsChoisis);
      setExamens((prec) => [...(prec || []), cree]);
      setTitre("");
      setChapitreIdsChoisis([]);
      setFormulaireOuvert(false);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  }

  const [panneau, setPanneau] = useState<Examen | null>(null);
  const { enSortie, demarrerFermeture } = useFermetureAnimee();

  async function supprimer(id: string, titreExamen: string) {
    if (!window.confirm(`Supprimer « ${titreExamen} » ?`)) return;
    try {
      await supprimerExamen(id);
      setExamens((prec) => (prec || []).filter((e) => e.id !== id));
      setPanneau((p) => (p?.id === id ? null : p));
    } catch (e) {
      window.alert(messageErreur(e));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-dj-texte">Examens &amp; devoirs du programme</h3>
        <button
          onClick={() => setFormulaireOuvert((v) => !v)}
          className="flex items-center gap-1 rounded-cgpt-bouton border border-dj-bordure px-3 py-1.5 text-xs text-dj-texte transition-colors hover:border-dj-bordure-forte"
        >
          <Plus size={13} /> Nouveau
        </button>
      </div>

      {formulaireOuvert && (
        <div className="flex animate-dj-fade-in-rapide flex-col gap-3 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Titre"
              className="flex-1 rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-4 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
            />
            <div className="sm:w-48">
              <SelectPersonnalise
                valeur={type}
                onChange={(id) => setType(id as TypeExamen)}
                options={TYPES_EXAMEN.map((t) => ({ id: t.id, label: t.label }))}
              />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs text-dj-texte-muet">Chapitres couverts (plusieurs possibles) :</p>
            <div className="flex flex-wrap gap-1.5">
              {chapitres.map((c) => {
                const choisi = chapitreIdsChoisis.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => basculerChapitre(c.id)}
                    className={
                      "rounded-cgpt-bouton border px-3 py-1 text-xs transition-colors " +
                      (choisi
                        ? "border-dj-accent-1 bg-dj-accent-1/10 text-dj-accent-2"
                        : "border-dj-bordure text-dj-texte-muet hover:border-dj-bordure-forte")
                    }
                  >
                    {c.titre}
                  </button>
                );
              })}
              {chapitres.length === 0 && (
                <p className="text-xs text-dj-texte-muet">Aucun chapitre disponible dans ce programme.</p>
              )}
            </div>
          </div>

          {erreur && <p className="text-sm text-[var(--dj-erreur)]">{erreur}</p>}

          <button
            onClick={creer}
            disabled={envoi || !titre.trim() || chapitreIdsChoisis.length === 0}
            className="self-end rounded-cgpt-bouton bg-dj-accent-1 px-5 py-2 text-sm font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
          >
            {envoi ? "Création…" : "Créer"}
          </button>
        </div>
      )}

      {examens === null && (
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton className="h-12 rounded-xl border border-dj-bordure" />
        </div>
      )}
      {examens?.length === 0 && <p className="text-sm text-dj-texte-muet">Aucun examen ou devoir pour l&apos;instant.</p>}
      {examens && examens.length > 0 && (
        <div className="flex flex-col gap-2">
          {examens.map((ex) => (
            <div
              key={ex.id}
              onClick={() => setPanneau(ex)}
              className="flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded-xl border border-dj-bordure bg-dj-surface px-4 py-3 transition-colors hover:border-dj-bordure-forte"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-left text-sm text-dj-texte">{ex.titre}</p>
                <p className="text-xs text-dj-texte-muet">
                  {TYPES_EXAMEN.find((t) => t.id === ex.type)?.label ?? ex.type} · {ex.chapitre_ids.length} chapitre(s)
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <AjouterAClassementBouton cibleType="examen" cibleId={ex.id} />
                <button
                  onClick={() => supprimer(ex.id, ex.titre)}
                  className="text-xs text-dj-texte-muet transition-colors hover:text-[var(--dj-erreur)]"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {panneau && (
        <PanneauFlottant
          onFerme={() => demarrerFermeture(() => setPanneau(null))}
          enSortie={enSortie}
          entete={
            <div className="flex items-center justify-between">
              <span className="truncate text-sm text-dj-texte-muet">{panneau.titre}</span>
              <button
                onClick={() => demarrerFermeture(() => setPanneau(null))}
                className="flex flex-shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs text-dj-texte-muet transition-colors hover:bg-dj-surface-haute"
              >
                <X size={14} /> Fermer
              </button>
            </div>
          }
        >
          <SectionDocumentsBibliotheque typeCible="examen" cibleId={panneau.id} titre="Sujet / pièces jointes" />
          <SectionComportementsEmplacement typeCible="examen" cibleId={panneau.id} titre="Skills" />
        </PanneauFlottant>
      )}
    </div>
  );
}

function SectionPublierPlugin({ programmeId }: { programmeId: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [publie, setPublie] = useState(false);
  const [examensTransverses, setExamensTransverses] = useState<ExamenTransverse[] | null>(null);
  const [examensChoisis, setExamensChoisis] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!ouvert || examensTransverses !== null) return;
    examensTransversesProgramme(programmeId)
      .then(setExamensTransverses)
      .catch(() => setExamensTransverses([]));
  }, [ouvert, examensTransverses, programmeId]);

  function basculerExamenChoisi(id: string) {
    setExamensChoisis((precedent) => {
      const suivant = new Set(precedent);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });
  }

  async function publier() {
    if (!nom.trim()) return;
    if (!window.confirm(`Publier ce programme comme plugin « ${nom.trim()} », visible et téléchargeable par tous ?`))
      return;
    setEnvoi(true);
    setErreur(null);
    try {
      await publierProgrammeCommePlugin(programmeId, nom.trim(), Array.from(examensChoisis));
      setPublie(true);
      setOuvert(false);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
      <div className="flex items-center gap-2">
        <Rocket size={16} className="text-dj-texte-muet" />
        <h3 className="text-sm font-semibold text-dj-texte">Publier comme plugin</h3>
      </div>
      <p className="text-xs text-dj-texte-muet">
        Rend cet espace (matières, chapitres, documents, exercices, examens, classements) téléchargeable en un bloc
        par d&apos;autres élèves de la même classe.
      </p>

      {publie ? (
        <p className="flex items-center gap-1.5 text-sm text-dj-succes">
          <Check size={14} /> Plugin publié.
        </p>
      ) : ouvert ? (
        <div className="flex flex-col gap-3 animate-dj-fade-in-rapide">
          {examensTransverses === null && (
            <Skeleton className="h-10 rounded-xl border border-dj-bordure" />
          )}

          {examensTransverses && examensTransverses.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-dj-bordure bg-dj-fond p-3">
              <p className="text-xs text-dj-texte-muet">
                Ces examens/devoirs couvrent aussi des chapitres d&apos;un autre de tes programmes. Coche ceux à
                inclure quand même dans la copie (seuls les chapitres de <em>ce</em> programme seront repris) :
              </p>
              <div className="flex flex-col gap-1.5">
                {examensTransverses.map((ex) => (
                  <label key={ex.id} className="flex items-center gap-2 text-xs text-dj-texte">
                    <input
                      type="checkbox"
                      checked={examensChoisis.has(ex.id)}
                      onChange={() => basculerExamenChoisi(ex.id)}
                      className="h-3.5 w-3.5 accent-dj-accent-1"
                    />
                    <span className="truncate">{ex.titre}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Nom du plugin"
              className="flex-1 rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-4 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
            />
            <button
              onClick={publier}
              disabled={envoi || !nom.trim()}
              className="rounded-cgpt-bouton bg-dj-accent-1 px-5 py-2 text-sm font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
            >
              {envoi ? "Publication…" : "Publier"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOuvert(true)}
          className="self-start rounded-cgpt-bouton border border-dj-bordure px-4 py-2 text-sm text-dj-texte transition-colors hover:border-dj-bordure-forte"
        >
          Publier comme plugin
        </button>
      )}
      {erreur && <p className="text-sm text-[var(--dj-erreur)]">{erreur}</p>}
    </div>
  );
}
