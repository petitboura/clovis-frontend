"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Link as IconLien,
  FileText,
  Search,
  Paperclip,
  Image as IconImage,
  AudioLines as IconAudio,
  Video as IconVideo,
  Folder as IconDossier,
  FolderOpen as IconDossierOuvert,
  FolderPlus,
  FolderX,
  ChevronRight,
  Pencil,
  Upload,
  Loader2,
  X,
} from "lucide-react";
import {
  appelerApi,
  ajouterFichierBibliothequePersonnelle,
  ajouterLienBibliothequePersonnelle,
  ajouterTexteBibliothequePersonnelle,
  listerDossiersBibliotheque,
  creerDossierBibliotheque,
  renommerDossierBibliotheque,
  supprimerDossierBibliotheque,
  rangerFichierDansDossier,
  retirerFichierDuDossier,
  type DossierBibliotheque,
} from "@/lib/api";
import { messageErreur, ErreurApi } from "@/lib/erreurs";
import { Skeleton } from "./Skeleton";
import { CTACompteRequis } from "./CTACompteRequis";
import { VisionneuseBibliotheque } from "./VisionneuseBibliotheque";
import { BibliothequePublique } from "./BibliothequePublique";

// Onglet "Bibliothèque" de Mon espace, porté de
// djiguigne-frontend/app/dashboard/espace/page.tsx (même logique,
// juste extrait en composant autonome pour être un onglet parmi
// d'autres ici plutôt que toute la page). Personnel à chaque
// utilisateur : n'importe laquelle de ses IA peut consulter ces
// documents pendant une conversation (outil consulter_bibliotheque).
//
// Dossiers/sous-dossiers (22/08/2026, demande explicite de Bourama) :
// couche PAR DESSUS le listing plat existant, jamais un prérequis :
// un fichier ajouté reste "libre" (aucun dossier) tant qu'on ne le
// range pas explicitement quelque part, exactement comme avant. Un
// fichier peut être rangé dans PLUSIEURS dossiers à la fois (voir
// api/dossiers_bibliotheque.py). Le même arbre de dossiers est
// disponible dans chaque sous-onglet (Tous/Documents/Images/...) :
// dans un sous-onglet filtré par type, un dossier qui ne contient
// aucun fichier de ce type (lui ou ses sous-dossiers) est simplement
// masqué, jamais montré vide.

const URL_REGEX = /^https?:\/\/\S+$/i;

type FichierBiblio = {
  id: string;
  nom_fichier: string;
  type_mime: string;
  description: string | null;
  url_publique: string;
  created_at: string;
};

type SousOngletBiblio = "tous" | "documents" | "images" | "audio" | "videos" | "liens" | "texte";

const SOUS_ONGLETS: { id: SousOngletBiblio; label: string }[] = [
  { id: "tous", label: "Tous" },
  { id: "documents", label: "Documents" },
  { id: "images", label: "Images" },
  { id: "audio", label: "Audio" },
  { id: "videos", label: "Vidéos" },
  { id: "liens", label: "Liens" },
  { id: "texte", label: "Texte" },
];

function typeDe(f: FichierBiblio): SousOngletBiblio {
  if (f.type_mime === "text/uri-list") return "liens";
  if (f.type_mime === "text/plain") return "texte";
  if (f.type_mime.startsWith("image/")) return "images";
  if (f.type_mime.startsWith("audio/")) return "audio";
  if (f.type_mime.startsWith("video/")) return "videos";
  return "documents";
}

