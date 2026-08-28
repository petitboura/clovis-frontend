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
  Plus,
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
import { EspaceDossiers } from "./EspaceDossiers";

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
  const [vue, setVue] = useState<"perso" | "publique" | "dossiers">("perso");
  const [sousOnglet, setSousOnglet] = useState<SousOngletBiblio>("tous");
  const [fichiers, setFichiers] = useState<FichierBiblio[] | null>(null);
  const [dossiers, setDossiers] = useState<DossierBibliotheque[] | null>(null);
  const [texteOuLien, setTexteOuLien] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreursEnvoi, setErreursEnvoi] = useState<{ nom: string; erreur: string }[]>([]);
  // 27/08/2026, refonte "Ajouter" (demande Bourama : la carte d'ajout
  // fixe prenait toute la place) -- remplacée par un bouton flottant
  // unique (voir JSX en bas) qui ouvre un petit menu (Importer / Texte /
  // Lien). Fichiers et dossier partagent la même entrée "Importer" (pas
  // de catégorie séparée pour dossier, demande explicite) ; Texte/Lien
  // ouvrent une mini-modale avec un champ Titre (optionnel, l'API le
  // supportait déjà côté backend mais n'était jamais exposé côté UI).
  const [menuAjoutOuvert, setMenuAjoutOuvert] = useState(false);
  const [modaleAjout, setModaleAjout] = useState<"texte" | "lien" | null>(null);
  const [titreAjout, setTitreAjout] = useState("");
  // Upload de dossier (webkitdirectory) : fonctionne sur PC et navigateur
  // mobile, PAS dans l'app native Capacitor (limite de la plateforme,
  // pas du code -- pas de plugin natif dédié pour l'instant, décision de
  // Bourama). L'arborescence exacte du dossier importé (sous-dossiers
  // compris) est recréée dans Clovis -- voir envoyerDossierDirect plus
  // bas pour le détail et son historique de correctifs.
  const [uploadDossierEnCours, setUploadDossierEnCours] = useState(false);
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
    // CORRECTIF 2026-08-27 (bug remonté par Bourama : "d'abord liste
    // plate, ensuite ça se range") -- fichiers et dossiers se chargent
    // en parallèle (deux appels API séparés, voir useEffect plus haut).
    // Si `fichiers` arrive avant `dossiers`, idsFichiersRanges est
    // encore vide (basé sur `dossiers ?? []`) : TOUS les fichiers
    // semblent "libres" un court instant, d'où le flash à plat avant
    // que le rangement ne s'applique une fois `dossiers` arrivé. On
    // attend maintenant que les DEUX soient chargés avant de calculer
    // quoi que ce soit (voir le Skeleton affiché plus bas tant que
    // fichiersAffiches est null).
    if (!fichiers || !dossiers) return null;
    let base: FichierBiblio[];
    if (dossierCourantId === null) {
      base = fichiers.filter((f) => !idsFichiersRanges.has(f.id));
    } else {
      const dossier = dossiers.find((d) => d.id === dossierCourantId);
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
async function envoyerFichiersDirect(fichiersChoisis: FileList | File[]) {
    const liste = Array.from(fichiersChoisis);
    if (liste.length === 0) return;
    setEnvoi(true);
    setErreursEnvoi([]);
    const erreurs: { nom: string; erreur: string }[] = [];
    try {
      for (const fichier of liste) {
        try {
          const ligne = await ajouterFichierBibliothequePersonnelle(fichier, "", "");
          if (dossierCourantId && ligne?.id) {
            await rangerFichierDansDossier(dossierCourantId, ligne.id);
          }
        } catch (e) {
          erreurs.push({ nom: fichier.name, erreur: messageErreur(e) });
        }
      }
      setErreursEnvoi(erreurs);
      chargerFichiers();
      chargerDossiers();
    } finally {
      setEnvoi(false);
    }
  }

  // 27/08/2026, demande Bourama : upload d'un dossier entier depuis
  // l'appareil (voir champ webkitdirectory sur l'input plus bas). Web/PC
  // + navigateur mobile uniquement (voir commentaire sur
  // uploadDossierEnCours plus haut).
  // CORRECTIF (27/08, même jour) : la première version mettait tous les
  // fichiers à plat dans un seul dossier -- Bourama veut l'arborescence
  // EXACTE (sous-dossiers compris), comme sur son PC. webkitRelativePath
  // donne le chemin complet par fichier (ex: "Cours/Chimie/td1.pdf") ; on
  // recrée chaque segment de dossier une seule fois (cache par chemin),
  // récursivement du parent vers l'enfant, avant d'y ranger le fichier.
  // CORRECTIF 2 (27/08, retour Bourama : "des sous-dossiers toujours pas
  // traités, ça reste à plat") : si la création d'UN segment de dossier
  // échouait (aléa réseau, session, etc.), l'ancien code renvoyait
  // `undefined` pour ce chemin -- indiscernable du cas "à la racine,
  // c'est normal" -- et continuait quand même à uploader tous les
  // fichiers de ce sous-dossier (et de ses propres sous-dossiers), qui
  // finissaient donc "libres" à la racine, à plat, avec pour seul indice
  // une ligne d'erreur unique sur le DOSSIER (jamais sur les fichiers
  // eux-mêmes, invisible si on n'a pas fait défiler). Un dossier créé
  // avec succès mémorise maintenant son id ; un dossier en échec
  // mémorise un échec explicite et le fait REMONTER (throw) à tous ses
  // descendants -- un fichier n'est donc plus jamais envoyé "au cas où"
  // dans le mauvais endroit : soit il part au bon endroit, soit il ne
  // part pas du tout, avec une erreur claire et complète (chemin entier,
  // pas juste le nom du fichier) dans erreursEnvoi.
  async function envoyerDossierDirect(fichiersChoisis: FileList | File[]) {
    const liste = Array.from(fichiersChoisis) as (File & { webkitRelativePath?: string })[];
    if (liste.length === 0) return;
    setUploadDossierEnCours(true);
    setErreursEnvoi([]);
    const erreurs: { nom: string; erreur: string }[] = [];
    const dossiersCrees = new Map<string, string | null>();

    async function obtenirDossierPourChemin(segments: string[]): Promise<string | undefined> {
      if (segments.length === 0) return dossierCourantId ?? undefined;
      const chemin = segments.join("/");
      if (dossiersCrees.has(chemin)) {
        const id = dossiersCrees.get(chemin);
        if (id === null) throw new Error(`Le dossier « ${segments[segments.length - 1]} » n'a pas pu être créé`);
        return id;
      }
      // Propage naturellement une éventuelle erreur du parent -- on ne
      // tente jamais de créer un sous-dossier sous un parent en échec.
      const parentId = await obtenirDossierPourChemin(segments.slice(0, -1));
      const nom = segments[segments.length - 1];
      let id: string | undefined;
      try {
        const dossier = await creerDossierBibliotheque(nom, parentId);
        id = dossier?.id;
      } catch {
        id = undefined;
      }
      dossiersCrees.set(chemin, id ?? null);
      if (!id) throw new Error(`Le dossier « ${nom} » n'a pas pu être créé`);
      return id;
    }

    try {
      for (const fichier of liste) {
        const chemin = fichier.webkitRelativePath || fichier.name;
        try {
          const segmentsDossier = chemin.split("/").slice(0, -1);
          const dossierId = await obtenirDossierPourChemin(segmentsDossier);
          const ligne = await ajouterFichierBibliothequePersonnelle(fichier, "", "");
          if (ligne?.id && dossierId) {
            // Léger réessai (26/08 -- aléa réseau ponctuel observé sur
            // de longs envois séquentiels) : un fichier déjà envoyé ne
            // doit pas finir orphelin (non rangé, donc "à plat") pour
            // un simple blip -- 1 nouvelle tentative avant d'abandonner.
            try {
              await rangerFichierDansDossier(dossierId, ligne.id);
            } catch {
              await rangerFichierDansDossier(dossierId, ligne.id);
            }
          }
        } catch (e) {
          erreurs.push({ nom: chemin, erreur: messageErreur(e) });
        }
      }
      setErreursEnvoi(erreurs);
      chargerFichiers();
      chargerDossiers();
    } catch (e) {
      window.alert(messageErreur(e));
    } finally {
      setUploadDossierEnCours(false);
    }
  }

  // 27/08/2026, demande Bourama : champ Titre exposé pour texte/lien
  // (déjà supporté côté API, jamais branché côté UI). Le type
  // (texte/lien) vient désormais du bouton cliqué dans le menu du FAB
  // (modaleAjout), plus besoin de deviner via URL_REGEX -- gardé en
  // repli si jamais modaleAjout est null.
  async function envoyerTexteOuLien() {
    const contenu = texteOuLien.trim();
    if (!contenu) return;
    const titre = titreAjout.trim();
    setEnvoi(true);
    setErreursEnvoi([]);
    try {
      const estLien = modaleAjout === "lien" || (modaleAjout === null && URL_REGEX.test(contenu));
      const ligne = estLien
        ? await ajouterLienBibliothequePersonnelle(contenu, titre || undefined)
        : await ajouterTexteBibliothequePersonnelle(contenu, titre || undefined);
      if (dossierCourantId && ligne?.id) {
        await rangerFichierDansDossier(dossierCourantId, ligne.id);
      }
      setTexteOuLien("");
      setTitreAjout("");
      setModaleAjout(null);
      chargerFichiers();
      chargerDossiers();
    } catch (e) {
      setErreursEnvoi([{ nom: titre || contenu, erreur: messageErreur(e) }]);
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
        {/* Fusion Dossiers du téléphone (26/08/2026, décision Bourama) --
            même plugin natif que la bibliothèque perso/publique mais
            source différente (SAF système, pas les fichiers Clovis) --
            voir /areas/clovis.md pour le détail de la décision. Le
            composant lui-même gère déjà son état "disponible seulement
            sur mobile" (usePluginNatif), donc pas de logique conditionnelle
            à dupliquer ici. */}
        <button
          onClick={() => setVue("dossiers")}
          className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            vue === "dossiers" ? "border-dj-accent-1 text-dj-texte" : "border-transparent text-dj-texte-muet hover:text-dj-texte"
          }`}
        >
          Dossiers du téléphone
        </button>
      </div>

      {vue === "publique" ? (
        <BibliothequePublique />
      ) : vue === "dossiers" ? (
        <EspaceDossiers />
      ) : (
        <>
      <p className="text-sm text-dj-texte-muet">
        Les documents ajoutés ici sont personnels : toi seul y as accès, et Clovis peut les consulter
        pendant une conversation.
      </p>

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

      {fichiersAffiches === null && (
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

      {/* 27/08/2026, refonte "Ajouter" (demande Bourama) : bouton flottant
          unique, menu au clic (Importer / Texte / Lien). Fichiers et
          dossier partagent la même entrée "Importer" -- pas de catégorie
          "Dossier" séparée, juste rendue possible via un second input
          caché (webkitdirectory). CORRECTIF (27/08, même jour) : posé à
          GAUCHE (pas à droite comme la première version) -- ChatFlottant
          est monté globalement dans AppShell.tsx (jamais démonté au
          changement de page), toujours en bas à droite, y compris agrandi
          en plein panneau de chat -- un FAB à droite le recouvrait/était
          recouvert par lui sur cette page. Marge de la barre native
          mobile reprise de BarreDeSaisie.tsx. */}
      <input
        id="ajout-fab-fichiers"
        type="file"
        multiple
        accept="*/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) envoyerFichiersDirect(e.target.files);
          e.target.value = "";
          setMenuAjoutOuvert(false);
        }}
      />
      <input
        id="ajout-fab-dossier"
        type="file"
        multiple
        // @ts-expect-error -- webkitdirectory n'est pas dans le typage React standard, mais bien supporté par les navigateurs (PC + mobile web, pas l'app native)
        webkitdirectory=""
        className="hidden"
        onChange={(e) => {
          if (e.target.files) envoyerDossierDirect(e.target.files);
          e.target.value = "";
          setMenuAjoutOuvert(false);
        }}
      />

      {(envoi || uploadDossierEnCours) && (
        <div className="fixed bottom-[calc(6rem+var(--cap-native-navigation-bottom,0px))] left-5 z-40 flex items-center gap-2 rounded-cgpt-bouton border border-dj-bordure bg-dj-surface px-3 py-2 text-xs text-dj-texte shadow-xl">
          <Loader2 size={14} className="animate-spin" />
          Envoi…
        </div>
      )}

      {menuAjoutOuvert && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setMenuAjoutOuvert(false)}
        />
      )}
      {menuAjoutOuvert && (
        <div className="fixed bottom-[calc(6rem+var(--cap-native-navigation-bottom,0px))] left-5 z-40 flex flex-col items-start gap-2">
          <label
            htmlFor="ajout-fab-fichiers"
            className="flex cursor-pointer items-center gap-2 rounded-cgpt-bouton border border-dj-bordure bg-dj-surface px-4 py-2 text-sm font-medium text-dj-texte shadow-lg transition-colors hover:border-dj-bordure-forte"
          >
            Importer des fichiers
            <Upload size={15} />
          </label>
          <label
            htmlFor="ajout-fab-dossier"
            className="flex cursor-pointer items-center gap-2 rounded-cgpt-bouton border border-dj-bordure bg-dj-surface px-4 py-2 text-sm font-medium text-dj-texte shadow-lg transition-colors hover:border-dj-bordure-forte"
          >
            Importer un dossier
            <IconDossier size={15} />
          </label>
          <button
            onClick={() => {
              setModaleAjout("texte");
              setMenuAjoutOuvert(false);
            }}
            className="flex items-center gap-2 rounded-cgpt-bouton border border-dj-bordure bg-dj-surface px-4 py-2 text-sm font-medium text-dj-texte shadow-lg transition-colors hover:border-dj-bordure-forte"
          >
            Texte
            <FileText size={15} />
          </button>
          <button
            onClick={() => {
              setModaleAjout("lien");
              setMenuAjoutOuvert(false);
            }}
            className="flex items-center gap-2 rounded-cgpt-bouton border border-dj-bordure bg-dj-surface px-4 py-2 text-sm font-medium text-dj-texte shadow-lg transition-colors hover:border-dj-bordure-forte"
          >
            Lien
            <IconLien size={15} />
          </button>
        </div>
      )}
      <button
        onClick={() => setMenuAjoutOuvert((v) => !v)}
        aria-label={menuAjoutOuvert ? "Fermer le menu d'ajout" : "Ajouter"}
        className="fixed bottom-[calc(1.25rem+var(--cap-native-navigation-bottom,0px))] left-5 z-40 flex h-14 w-14 items-center justify-center rounded-cgpt-bouton bg-dj-accent-1 text-[#1A0D02] shadow-[0_4px_20px_rgba(0,0,0,0.35)] transition-transform hover:bg-dj-accent-2"
      >
        <Plus size={24} className={`transition-transform ${menuAjoutOuvert ? "rotate-45" : ""}`} />
      </button>

      {modaleAjout && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 animate-dj-fade-in-rapide sm:items-center"
          onClick={() => {
            setModaleAjout(null);
            setTitreAjout("");
            setTexteOuLien("");
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-sm flex-col gap-3 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-dj-texte">
                {modaleAjout === "lien" ? "Ajouter un lien" : "Ajouter un texte"}
              </p>
              <button
                onClick={() => {
                  setModaleAjout(null);
                  setTitreAjout("");
                  setTexteOuLien("");
                }}
                className="text-dj-texte-muet hover:text-dj-texte"
              >
                <X size={16} />
              </button>
            </div>
            <input
              type="text"
              value={titreAjout}
              onChange={(e) => setTitreAjout(e.target.value)}
              placeholder="Titre (optionnel)"
              className="w-full rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
            />
            {modaleAjout === "lien" ? (
              <input
                autoFocus
                type="text"
                value={texteOuLien}
                onChange={(e) => setTexteOuLien(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && envoyerTexteOuLien()}
                placeholder="Colle un lien…"
                className="w-full rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
              />
            ) : (
              <textarea
                autoFocus
                value={texteOuLien}
                onChange={(e) => setTexteOuLien(e.target.value)}
                placeholder="Écris ou colle ton texte…"
                rows={5}
                className="w-full rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
              />
            )}
            <button
              type="button"
              onClick={envoyerTexteOuLien}
              disabled={!texteOuLien.trim() || envoi}
              className="self-end rounded-cgpt-bouton bg-dj-accent-1 px-5 py-2 text-sm font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
            >
              {envoi ? "Envoi…" : "Ajouter"}
            </button>
          </div>
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