export function EspaceBibliotheque() {
  // 21/08/2026, demande Bourama : "un bibliothèque publique dans la
  // section bibliothèque" -- bascule entre la bibliothèque perso
  // (comportement par défaut, inchangé ci-dessous) et le catalogue
  // public (nouveau composant BibliothequePublique.tsx).
  const [vue, setVue] = useState<"perso" | "publique">("perso");
  const [sousOnglet, setSousOnglet] = useState<SousOngletBiblio>("tous");
  const [fichiers, setFichiers] = useState<FichierBiblio[] | null>(null);
  const [dossiers, setDossiers] = useState<DossierBibliotheque[] | null>(null);
  const [nouveauxFichiers, setNouveauxFichiers] = useState<File[]>([]);
  const [texteOuLien, setTexteOuLien] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreursEnvoi, setErreursEnvoi] = useState<{ nom: string; erreur: string }[]>([]);
  // Visiteur sans compte (refonte "Mon espace = l'app") -- section
  // auparavant inatteignable sans compte, même détection que
  // MesComportements.tsx : 401 -> CTA plutôt qu'une liste vide.
  const [sansCompte, setSansCompte] = useState(false);
  // Fenêtre de prévisualisation (17/08, Bourama : "rien pour ouvrir
  // chaque type dans l'app") -- remplace l'ouverture en nouvel onglet.
  const [fichierOuvert, setFichierOuvert] = useState<FichierBiblio | null>(null);

  // Navigation par dossier : pile du fil d'ariane, null = racine.
  const [pileDossiers, setPileDossiers] = useState<{ id: string; nom: string }[]>([]);
  const dossierCourantId = pileDossiers.length > 0 ? pileDossiers[pileDossiers.length - 1].id : null;
  const [nouveauNomDossier, setNouveauNomDossier] = useState("");
  const [creationDossierOuverte, setCreationDossierOuverte] = useState(false);
  const [dossierEnRenommage, setDossierEnRenommage] = useState<string | null>(null);
  const [fichierARanger, setFichierARanger] = useState<FichierBiblio | null>(null);
  // 25/08/2026, demande Bourama : depuis l'INTÉRIEUR d'un dossier
  // (jusque-là aucune action possible une fois dedans), pouvoir y faire
  // entrer directement des fichiers déjà existants ailleurs dans la
  // bibliothèque -- même mécanique many-to-many que fichierARanger,
  // juste vue depuis l'autre sens (un dossier, plusieurs fichiers) au
  // lieu d'un fichier, plusieurs dossiers.
  const [pickerFichiersOuvert, setPickerFichiersOuvert] = useState(false);
  const [uploadDansPickerEnCours, setUploadDansPickerEnCours] = useState(false);
  // 25/08/2026, demande Bourama : "pour les fichiers existants recherche
  // qui sait il peut en voir plusieurs" -- filtre simple par nom, la
  // liste pouvant vite devenir longue au fur et à mesure des uploads.
  const [rechercheFichiersExistants, setRechercheFichiersExistants] = useState("");
  // 25/08/2026, demande Bourama : "pourquoi on peut glisser pousser dans
  // un dossier aussi" -- glisser-déposer un fichier directement sur la
  // carte d'un dossier pour l'y ranger, en plus de l'icône dossier déjà
  // sur chaque ligne (qui reste l'équivalent tactile/clavier, le
  // drag-and-drop étant inutilisable au doigt sur mobile). dossierSurvole
  // pilote juste le style de survol pendant le glisser.
  const [dossierSurvole, setDossierSurvole] = useState<string | null>(null);

  async function deposerFichierDansDossier(dossierId: string, fichierId: string) {
    setDossierSurvole(null);
    try {
      await rangerFichierDansDossier(dossierId, fichierId);
      chargerDossiers();
    } catch (e) {
      window.alert(messageErreur(e));
    }
  }

  useEffect(() => {
    chargerFichiers();
    chargerDossiers();
  }, []);

  function chargerFichiers() {
    appelerApi("/api/bibliotheque")
      .then((r: FichierBiblio[]) => setFichiers(r))
      .catch((e) => {
        if (e instanceof ErreurApi && e.statusCode === 401) {
          setSansCompte(true);
        }
        setFichiers([]);
      });
  }

  function chargerDossiers() {
    listerDossiersBibliotheque()
      .then((r) => setDossiers(r))
      .catch(() => setDossiers([]));
  }

  const fichiersParId = useMemo(() => {
    const m = new Map<string, FichierBiblio>();
    (fichiers ?? []).forEach((f) => m.set(f.id, f));
    return m;
  }, [fichiers]);

  // Un fichier est "libre" s'il n'est rangé dans aucun dossier : il
  // n'apparaît alors qu'à la racine, jamais dans un dossier.
  const idsFichiersRanges = useMemo(() => {
    const s = new Set<string>();
    (dossiers ?? []).forEach((d) => d.fichier_ids.forEach((id) => s.add(id)));
    return s;
  }, [dossiers]);

  const enfantsDe = useMemo(() => {
    const m = new Map<string | null, DossierBibliotheque[]>();
    (dossiers ?? []).forEach((d) => {
      const cle = d.dossier_parent_id;
      if (!m.has(cle)) m.set(cle, []);
      m.get(cle)!.push(d);
    });
    return m;
  }, [dossiers]);

  // Un dossier contient un fichier du type filtré s'il en a un
  // directement, OU si un de ses sous-dossiers (récursivement) en a un,
  // sinon il est masqué dans ce sous-onglet (confirmé par Bourama :
  // jamais affiché vide).
  function dossierContientType(dossierId: string, type: SousOngletBiblio): boolean {
    if (type === "tous") return true;
    const dossier = (dossiers ?? []).find((d) => d.id === dossierId);
    if (!dossier) return false;
    const aUnFichierDuType = dossier.fichier_ids.some((fid) => {
      const f = fichiersParId.get(fid);
      return f && typeDe(f) === type;
    });
    if (aUnFichierDuType) return true;
    const enfants = enfantsDe.get(dossierId) ?? [];
    return enfants.some((e) => dossierContientType(e.id, type));
  }

  const sousDossiersAffiches = useMemo(() => {
    const enfants = enfantsDe.get(dossierCourantId) ?? [];
    return enfants.filter((d) => dossierContientType(d.id, sousOnglet));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enfantsDe, dossierCourantId, sousOnglet, fichiersParId]);

  const fichiersAffiches = useMemo(() => {
    if (!fichiers) return null;
    let base: FichierBiblio[];
    if (dossierCourantId === null) {
      base = fichiers.filter((f) => !idsFichiersRanges.has(f.id));
    } else {
      const dossier = (dossiers ?? []).find((d) => d.id === dossierCourantId);
      const ids = new Set(dossier?.fichier_ids ?? []);
      base = fichiers.filter((f) => ids.has(f.id));
    }
    if (sousOnglet === "tous") return base;
    return base.filter((f) => typeDe(f) === sousOnglet);
  }, [fichiers, dossiers, dossierCourantId, idsFichiersRanges, sousOnglet]);

  // 25/08/2026, demande Bourama ("le dossier est juste là et point") :
// tant qu'on est DANS un dossier, un ajout (fichier, texte, lien) doit y
// atterrir directement -- avant ce correctif, ajouter() ignorait
// totalement dossierCourantId, tout finissait "libre" à la racine, et il
// fallait sortir du dossier pour aller "ranger" le fichier après coup.
// 25/08/2026, demande Bourama ("le dossier est juste là et point") :
// tant qu'on est DANS un dossier, un ajout (fichier, texte, lien) doit y
// atterrir directement -- avant ce correctif, ajouter() ignorait
// totalement dossierCourantId, tout finissait "libre" à la racine, et il
// fallait sortir du dossier pour aller "ranger" le fichier après coup.
async function ajouter() {
    const texte = texteOuLien.trim();
    if (nouveauxFichiers.length === 0 && !texte) return;

    setEnvoi(true);
    setErreursEnvoi([]);
    const erreurs: { nom: string; erreur: string }[] = [];
    try {
      for (const fichier of nouveauxFichiers) {
        try {
          const ligne = await ajouterFichierBibliothequePersonnelle(fichier, "", "");
          if (dossierCourantId && ligne?.id) {
            await rangerFichierDansDossier(dossierCourantId, ligne.id);
          }
        } catch (e) {
          erreurs.push({ nom: fichier.name, erreur: messageErreur(e) });
        }
      }

      if (texte) {
        try {
          const ligne = URL_REGEX.test(texte)
            ? await ajouterLienBibliothequePersonnelle(texte)
            : await ajouterTexteBibliothequePersonnelle(texte);
          if (dossierCourantId && ligne?.id) {
            await rangerFichierDansDossier(dossierCourantId, ligne.id);
          }
        } catch (e) {
          erreurs.push({ nom: texte, erreur: messageErreur(e) });
        }
      }

      setErreursEnvoi(erreurs);
      setNouveauxFichiers([]);
      setTexteOuLien("");
      chargerFichiers();
      chargerDossiers();
    } finally {
      setEnvoi(false);
    }
  }

  async function supprimer(id: string, nom: string) {
    if (!window.confirm(`Supprimer « ${nom} » de ta bibliothèque ?`)) return;
    try {
      await appelerApi(`/api/bibliotheque/${id}`, { method: "DELETE" });
      chargerFichiers();
      chargerDossiers();
    } catch (e) {
      window.alert(messageErreur(e));
    }
  }

  async function creerDossier() {
    const nom = nouveauNomDossier.trim();
    if (!nom) return;
    try {
      await creerDossierBibliotheque(nom, dossierCourantId ?? undefined);
      setNouveauNomDossier("");
      setCreationDossierOuverte(false);
      chargerDossiers();
    } catch (e) {
      window.alert(messageErreur(e));
    }
  }

  async function renommerDossier(dossierId: string, nom: string) {
    const nouveauNom = nom.trim();
    if (!nouveauNom) return;
    try {
      await renommerDossierBibliotheque(dossierId, nouveauNom);
      setDossierEnRenommage(null);
      chargerDossiers();
    } catch (e) {
      window.alert(messageErreur(e));
    }
  }

  async function supprimerDossier(dossierId: string, nom: string) {
    if (
      !window.confirm(
        `Supprimer le dossier « ${nom} » ? Les fichiers qu'il contient et qui ne sont dans aucun autre dossier seront supprimés avec lui.`
      )
    )
      return;
    try {
      await supprimerDossierBibliotheque(dossierId);
      if (pileDossiers.some((d) => d.id === dossierId)) {
        setPileDossiers((p) => p.slice(0, p.findIndex((d) => d.id === dossierId)));
      }
      chargerDossiers();
      chargerFichiers();
    } catch (e) {
      window.alert(messageErreur(e));
    }
  }

  async function basculerRangement(dossierId: string, dejaRange: boolean) {
    if (!fichierARanger) return;
    try {
      if (dejaRange) {
        await retirerFichierDuDossier(dossierId, fichierARanger.id);
      } else {
        await rangerFichierDansDossier(dossierId, fichierARanger.id);
      }
      chargerDossiers();
    } catch (e) {
      window.alert(messageErreur(e));
    }
  }

  // 25/08/2026, demande Bourama : "ajouter des fichiers ici doit aussi
  // avoir upload direct, pas obligatoirement choisir" -- le picker
  // n'offrait jusque-là que des fichiers DÉJÀ existants ailleurs dans la
  // bibliothèque. Upload direct depuis ce même panneau, rangé
  // immédiatement dans le dossier ouvert (identique à ajouter() plus
  // haut quand on est dans un dossier), sans fermer le picker pour
  // pouvoir enchaîner plusieurs fichiers.
  async function uploaderDirectementDansDossier(fichiersChoisis: FileList | File[]) {
    if (dossierCourantId === null) return;
    setUploadDansPickerEnCours(true);
    try {
      for (const fichier of Array.from(fichiersChoisis)) {
        try {
          const ligne = await ajouterFichierBibliothequePersonnelle(fichier, "", "");
          if (ligne?.id) await rangerFichierDansDossier(dossierCourantId, ligne.id);
        } catch (e) {
          window.alert(`${fichier.name} : ${messageErreur(e)}`);
        }
      }
      chargerFichiers();
      chargerDossiers();
    } finally {
      setUploadDansPickerEnCours(false);
    }
  }

  if (sansCompte && vue === "perso") {
    return <CTACompteRequis texte="Crée un compte pour avoir ta propre bibliothèque de documents." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full gap-1 border-b border-dj-bordure">
        <button
          onClick={() => setVue("perso")}
          className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            vue === "perso" ? "border-dj-accent-1 text-dj-texte" : "border-transparent text-dj-texte-muet hover:text-dj-texte"
          }`}
        >
          Perso
        </button>
        <button
          onClick={() => setVue("publique")}
          className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            vue === "publique" ? "border-dj-accent-1 text-dj-texte" : "border-transparent text-dj-texte-muet hover:text-dj-texte"
          }`}
        >
          Publique
        </button>
      </div>

      {vue === "publique" ? (
        <BibliothequePublique />
      ) : (
        <>
      <p className="text-sm text-dj-texte-muet">
        Les documents ajoutés ici sont personnels : toi seul y as accès, et Clovis peut les consulter
        pendant une conversation.
      </p>

      <div className="flex flex-col gap-3 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            value={texteOuLien}
            onChange={(e) => setTexteOuLien(e.target.value)}
            placeholder="Colle un lien, ou écris/colle un texte…"
            className="flex-1 rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-4 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
          />
          <label className="flex cursor-pointer items-center gap-2 rounded-cgpt-bouton border border-dj-bordure px-4 py-2 text-xs text-dj-texte transition-colors hover:border-dj-bordure-forte">
            <Paperclip size={14} />
            {nouveauxFichiers.length > 0 ? `${nouveauxFichiers.length} fichier(s)` : "Joindre des fichiers"}
            <input
              type="file"
              multiple
              accept="*/*"
              onChange={(e) => setNouveauxFichiers(Array.from(e.target.files ?? []))}
              className="hidden"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={ajouter}
          disabled={(nouveauxFichiers.length === 0 && !texteOuLien.trim()) || envoi}
          className="self-end rounded-cgpt-bouton bg-dj-accent-1 px-5 py-2 text-sm font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
        >
          {envoi ? "Envoi…" : "Ajouter"}
        </button>
      </div>

      {erreursEnvoi.length > 0 && (
        <div className="flex flex-col gap-1 rounded-xl border border-[var(--dj-erreur)]/40 bg-[var(--dj-erreur)]/5 px-4 py-3">
          {erreursEnvoi.map((e) => (
            <p key={e.nom} className="text-sm text-[var(--dj-erreur)]">
              {e.nom} : {e.erreur}
            </p>
          ))}
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto text-xs">
        {SOUS_ONGLETS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSousOnglet(s.id)}
            className={
              "flex-shrink-0 rounded-cgpt-bouton px-3 py-1.5 font-semibold transition-colors " +
              (sousOnglet === s.id ? "bg-dj-surface-haute text-dj-texte" : "text-dj-texte-muet hover:text-dj-texte")
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Fil d'ariane + actions dossier (22/08) : navigation dans
          l'arborescence, la même pour chaque sous-onglet. */}
      <div className="flex flex-wrap items-center gap-1 text-xs text-dj-texte-muet">
        <button
          onClick={() => setPileDossiers([])}
          className={`rounded-cgpt-bouton px-2 py-1 font-medium transition-colors hover:text-dj-texte ${
            dossierCourantId === null ? "text-dj-texte" : ""
          }`}
        >
          Bibliothèque
        </button>
        {pileDossiers.map((d, i) => (
          <span key={d.id} className="flex items-center gap-1">
            <ChevronRight size={12} className="flex-shrink-0" />
            <button
              onClick={() => setPileDossiers((p) => p.slice(0, i + 1))}
              className={`rounded-cgpt-bouton px-2 py-1 font-medium transition-colors hover:text-dj-texte ${
                i === pileDossiers.length - 1 ? "text-dj-texte" : ""
              }`}
            >
              {d.nom}
            </button>
          </span>
        ))}
        <button
          onClick={() => setCreationDossierOuverte((v) => !v)}
          className="ml-auto flex items-center gap-1 rounded-cgpt-bouton px-2 py-1 font-semibold text-dj-texte-muet transition-colors hover:text-dj-texte"
        >
          <FolderPlus size={14} />
          Nouveau dossier
        </button>
        {dossierCourantId !== null && (
          <button
            onClick={() => setPickerFichiersOuvert(true)}
            className="flex items-center gap-1 rounded-cgpt-bouton px-2 py-1 font-semibold text-dj-texte-muet transition-colors hover:text-dj-texte"
          >
            <IconDossierOuvert size={14} />
            Ajouter des fichiers ici
          </button>
        )}
      </div>

      {creationDossierOuverte && (
        <div className="flex animate-dj-fade-in-rapide items-center gap-2">
          <input
            autoFocus
            type="text"
            value={nouveauNomDossier}
            onChange={(e) => setNouveauNomDossier(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && creerDossier()}
            placeholder="Nom du dossier…"
            className="flex-1 rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-3 py-1.5 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
          />
          <button
            onClick={creerDossier}
            className="rounded-cgpt-bouton bg-dj-accent-1 px-3 py-1.5 text-xs font-bold text-[#1A0D02] hover:bg-dj-accent-2"
          >
            Créer
          </button>
          <button
            onClick={() => {
              setCreationDossierOuverte(false);
              setNouveauNomDossier("");
            }}
            className="text-dj-texte-muet hover:text-dj-texte"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {dossiers === null && fichiersAffiches === null && (
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton className="h-14 rounded-xl border border-dj-bordure" />
          <Skeleton className="h-14 rounded-xl border border-dj-bordure" style={{ animationDelay: "100ms" }} />
        </div>
      )}

      {sousDossiersAffiches.length > 0 && (
        <div className="flex flex-col gap-2">
          {sousDossiersAffiches.map((d) => (
            <div
              key={d.id}
              onDragOver={(e) => {
                e.preventDefault();
                if (dossierSurvole !== d.id) setDossierSurvole(d.id);
              }}
              onDragLeave={() => setDossierSurvole((id) => (id === d.id ? null : id))}
              onDrop={(e) => {
                e.preventDefault();
                const fichierId = e.dataTransfer.getData("text/fichier-bibliotheque-id");
                if (fichierId) deposerFichierDansDossier(d.id, fichierId);
              }}
              className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors ${
                dossierSurvole === d.id ? "border-dj-accent-1 bg-dj-surface-haute" : "border-dj-bordure bg-dj-surface"
              }`}
            >
              {dossierEnRenommage === d.id ? (
                <input
                  autoFocus
                  type="text"
                  defaultValue={d.nom}
                  onKeyDown={(e) => e.key === "Enter" && renommerDossier(d.id, (e.target as HTMLInputElement).value)}
                  onBlur={(e) => renommerDossier(d.id, e.target.value)}
                  className="flex-1 rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-2 py-1 text-sm text-dj-texte outline-none"
                />
              ) : (
                <button
                  onClick={() => setPileDossiers((p) => [...p, { id: d.id, nom: d.nom }])}
                  className="flex min-w-0 items-center gap-2 text-sm text-dj-texte hover:text-dj-texte"
                >
                  <IconDossier size={16} className="flex-shrink-0 text-dj-texte-muet" />
                  <span className="truncate font-medium">{d.nom}</span>
                </button>
              )}
              <div className="flex flex-shrink-0 items-center gap-3 text-xs text-dj-texte-muet">
                <button onClick={() => setDossierEnRenommage(d.id)} className="hover:text-dj-texte" title="Renommer">
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => supprimerDossier(d.id, d.nom)}
                  className="hover:text-[var(--dj-erreur)]"
                  title="Supprimer le dossier"
                >
                  <FolderX size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {fichiersAffiches?.length === 0 && sousDossiersAffiches.length === 0 && (
        <p className="text-sm text-dj-texte-muet">Rien ici pour l&apos;instant.</p>
      )}
      {fichiersAffiches && fichiersAffiches.length > 0 && (
        <div className="flex flex-col gap-2">
          {fichiersAffiches.map((f) => {
            const type = typeDe(f);
            const Icone =
              type === "liens" ? IconLien
              : type === "texte" ? FileText
              : type === "images" ? IconImage
              : type === "audio" ? IconAudio
              : type === "videos" ? IconVideo
              : Paperclip;
            return (
              <div
                key={f.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/fichier-bibliotheque-id", f.id)}
                className="flex items-center justify-between gap-3 rounded-xl border border-dj-bordure bg-dj-surface px-4 py-3 cursor-grab active:cursor-grabbing"
              >
                <button
                  onClick={() => setFichierOuvert(f)}
                  className="flex min-w-0 items-center gap-2 text-sm text-dj-texte hover:underline"
                >
                  <Icone size={14} className="flex-shrink-0" />
                  <span className="truncate">{f.description || f.nom_fichier}</span>
                </button>
                <div className="flex flex-shrink-0 items-center gap-3 text-xs text-dj-texte-muet">
                  <button
                    onClick={() => setFichierARanger(f)}
                    className="hover:text-dj-texte"
                    title="Ranger dans un dossier"
                  >
                    <IconDossierOuvert size={14} />
                  </button>
                  <button
                    onClick={() => supprimer(f.id, f.description || f.nom_fichier)}
                    className="transition-colors hover:text-[var(--dj-erreur)]"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Panneau "ranger dans un dossier" (22/08) : liste tous les
          dossiers de l'utilisateur avec une case à cocher : un fichier
          peut être rattaché à plusieurs dossiers à la fois. */}
      {fichierARanger && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 animate-dj-fade-in-rapide sm:items-center"
          onClick={() => setFichierARanger(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-sm flex-col gap-3 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-dj-texte">
                Ranger « {fichierARanger.description || fichierARanger.nom_fichier} »
              </p>
              <button onClick={() => setFichierARanger(null)} className="text-dj-texte-muet hover:text-dj-texte">
                <X size={16} />
              </button>
            </div>
            {(dossiers ?? []).length === 0 && (
              <p className="text-xs text-dj-texte-muet">Aucun dossier pour l&apos;instant. Crée-en un d&apos;abord.</p>
            )}
            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {(dossiers ?? []).map((d) => {
                const dejaRange = d.fichier_ids.includes(fichierARanger.id);
                return (
                  <label
                    key={d.id}
                    className="flex cursor-pointer items-center gap-2 rounded-cgpt-bouton px-2 py-1.5 text-sm text-dj-texte hover:bg-dj-surface-haute"
                  >
                    <input
                      type="checkbox"
                      checked={dejaRange}
                      onChange={() => basculerRangement(d.id, dejaRange)}
                    />
                    <IconDossier size={14} className="text-dj-texte-muet" />
                    {d.nom}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <VisionneuseBibliotheque
        fichier={fichierOuvert}
        onFermer={() => setFichierOuvert(null)}
        onRanger={() => {
          if (fichierOuvert) {
            setFichierARanger(fichierOuvert);
            setFichierOuvert(null); // ferme l'aperçu (z-index sous la modale ranger sinon)
          }
        }}
      />

      {/* 25/08/2026, demande Bourama : picker inverse de la modale
          "ranger" ci-dessus -- ici on choisit, DEPUIS un dossier ouvert,
          quels fichiers (de partout dans la bibliothèque) y ajouter.
          Couvre à la fois "copier" (le fichier reste aussi dans son
          autre dossier / à la racine, many-to-many déjà en place) et
          "déplacer" (décocher la case ailleurs après coup, ou
          directement ici si le fichier apparaît déjà ranged -- la case
          reflète l'état réel, cocher/décocher suffit dans les deux
          cas). */}
      {pickerFichiersOuvert && dossierCourantId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 animate-dj-fade-in-rapide sm:items-center"
          onClick={() => setPickerFichiersOuvert(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-sm flex-col gap-3 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-dj-texte">
                Ajouter à « {pileDossiers[pileDossiers.length - 1]?.nom} »
              </p>
              <button
                onClick={() => setPickerFichiersOuvert(false)}
                className="text-dj-texte-muet hover:text-dj-texte"
              >
                <X size={16} />
              </button>
            </div>

            <input
              id="upload-direct-dossier"
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && uploaderDirectementDansDossier(e.target.files)}
            />
            <label
              htmlFor="upload-direct-dossier"
              className="flex cursor-pointer items-center justify-center gap-2 rounded-cgpt-bouton border border-dashed border-dj-bordure px-4 py-2.5 text-sm text-dj-texte-muet transition-colors hover:border-dj-bordure-forte hover:text-dj-texte"
            >
              {uploadDansPickerEnCours ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Upload size={15} />
              )}
              {uploadDansPickerEnCours ? "Envoi…" : "Uploader un nouveau fichier ici"}
            </label>

            <div className="flex items-center gap-2 text-xs text-dj-texte-muet">
              <div className="h-px flex-1 bg-dj-bordure" />
              ou choisir un fichier existant
              <div className="h-px flex-1 bg-dj-bordure" />
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dj-texte-muet" />
              <input
                value={rechercheFichiersExistants}
                onChange={(e) => setRechercheFichiersExistants(e.target.value)}
                placeholder="Rechercher un fichier..."
                className="w-full rounded-cgpt-bouton border border-dj-bordure bg-dj-fond py-1.5 pl-8 pr-3 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
              />
            </div>
            {(fichiers ?? []).length === 0 && (
              <p className="text-xs text-dj-texte-muet">Aucun fichier dans ta bibliothèque pour l&apos;instant.</p>
            )}
            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {(fichiers ?? [])
                .filter((f) =>
                  (f.description || f.nom_fichier).toLowerCase().includes(rechercheFichiersExistants.trim().toLowerCase())
                )
                .map((f) => {
                const dossierActuel = (dossiers ?? []).find((d) => d.id === dossierCourantId);
                const dejaDedans = dossierActuel?.fichier_ids.includes(f.id) ?? false;
                return (
                  <label
                    key={f.id}
                    className="flex cursor-pointer items-center gap-2 rounded-cgpt-bouton px-2 py-1.5 text-sm text-dj-texte hover:bg-dj-surface-haute"
                  >
                    <input
                      type="checkbox"
                      checked={dejaDedans}
                      onChange={async () => {
                        try {
                          if (dejaDedans) {
                            await retirerFichierDuDossier(dossierCourantId, f.id);
                          } else {
                            await rangerFichierDansDossier(dossierCourantId, f.id);
                          }
                          chargerDossiers();
                        } catch (e) {
                          window.alert(messageErreur(e));
                        }
                      }}
                    />
                    <span className="truncate">{f.description || f.nom_fichier}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

