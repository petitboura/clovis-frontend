"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search, Plus, Trash2, Paperclip, FileText, Image as IconImage, Music as IconAudio, Video as IconVideo,
  Flag, FolderPlus, Check, Link as IconLien, Upload, FolderX, X, Globe, Lock, Loader2, Download, ChevronLeft,
  SlidersHorizontal, Move, FolderMinus, Bell, XCircle, CheckSquare, Share2,
} from "lucide-react";
import {
  listerBibliothequePublique,
  ajouterABibliothequePublique,
  ajouterFichiersABibliothequePublique,
  ajouterLienBibliothequePublique,
  ajouterTexteBibliothequePublique,
  supprimerDeBibliothequePublique,
  reessayerVectorisationBibliothequePublique,
  copierVersBibliothequePersonnelle,
  creerDossierCataloguePublic,
  supprimerDossierCataloguePublic,
  deplacerDossierCataloguePublic,
  retirerFichierDossierCataloguePublic,
  deplacerFichierDossierCataloguePublic,
  listerDemandesEnAttenteCataloguePublic,
  confirmerDemandeCataloguePublic,
  refuserDemandeCataloguePublic,
  listerListesFiltresBibliothequePublique,
  attacherDossierPublic,
  detacherDossierPublic,
  type EntreeBibliothequePublique,
  type DossierCataloguePublic,
  type DemandeDossierCataloguePublic,
  type ListesFiltresBibliothequePublique,
} from "@/lib/api";
import { useDossiersCataloguePublic } from "@/lib/contexteDossiersCataloguePublic";
import { messageErreur, ErreurApi } from "@/lib/erreurs";
import { CTACompteRequis } from "@/components/CTACompteRequis";
import { CompteRequisModal } from "@/components/CompteRequisModal";
import { SignalerContenuModal } from "@/components/SignalerContenuModal";
import { DeplacerVersModal } from "@/components/DeplacerVersModal";
import { VisionneuseBibliotheque } from "@/components/VisionneuseBibliotheque";
import { telecharger } from "@/lib/telecharger";
import { SelectPersonnalise } from "@/components/SelectPersonnalise";
import { Skeleton } from "./Skeleton";
import { ButtonPartager, lienPartage } from "./ButtonPartager";
import { CaseACocher } from "./CaseACocher";
import { BarreActionsSelection, type ActionSelection } from "./BarreActionsSelection";
import { useSelectionMultiple } from "@/lib/useSelectionMultiple";

// 09/09/2026, demande Bourama ("confirmation contributeurs") : décrit
// CE qu'on est en train de déplacer, le temps que la modale de choix de
// destination soit ouverte -- soit un fichier (dans le dossier
// actuellement ouvert), soit un sous-dossier (dans son propre parent).
type CibleDeplacement =
  | { type: "fichier"; entree: EntreeBibliothequePublique; dossierSourceId: string }
  | { type: "dossier"; dossier: DossierCataloguePublic };

function libelleActionDemande(action: DemandeDossierCataloguePublic["action"]): string {
  switch (action) {
    case "deplacer_fichier":
      return "Déplacer un fichier";
    case "supprimer_fichier":
      return "Retirer un fichier";
    case "deplacer_dossier":
      return "Déplacer un sous-dossier";
    case "supprimer_dossier":
      return "Supprimer un sous-dossier";
  }
}

function iconePourType(typeMime: string | null) {
  if (!typeMime) return Paperclip;
  if (typeMime === "text/uri-list") return IconLien;
  if (typeMime === "text/plain") return FileText;
  if (typeMime?.startsWith("image/")) return IconImage;
  if (typeMime?.startsWith("audio/")) return IconAudio;
  if (typeMime?.startsWith("video/")) return IconVideo;
  return Paperclip;
}

// 03/09/2026, demande Bourama : "on a un filtre par type on va ajouter
// un filtre par pays, niveau et catégorie" -- le filtre par type
// n'existait en réalité que dans EspaceBibliotheque.tsx (bibliothèque
// PRIVÉE), jamais ici. Repris tel quel (mêmes catégories, même logique
// de détection par type_mime) pour que le comportement soit identique
// entre privé et public.
type TypeBiblioPublique = "tous" | "documents" | "images" | "audio" | "videos" | "liens" | "texte";

const TYPES_BIBLIO_PUBLIQUE: { id: TypeBiblioPublique; label: string }[] = [
  { id: "tous", label: "Tous" },
  { id: "documents", label: "Documents" },
  { id: "images", label: "Images" },
  { id: "audio", label: "Audio" },
  { id: "videos", label: "Vidéos" },
  { id: "liens", label: "Liens" },
  { id: "texte", label: "Texte" },
];

// 03/09/2026, demande Bourama : 3 champs optionnels au moment de
// publier un fichier unique, un lien, un texte ou un dossier (pas pour
// l'ajout multi-fichiers ni l'import d'un dossier entier). Champ texte
// + <datalist> (suggestions des valeurs déjà utilisées) plutôt qu'un
// menu fermé : on peut toujours taper une valeur qui n'existe pas
// encore, le serveur l'ajoute tout seul à la liste (voir
// core/listes_bibliotheque_publique.py) -- pas de bouton "Autre" séparé.
function ChampsFiltragePublication({
  pays,
  niveau,
  categorie,
  classe,
  specialite,
  onChangePays,
  onChangeNiveau,
  onChangeCategorie,
  onChangeClasse,
  onChangeSpecialite,
  listes,
}: {
  pays: string;
  niveau: string;
  categorie: string;
  classe: string;
  specialite: string;
  onChangePays: (v: string) => void;
  onChangeNiveau: (v: string) => void;
  onChangeCategorie: (v: string) => void;
  onChangeClasse: (v: string) => void;
  onChangeSpecialite: (v: string) => void;
  listes: ListesFiltresBibliothequePublique;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <input
        list="biblio-pub-liste-pays"
        value={pays}
        onChange={(e) => onChangePays(e.target.value)}
        placeholder="Pays (optionnel)"
        className="min-w-0 flex-1 rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-3 py-2 text-xs text-dj-texte outline-none focus:border-dj-bordure-forte"
      />
      <input
        list="biblio-pub-liste-niveau"
        value={niveau}
        onChange={(e) => onChangeNiveau(e.target.value)}
        placeholder="Niveau (optionnel)"
        className="min-w-0 flex-1 rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-3 py-2 text-xs text-dj-texte outline-none focus:border-dj-bordure-forte"
      />
      <input
        list="biblio-pub-liste-categorie"
        value={categorie}
        onChange={(e) => onChangeCategorie(e.target.value)}
        placeholder="Catégorie (optionnel)"
        className="min-w-0 flex-1 rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-3 py-2 text-xs text-dj-texte outline-none focus:border-dj-bordure-forte"
      />
      {/* 04/09/2026, demande Bourama : 2 champs supplémentaires, même principe. */}
      <input
        list="biblio-pub-liste-classe"
        value={classe}
        onChange={(e) => onChangeClasse(e.target.value)}
        placeholder="Classe (optionnel)"
        className="min-w-0 flex-1 rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-3 py-2 text-xs text-dj-texte outline-none focus:border-dj-bordure-forte"
      />
      <input
        list="biblio-pub-liste-specialite"
        value={specialite}
        onChange={(e) => onChangeSpecialite(e.target.value)}
        placeholder="Spécialité (optionnel)"
        className="min-w-0 flex-1 rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-3 py-2 text-xs text-dj-texte outline-none focus:border-dj-bordure-forte"
      />
      <datalist id="biblio-pub-liste-pays">
        {listes.pays.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="biblio-pub-liste-niveau">
        {listes.niveaux.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="biblio-pub-liste-categorie">
        {listes.categories.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="biblio-pub-liste-classe">
        {listes.classes.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="biblio-pub-liste-specialite">
        {listes.specialites.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
    </div>
  );
}

function typeDe(entree: EntreeBibliothequePublique): TypeBiblioPublique {
  const typeMime = entree.type_mime;
  if (!typeMime) return "documents";
  if (typeMime === "text/uri-list") return "liens";
  if (typeMime === "text/plain") return "texte";
  if (typeMime.startsWith("image/")) return "images";
  if (typeMime.startsWith("audio/")) return "audio";
  if (typeMime.startsWith("video/")) return "videos";
  return "documents";
}

// Onglet "Bibliothèque publique" (21/08/2026, demande Bourama : "un
// bibliothèque publique dans la section bibliothèque, tout le monde
// peut y ajouter des documents, juste en le décrivant et en donnant un
// nom"). CORRECTION le même jour (malentendu de ma part sur cette
// phrase) : "nom" et "description" accompagnent un VRAI fichier
// uploadé -- ce n'est pas un catalogue de simples liens/notes. Voir
// api/bibliotheque_publique.py côté backend.
//
// REFONTE 28/08/2026 (demande Bourama : "le bouton + doit être comme
// en privé, pour un fichier nom/description optionnels, même pour un
// dossier") : bouton flottant unique (Fichier(s) / Texte / Lien /
// Nouveau dossier), même principe que EspaceBibliotheque.tsx. Dossiers
// du catalogue public : statut "contribution_libre" (tout le monde
// peut y ranger un document) ou "privee" (seul le créateur), choisi à
// la création -- voir core/dossiers_catalogue_public.py.
//
// Multi-fichiers (28/08/2026 bis, demande Bourama : "on ne peut pas
// ajouter plusieurs fichiers en un coup") : input file `multiple`.
// 1 fichier -> nom/description modifiables (optionnels). Plusieurs
// fichiers -> nom auto par fichier, pas de description, même choix que
// EspaceBibliotheque.tsx pour le cas multi (ajouterFichiersABibliothequePublique
// dans lib/api.ts, boucle séquentielle).
export function BibliothequePublique() {
  const searchParams = useSearchParams();
  const [liste, setListe] = useState<EntreeBibliothequePublique[] | undefined>(undefined);
  // 09/09/2026 : dossiers + dossiers attachés viennent désormais d'un
  // contexte partagé, préchargé dès l'ouverture de l'app par AppShell.tsx
  // (voir lib/contexteDossiersCataloguePublic.tsx) -- ce composant n'en
  // est plus seul propriétaire, il ne fait plus que les lire et déclencher
  // un rafraîchissement (silencieux, jamais de nouveau skeleton) à son
  // propre montage et après ses propres actions.
  const { dossiers, dossiersAttachesIds, setDossiersAttachesIds, rafraichirDossiers, rafraichirDossiersAttaches } =
    useDossiersCataloguePublic();
  const [attacheEnCours, setAttacheEnCours] = useState<string | null>(null);
  // Navigation par dossier avec fil d'ariane (corrigé 01/09/2026, bug
  // signalé par Bourama : "dans ses dossier on ne peut ajouter des
  // dossier donc pas d'arborescence") -- avant ce correctif un seul
  // niveau de dossier était possible : aucun moyen de créer un
  // sous-dossier depuis l'intérieur d'un dossier, et ses éventuels
  // sous-dossiers n'étaient de toute façon jamais affichés. Repris du
  // même mécanisme que EspaceBibliotheque.tsx (bibliothèque privée) :
  // pile du fil d'ariane, tableau vide = racine.
  const [pileDossiers, setPileDossiers] = useState<{ id: string; nom: string }[]>([]);
  const dossierCourantId = pileDossiers.length > 0 ? pileDossiers[pileDossiers.length - 1].id : null;
  const [recherche, setRecherche] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreursEnvoi, setErreursEnvoi] = useState<{ nom: string; erreur: string }[]>([]);
  const [sansCompte, setSansCompte] = useState(false);
  const [entreeSignalee, setEntreeSignalee] = useState<EntreeBibliothequePublique | null>(null);
  const [entreeOuverte, setEntreeOuverte] = useState<EntreeBibliothequePublique | null>(null);
  const [copieEnCours, setCopieEnCours] = useState<string | null>(null);
  const [copieReussie, setCopieReussie] = useState<string | null>(null);
  const [compteRequisPourCopie, setCompteRequisPourCopie] = useState(false);

  // 09/09/2026, demande Bourama ("confirmation contributeurs") : modale
  // de choix de destination (fichier ou sous-dossier) + panneau des
  // demandes que JE dois confirmer/refuser (dossiers dont je suis le
  // créateur concerné).
  const [cibleDeplacement, setCibleDeplacement] = useState<CibleDeplacement | null>(null);
  const [demandesEnAttente, setDemandesEnAttente] = useState<DemandeDossierCataloguePublic[]>([]);
  const [panneauDemandesOuvert, setPanneauDemandesOuvert] = useState(false);
  const [demandeEnCoursId, setDemandeEnCoursId] = useState<string | null>(null);
  const [messageDemandeEnvoyee, setMessageDemandeEnvoyee] = useState<string | null>(null);

  // Sélecteur flottant "+" (même principe que EspaceBibliotheque.tsx).
  const [menuAjoutOuvert, setMenuAjoutOuvert] = useState(false);
  const [modaleFichierOuverte, setModaleFichierOuverte] = useState(false);
  const [modaleAjout, setModaleAjout] = useState<"texte" | "lien" | null>(null);
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [texteOuLien, setTexteOuLien] = useState("");
  const inputFichierRef = useRef<HTMLInputElement>(null);

  const [creationDossierOuverte, setCreationDossierOuverte] = useState(false);
  const [nouveauNomDossier, setNouveauNomDossier] = useState("");
  // 08/09/2026, demande Bourama : les dossiers (et sous-dossiers) suivent
  // la même logique que les fichiers -- description optionnelle en plus
  // du nom.
  const [nouvelleDescriptionDossier, setNouvelleDescriptionDossier] = useState("");
  const [nouveauStatutDossier, setNouveauStatutDossier] = useState<"contribution_libre" | "privee">("contribution_libre");

  // 03/09/2026, demande Bourama : 3 filtres cochables au moment de
  // publier (fichier, lien, texte, dossier -- pas pour l'ajout multi-
  // fichiers ni l'import d'un dossier entier, "pas la peine, on
  // trouvera un moyen de filtrer plus tard"). Champs optionnels,
  // partagés par les 3 modales de publication (une seule ouverte à la
  // fois, même principe que nom/description). Valeur libre : si elle
  // n'existe pas encore dans la liste, le serveur l'ajoute tout seul
  // (voir core/listes_bibliotheque_publique.py) -- pas de bouton
  // "Autre" séparé, on tape simplement une nouvelle valeur.
  const [champPays, setChampPays] = useState("");
  const [champNiveau, setChampNiveau] = useState("");
  const [champCategorie, setChampCategorie] = useState("");
  // 04/09/2026, demande Bourama : 2 filtres supplémentaires, même principe.
  const [champClasse, setChampClasse] = useState("");
  const [champSpecialite, setChampSpecialite] = useState("");
  const [listesFiltres, setListesFiltres] = useState<ListesFiltresBibliothequePublique>({
    pays: [], niveaux: [], categories: [], classes: [], specialites: [],
  });

  function chargerListesFiltres() {
    listerListesFiltresBibliothequePublique()
      .then(setListesFiltres)
      .catch(() => {}); // simple suggestions/menus -- un échec ici ne doit jamais bloquer la publication ou la recherche
  }

  function reinitialiserChampsFiltragePublication() {
    setChampPays("");
    setChampNiveau("");
    setChampCategorie("");
    setChampClasse("");
    setChampSpecialite("");
  }

  // Filtres de recherche/parcours (même demande) : le type est filtré
  // côté app sur la liste déjà chargée (comme en privé, voir typeDe
  // ci-dessus) ; pays/niveau/catégorie sont envoyés au serveur (voir
  // GET /api/bibliotheque-publique côté backend). "" = pas de filtre.
  const [filtreType, setFiltreType] = useState<TypeBiblioPublique>("tous");
  const [filtrePays, setFiltrePays] = useState("");
  const [filtreNiveau, setFiltreNiveau] = useState("");
  const [filtreCategorie, setFiltreCategorie] = useState("");
  // 04/09/2026, demande Bourama : 2 filtres supplémentaires, même principe.
  const [filtreClasse, setFiltreClasse] = useState("");
  const [filtreSpecialite, setFiltreSpecialite] = useState("");
  const [panneauFiltreOuvert, setPanneauFiltreOuvert] = useState(false);

  function reinitialiserFiltres() {
    setFiltreType("tous");
    setFiltrePays("");
    setFiltreNiveau("");
    setFiltreCategorie("");
    setFiltreClasse("");
    setFiltreSpecialite("");
  }

  // 29/08/2026, demande Bourama : upload d'un dossier entier (comme en
  // privé, voir envoyerDossierDirect dans EspaceBibliotheque.tsx) --
  // arborescence exacte recréée via webkitRelativePath, un segment de
  // chemin = un dossier créé une seule fois. Différence avec le privé :
  // les dossiers publics ont un statut (libre/privée), donc on le
  // demande une fois avant de lancer l'envoi et on l'applique à tous
  // les dossiers créés pour cet import.
  const inputDossierRef = useRef<HTMLInputElement>(null);
  const [uploadDossierEnCours, setUploadDossierEnCours] = useState(false);
  const [dossierEnAttenteStatut, setDossierEnAttenteStatut] = useState<File[] | null>(null);

  // 29/08/2026, demande Bourama : ligne d'onglets "Tous" / "Dossiers",
  // le filtre de statut et la liste des dossiers ne s'affichent que
  // dans l'onglet "Dossiers". Le parcours (entrer dans un dossier, en
  // créer) reste inchangé une fois dedans.
  // 08/09/2026, demande Bourama : onglets inversés -- les dossiers sont
  // présentés en premier (bouton affiché avant "Tous" plus bas, et
  // onglet actif par défaut à l'ouverture de la bibliothèque publique).
  const [ongletBiblioPublique, setOngletBiblioPublique] = useState<"tous" | "dossiers">("dossiers");
  const [filtreStatutDossier, setFiltreStatutDossier] = useState<"tous" | "contribution_libre" | "privee">("tous");

  // 29/08/2026, demande Bourama : même mécanisme que EspaceBibliotheque.tsx
  // -- voir ses commentaires détaillés pour le raisonnement complet
  // (lotVectorisation ne suit que CE qui a été ajouté pendant cette
  // session, pas tout le catalogue public).
  const [lotVectorisation, setLotVectorisation] = useState<{ total: number; enAttente: Set<string> } | null>(null);
  const [badgeInfoId, setBadgeInfoId] = useState<string | null>(null);
  // 03/09/2026, bouton "Réessayer" -- voir EspaceBibliotheque.tsx pour le
  // même mécanisme et son raisonnement détaillé.
  const [reessaiEnCoursId, setReessaiEnCoursId] = useState<string | null>(null);

  // 29/08/2026 bis, demande Bourama : progression réelle de l'ENVOI
  // lui-même (stockage), distincte de la vectorisation qui vient après
  // -- voir EspaceBibliotheque.tsx pour le même mécanisme et son
  // raisonnement détaillé.
  const [progressionEnvoi, setProgressionEnvoi] = useState<{ total: number; envoyes: number } | null>(null);

  // 04/09/2026, demande Bourama : scroll infini façon réseau social
  // (charge les premiers, puis charge la suite quand le scroll y
  // arrive, ou quand on cherche/filtre) -- remplace l'ancien plafond
  // fixe côté serveur (limit(200)) qui cachait silencieusement les
  // fichiers les plus anciens dès que le catalogue dépassait 200
  // entrées (592 fichiers publiés au moment du diagnostic, seuls les
  // 200 plus récents remontaient jamais).
  const TAILLE_PAGE_BIBLIO_PUBLIQUE = 30;
  const [decalage, setDecalage] = useState(0);
  const [plusDeResultats, setPlusDeResultats] = useState(true);
  const [chargementPage, setChargementPage] = useState(false);
  const sentinelleRef = useRef<HTMLDivElement>(null);

  function suivreVectorisation(ids: string[]) {
    if (ids.length === 0) return;
    setLotVectorisation((precedent) => {
      const enAttente = new Set(precedent?.enAttente ?? []);
      ids.forEach((id) => enAttente.add(id));
      return { total: (precedent?.total ?? 0) + ids.length, enAttente };
    });
  }

  // Pendant de EspaceBibliotheque.tsx:reessayerVectorisation -- voir sa
  // docstring pour le raisonnement détaillé (mise à jour optimiste +
  // raccrochage au popup de progression).
  async function reessayerVectorisation(entree: EntreeBibliothequePublique) {
    setReessaiEnCoursId(entree.id);
    try {
      await reessayerVectorisationBibliothequePublique(entree.id);
      setListe((precedent) =>
        precedent?.map((ligne) =>
          ligne.id === entree.id ? { ...ligne, statut_vectorisation: "en_attente" } : ligne
        ) ?? precedent
      );
      suivreVectorisation([entree.id]);
      setBadgeInfoId(null);
    } catch (e) {
      window.alert(messageErreur(e));
    } finally {
      setReessaiEnCoursId(null);
    }
  }

  // 09/09/2026, demande Bourama ("confirmation contributeurs") : mes
  // demandes en attente (dossiers/fichiers dont je suis le créateur
  // concerné) -- chargées au montage, et ouvertes directement si on
  // arrive depuis la notification (lien "?demandes=1").
  async function rafraichirDemandes() {
    try {
      setDemandesEnAttente(await listerDemandesEnAttenteCataloguePublic());
    } catch {
      // Silencieux : ce panneau est secondaire, pas de skeleton ni
      // d'alerte bloquante pour un simple compteur.
    }
  }

  useEffect(() => {
    rafraichirDemandes();
    if (searchParams.get("demandes") === "1") setPanneauDemandesOuvert(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirmerDemande(demandeId: string) {
    setDemandeEnCoursId(demandeId);
    try {
      await confirmerDemandeCataloguePublic(demandeId);
      setDemandesEnAttente((liste) => liste.filter((d) => d.id !== demandeId));
      charger(recherche);
      rafraichirDossiers();
    } catch (e) {
      window.alert(messageErreur(e));
    } finally {
      setDemandeEnCoursId(null);
    }
  }

  async function refuserDemande(demandeId: string) {
    setDemandeEnCoursId(demandeId);
    try {
      await refuserDemandeCataloguePublic(demandeId);
      setDemandesEnAttente((liste) => liste.filter((d) => d.id !== demandeId));
    } catch (e) {
      window.alert(messageErreur(e));
    } finally {
      setDemandeEnCoursId(null);
    }
  }

  // Retirer un fichier du dossier actuellement ouvert -- immédiat si
  // j'en suis le créateur, sinon transformé en demande bloquée côté
  // serveur (réponse non nulle = en attente, voir lib/api.ts).
  async function retirerDuDossier(entree: EntreeBibliothequePublique) {
    if (!dossierCourantId) return;
    try {
      const resultat = await retirerFichierDossierCataloguePublic(dossierCourantId, entree.id);
      if (resultat) {
        setMessageDemandeEnvoyee("Demande envoyée : en attente de confirmation du créateur du dossier.");
      } else {
        charger(recherche);
      }
    } catch (e) {
      window.alert(messageErreur(e));
    }
  }

  async function deplacerFichierVers(entree: EntreeBibliothequePublique, dossierSourceId: string, dossierDestinationId: string) {
    const resultat = await deplacerFichierDossierCataloguePublic(dossierSourceId, entree.id, dossierDestinationId);
    if ("id" in resultat) {
      setMessageDemandeEnvoyee("Demande envoyée : en attente de confirmation du créateur du dossier.");
    } else {
      charger(recherche);
    }
  }

  async function deplacerDossierVers(dossier: DossierCataloguePublic, dossierDestinationId: string) {
    const resultat = await deplacerDossierCataloguePublic(dossier.id, dossierDestinationId);
    if ("statut" in resultat) {
      setMessageDemandeEnvoyee("Demande envoyée : en attente de confirmation du créateur du sous-dossier.");
    } else {
      rafraichirDossiers();
    }
  }

  useEffect(() => {
    if (!messageDemandeEnvoyee) return;
    const t = setTimeout(() => setMessageDemandeEnvoyee(null), 4000);
    return () => clearTimeout(t);
  }, [messageDemandeEnvoyee]);

  useEffect(() => {
    if (!liste || !lotVectorisation || lotVectorisation.enAttente.size === 0) return;
    const enAttenteSuivant = new Set(lotVectorisation.enAttente);
    let modifie = false;
    for (const entree of liste) {
      if (
        enAttenteSuivant.has(entree.id) &&
        entree.statut_vectorisation !== "en_attente" &&
        entree.statut_vectorisation !== "en_cours"
      ) {
        enAttenteSuivant.delete(entree.id);
        modifie = true;
      }
    }
    if (modifie) setLotVectorisation({ total: lotVectorisation.total, enAttente: enAttenteSuivant });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liste]);

  useEffect(() => {
    if (!lotVectorisation || lotVectorisation.enAttente.size === 0) return;
    const intervalle = setInterval(() => rafraichirStatuts(), 3000);
    return () => clearInterval(intervalle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lotVectorisation?.enAttente.size]);

  // Garde-fou contre les réponses qui arrivent dans le désordre (bug
  // remonté par Bourama, 08/09/2026 : changer vite de dossier public
  // pouvait faire réapparaître le contenu d'un dossier précédent si sa
  // requête, partie avant, répondait après celle du dossier ouvert
  // ensuite -- aucune des fonctions ci-dessous n'ignorait une réponse
  // devenue obsolète). Un seul compteur pour les trois: charger,
  // chargerPlus et rafraichirStatuts se disputent le même `liste`.
  const requeteListeRef = useRef(0);

  // Recharge depuis le début (recherche/filtre/dossier changé, ou ajout/
  // suppression d'une entrée) -- réinitialise la pagination.
  function charger(q?: string) {
    const idAppel = ++requeteListeRef.current;
    setListe(undefined);
    setDecalage(0);
    setPlusDeResultats(true);
    listerBibliothequePublique(q, {
      pays: filtrePays,
      niveau: filtreNiveau,
      categorie: filtreCategorie,
      classe: filtreClasse,
      specialite: filtreSpecialite,
      dossierId: dossierCourantId ?? undefined,
      decalage: 0,
      limite: TAILLE_PAGE_BIBLIO_PUBLIQUE,
    })
      .then((resultat) => {
        if (requeteListeRef.current !== idAppel) return;
        setListe(resultat);
        setDecalage(resultat.length);
        setPlusDeResultats(resultat.length === TAILLE_PAGE_BIBLIO_PUBLIQUE);
      })
      .catch(() => {
        if (requeteListeRef.current !== idAppel) return;
        setListe([]);
        setPlusDeResultats(false);
      });
  }

  // Charge le lot suivant quand la sentinelle en bas de liste devient
  // visible -- ajoute à la liste déjà affichée, ne réinitialise rien.
  function chargerPlus() {
    if (chargementPage || !plusDeResultats) return;
    const idAppel = requeteListeRef.current;
    setChargementPage(true);
    listerBibliothequePublique(recherche, {
      pays: filtrePays,
      niveau: filtreNiveau,
      categorie: filtreCategorie,
      classe: filtreClasse,
      specialite: filtreSpecialite,
      dossierId: dossierCourantId ?? undefined,
      decalage,
      limite: TAILLE_PAGE_BIBLIO_PUBLIQUE,
    })
      .then((resultat) => {
        if (requeteListeRef.current !== idAppel) return;
        setListe((precedent) => (precedent ?? []).concat(resultat));
        setDecalage((d) => d + resultat.length);
        setPlusDeResultats(resultat.length === TAILLE_PAGE_BIBLIO_PUBLIQUE);
      })
      .catch(() => {
        if (requeteListeRef.current === idAppel) setPlusDeResultats(false);
      })
      .finally(() => setChargementPage(false));
  }

  // Pendant du polling de vectorisation (voir plus bas) : ne rafraîchit
  // que ce qui est déjà affiché (0 -> decalage actuel), pour mettre à
  // jour les statuts sans faire sauter le scroll ni relancer la
  // pagination depuis le début.
  function rafraichirStatuts() {
    if (!liste || liste.length === 0) return;
    const idAppel = requeteListeRef.current;
    listerBibliothequePublique(recherche, {
      pays: filtrePays,
      niveau: filtreNiveau,
      categorie: filtreCategorie,
      classe: filtreClasse,
      specialite: filtreSpecialite,
      dossierId: dossierCourantId ?? undefined,
      decalage: 0,
      limite: liste.length,
    })
      .then((resultat) => {
        if (requeteListeRef.current === idAppel) setListe(resultat);
      })
      .catch(() => {});
  }

  // 09/09/2026 : ces deux fonctions ne font plus leur propre fetch --
  // elles délèguent au contexte partagé (lib/contexteDossiersCatalogue
  // Public.tsx), déjà préchargé par AppShell.tsx dès l'ouverture de
  // l'app. Gardées sous ces noms pour ne rien changer aux appels
  // existants (après création/suppression/attachement d'un dossier)
  // plus bas dans ce fichier.
  const chargerDossiers = rafraichirDossiers;
  const chargerDossiersAttaches = rafraichirDossiersAttaches;

  // 08/09/2026, correctif (Bourama : "on sent le chargement et le
  // réarrangement des fichiers, au lieu que ce dossier contienne déjà
  // ce fichier") : cet effet de montage appelait charger() en plus de
  // l'effet debounce juste en dessous, qui se déclenche AUSSI au
  // montage (dossierCourantId etc. changent de "rien" à leur valeur
  // initiale) -- deux requêtes de liste partaient donc à chaque
  // ouverture de l'écran, la seconde effaçant puis remplaçant le
  // résultat déjà affiché par la première 250ms plus tard. Cet effet ne
  // s'occupe plus que des dossiers/filtres, qui n'ont pas ce doublon.
  // 09/09/2026 : chargerDossiers()/chargerDossiersAttaches() ici ne
  // sont donc plus le PREMIER chargement (déjà fait par AppShell à
  // l'ouverture de l'app) mais un rafraîchissement silencieux à
  // l'ouverture de cette section -- demande confirmée par Bourama : le
  // préchargement s'affiche instantanément, la version à jour le
  // remplace en douceur si elle diffère.
  useEffect(() => {
    chargerDossiers();
    chargerDossiersAttaches();
    chargerListesFiltres();
  }, []);

  // 03/09/2026 : recharge aussi quand un des 3 filtres serveur change,
  // pas seulement la recherche texte -- même debounce (évite une
  // requête à chaque frappe si jamais recherche change en même temps).
  // 04/09/2026 : + dossierCourantId -- depuis le passage au chargement
  // par lots côté serveur, entrer/sortir d'un dossier doit relancer une
  // vraie requête (avant, le contenu d'un dossier était juste filtré
  // depuis la liste déjà en mémoire, donc pas besoin de recharger).
  useEffect(() => {
    const id = setTimeout(() => charger(recherche), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche, filtrePays, filtreNiveau, filtreCategorie, filtreClasse, filtreSpecialite, dossierCourantId]);

  // Scroll infini : observe la sentinelle en bas de la liste affichée,
  // charge le lot suivant dès qu'elle devient visible.
  useEffect(() => {
    const cible = sentinelleRef.current;
    if (!cible) return;
    const observateur = new IntersectionObserver(
      (entrees) => {
        if (entrees[0]?.isIntersecting) chargerPlus();
      },
      { rootMargin: "200px" },
    );
    observateur.observe(cible);
    return () => observateur.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liste, dossierCourantId, recherche, filtrePays, filtreNiveau, filtreCategorie, filtreClasse, filtreSpecialite, plusDeResultats, ongletBiblioPublique]);

  function choisirFichiers(fichiersChoisis: FileList | File[]) {
    const liste = Array.from(fichiersChoisis);
    if (liste.length === 0) return;
    setFichiers(liste);
    if (liste.length === 1 && !nom.trim()) {
      setNom(liste[0].name.replace(/\.[^/.]+$/, "")); // nom du fichier sans extension comme point de départ, modifiable
    }
    setModaleFichierOuverte(true);
  }

  async function envoyerDossierDirect(fichiersChoisis: FileList | File[], statut: "contribution_libre" | "privee") {
    const liste = Array.from(fichiersChoisis) as (File & { webkitRelativePath?: string })[];
    if (liste.length === 0) return;
    setUploadDossierEnCours(true);
    setErreursEnvoi([]);
    setProgressionEnvoi({ total: liste.length, envoyes: 0 });
    const erreurs: { nom: string; erreur: string }[] = [];
    const idsAVectoriser: string[] = [];
    const dossiersCrees = new Map<string, string | null>();

    async function obtenirDossierPourChemin(segments: string[]): Promise<string | undefined> {
      if (segments.length === 0) return dossierCourantId ?? undefined;
      const chemin = segments.join("/");
      if (dossiersCrees.has(chemin)) {
        const id = dossiersCrees.get(chemin);
        if (id === null) throw new Error(`Le dossier « ${segments[segments.length - 1]} » n'a pas pu être créé`);
        return id;
      }
      const parentId = await obtenirDossierPourChemin(segments.slice(0, -1));
      const nomSegment = segments[segments.length - 1];
      let id: string | undefined;
      try {
        const dossier = await creerDossierCataloguePublic(nomSegment, statut, parentId);
        id = dossier?.id;
      } catch {
        id = undefined;
      }
      dossiersCrees.set(chemin, id ?? null);
      if (!id) throw new Error(`Le dossier « ${nomSegment} » n'a pas pu être créé`);
      return id;
    }

    try {
      for (const fichier of liste) {
        const chemin = fichier.webkitRelativePath || fichier.name;
        try {
          const segmentsDossier = chemin.split("/").slice(0, -1);
          const dossierId = await obtenirDossierPourChemin(segmentsDossier);
          let ligne;
          try {
            ligne = await ajouterABibliothequePublique(fichier, "", "", dossierId);
          } catch {
            ligne = await ajouterABibliothequePublique(fichier, "", "", dossierId);
          }
          if (ligne?.statut_vectorisation === "en_attente" && ligne.id) idsAVectoriser.push(ligne.id);
        } catch (e) {
          erreurs.push({ nom: chemin, erreur: messageErreur(e) });
        }
        setProgressionEnvoi((p) => (p ? { total: p.total, envoyes: p.envoyes + 1 } : p));
      }
      setErreursEnvoi(erreurs);
      suivreVectorisation(idsAVectoriser);
      charger(recherche);
      chargerDossiers();
    } catch (e) {
      window.alert(messageErreur(e));
    } finally {
      setUploadDossierEnCours(false);
      setProgressionEnvoi(null);
    }
  }

  function retirerFichier(f: File) {
    setFichiers((liste) => liste.filter((x) => x !== f));
  }

  // Nom optionnel (28/08, demande Bourama : "nom et description
  // optionnels même pour dossier") -- l'API se rabat sur le nom du
  // fichier si vide. Cas multi-fichiers : pas de nom/description
  // saisis, chacun garde son nom de fichier (voir lib/api.ts).
  async function ajouterFichier() {
    if (fichiers.length === 0) return;
    setEnvoi(true);
    setErreur(null);
    setErreursEnvoi([]);
    if (fichiers.length > 1) setProgressionEnvoi({ total: fichiers.length, envoyes: 0 });
    try {
      if (fichiers.length === 1) {
        // pays/niveau/catégorie seulement pour un fichier unique -- pas
        // pour le cas multi juste en dessous (demande Bourama : "pas la
        // peine, on trouvera un moyen de filtrer plus tard").
        const ligne = await ajouterABibliothequePublique(fichiers[0], nom, description, dossierCourantId || undefined, {
          pays: champPays,
          niveau: champNiveau,
          categorie: champCategorie,
          classe: champClasse,
          specialite: champSpecialite,
        });
        if (ligne?.statut_vectorisation === "en_attente" && ligne.id) suivreVectorisation([ligne.id]);
      } else {
        const { erreurs, idsAVectoriser } = await ajouterFichiersABibliothequePublique(
          fichiers,
          (envoyes, total) => setProgressionEnvoi({ total, envoyes }),
          dossierCourantId || undefined,
        );
        if (erreurs.length === fichiers.length) {
          setEnvoi(false);
          setProgressionEnvoi(null);
          setSansCompte(true);
          return;
        }
        setErreursEnvoi(erreurs);
        suivreVectorisation(idsAVectoriser);
      }
      setFichiers([]);
      setNom("");
      setDescription("");
      reinitialiserChampsFiltragePublication();
      setModaleFichierOuverte(false);
      charger(recherche);
      chargerDossiers();
      chargerListesFiltres();
    } catch (e) {
      if (e instanceof ErreurApi && e.statusCode === 401) {
        setSansCompte(true);
      } else {
        setErreur(messageErreur(e));
      }
    } finally {
      setEnvoi(false);
      setProgressionEnvoi(null);
    }
  }

  async function envoyerTexteOuLien() {
    const contenu = texteOuLien.trim();
    if (!contenu) return;
    const titre = nom.trim();
    setEnvoi(true);
    setErreur(null);
    const filtresSaisis = {
      pays: champPays,
      niveau: champNiveau,
      categorie: champCategorie,
      classe: champClasse,
      specialite: champSpecialite,
    };
    try {
      const ligne =
        modaleAjout === "lien"
          ? await ajouterLienBibliothequePublique(contenu, titre || undefined, description || undefined, dossierCourantId || undefined, filtresSaisis)
          : await ajouterTexteBibliothequePublique(contenu, titre || undefined, dossierCourantId || undefined, filtresSaisis);
      if (ligne?.statut_vectorisation === "en_attente" && ligne.id) suivreVectorisation([ligne.id]);
      setTexteOuLien("");
      setNom("");
      setDescription("");
      reinitialiserChampsFiltragePublication();
      setModaleAjout(null);
      charger(recherche);
      chargerDossiers();
      chargerListesFiltres();
    } catch (e) {
      if (e instanceof ErreurApi && e.statusCode === 401) {
        setSansCompte(true);
      } else {
        setErreur(messageErreur(e));
      }
    } finally {
      setEnvoi(false);
    }
  }

  async function creerDossier() {
    // Nom optionnel (28/08, demande Bourama) -- l'API se rabat sur
    // "Nouveau dossier" si vide. dossierCourantId comme parent
    // (corrigé 01/09/2026) : avant ce correctif, un dossier créé
    // depuis l'intérieur d'un autre dossier atterrissait toujours à la
    // racine -- aucune arborescence possible.
    try {
      await creerDossierCataloguePublic(
        nouveauNomDossier.trim(),
        nouveauStatutDossier,
        dossierCourantId ?? undefined,
        {
          pays: champPays,
          niveau: champNiveau,
          categorie: champCategorie,
          classe: champClasse,
          specialite: champSpecialite,
        },
        nouvelleDescriptionDossier.trim(),
      );
      setNouveauNomDossier("");
      setNouvelleDescriptionDossier("");
      reinitialiserChampsFiltragePublication();
      setCreationDossierOuverte(false);
      chargerDossiers();
      chargerListesFiltres();
    } catch (e) {
      window.alert(messageErreur(e));
    }
  }

  // 08/09/2026, demande Bourama (bouton manquant pour une fonctionnalité
  // déjà construite côté serveur le 02/09) : attacher = copie réelle du
  // dossier dans la bibliothèque perso, synchronisée en continu (tout
  // nouveau fichier rangé plus tard dans ce dossier public apparaît
  // automatiquement chez toi) -- voir core/dossiers_publics_attaches.py.
  // Détacher n'arrête que la synchronisation future, la copie déjà faite
  // reste dans ta bibliothèque perso.
  async function basculerAttache(d: DossierCataloguePublic) {
    setAttacheEnCours(d.id);
    try {
      if (dossiersAttachesIds.has(d.id)) {
        await detacherDossierPublic(d.id);
        setDossiersAttachesIds((s) => {
          const suivant = new Set(s);
          suivant.delete(d.id);
          return suivant;
        });
      } else {
        await attacherDossierPublic(d.id);
        setDossiersAttachesIds((s) => new Set(s).add(d.id));
      }
    } catch (e) {
      window.alert(messageErreur(e));
    } finally {
      setAttacheEnCours(null);
    }
  }

  async function supprimerDossier(d: DossierCataloguePublic) {
    if (!window.confirm(`Supprimer le dossier « ${d.nom} » ? (les documents qu'il contient restent dans le catalogue)`)) return;
    try {
      const resultat = await supprimerDossierCataloguePublic(d.id);
      if (resultat) {
        // 09/09/2026 : réponse non nulle = demande créée, bloquée tant
        // que le créateur du sous-dossier n'a pas confirmé -- rien n'a
        // réellement été supprimé, on ne touche pas au fil d'ariane.
        setMessageDemandeEnvoyee("Demande envoyée : en attente de confirmation du créateur du sous-dossier.");
        return;
      }
      // Si le dossier supprimé est sur le fil d'ariane actuel (on est
      // dedans, ou dans un de ses sous-dossiers), on remonte jusqu'à
      // son parent -- même logique que EspaceBibliotheque.tsx.
      if (pileDossiers.some((p) => p.id === d.id)) {
        setPileDossiers((p) => p.slice(0, p.findIndex((x) => x.id === d.id)));
      }
      chargerDossiers();
    } catch (e) {
      window.alert(messageErreur(e));
    }
  }

  // 25/08, Bourama : "rendre les fichiers de la bibliothèque publique
  // uploadables/copiables vers ta bibliothèque privée". copieReussie
  // affiche brièvement une coche à la place de l'icône (transition
  // douce, cohérent avec la règle "jamais d'affichage brut") avant de
  // revenir à l'icône copier.
  async function copierVersBiblioPerso(entree: EntreeBibliothequePublique) {
    setCopieEnCours(entree.id);
    try {
      await copierVersBibliothequePersonnelle(entree.id);
      setCopieReussie(entree.id);
      setTimeout(() => setCopieReussie((id) => (id === entree.id ? null : id)), 2000);
    } catch (e) {
      if (e instanceof ErreurApi && e.statusCode === 401) {
        setCompteRequisPourCopie(true);
      } else {
        window.alert(messageErreur(e));
      }
    } finally {
      setCopieEnCours(null);
    }
  }

  async function supprimer(id: string, nomEntree: string) {
    if (!window.confirm(`Retirer « ${nomEntree} » de la bibliothèque publique ?`)) return;
    try {
      await supprimerDeBibliothequePublique(id);
      charger(recherche);
      chargerDossiers();
    } catch (e) {
      window.alert(messageErreur(e));
    }
  }

  // 12/09/2026, sélection multiple (demande Bourama) : Partager et
  // Supprimer restent valables quel que soit le mélange fichiers/dossiers
  // coché. Copier chez moi (fichiers) et Attacher (dossiers) n'apparaissent
  // que si la sélection ne contient que ce type-là. Déplacer en groupe
  // volontairement pas proposé pour l'instant : le système de confirmation
  // par le créateur (09/09/2026) rendrait le comportement ambigu dès que
  // plusieurs créateurs différents sont concernés à la fois.
  async function supprimerSelection() {
    const total = idsDossiersSelectionnes.length + entreesSelectionnees.length;
    if (total === 0) return;
    if (!window.confirm(`Retirer ${total} élément${total > 1 ? "s" : ""} sélectionné${total > 1 ? "s" : ""} de la bibliothèque publique ?`))
      return;
    let demandesEnvoyees = 0;
    try {
      for (const dossierId of idsDossiersSelectionnes) {
        const dossier = sousDossiersAffiches.find((d) => d.id === dossierId);
        const resultat = await supprimerDossierCataloguePublic(dossierId);
        if (resultat) {
          demandesEnvoyees++;
        } else if (dossier && pileDossiers.some((p) => p.id === dossier.id)) {
          setPileDossiers((p) => p.slice(0, p.findIndex((x) => x.id === dossier.id)));
        }
      }
      for (const e of entreesSelectionnees) {
        await supprimerDeBibliothequePublique(e.id);
      }
      selectionMultiple.desactiver();
      charger(recherche);
      chargerDossiers();
      if (demandesEnvoyees > 0) {
        setMessageDemandeEnvoyee(
          `${demandesEnvoyees} demande${demandesEnvoyees > 1 ? "s" : ""} envoyée${demandesEnvoyees > 1 ? "s" : ""} : en attente de confirmation du créateur concerné.`
        );
      }
    } catch (e) {
      window.alert(messageErreur(e));
    }
  }

  async function partagerSelection() {
    const liens = [
      ...idsDossiersSelectionnes.map((id) => lienPartage("dossier-public", id)),
      ...entreesSelectionnees.map((e) => lienPartage("fichier-public", e.id)),
    ];
    if (liens.length === 0) return;
    if (liens.length === 1 && typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ url: liens[0] });
        return;
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(liens.join("\n"));
      window.alert(`${liens.length} lien${liens.length > 1 ? "s" : ""} copié${liens.length > 1 ? "s" : ""}.`);
    } catch {
      window.prompt("Copie ces liens :", liens.join("\n"));
    }
  }

  async function copierSelectionVersBiblioPerso() {
    if (entreesSelectionnees.length === 0) return;
    try {
      for (const e of entreesSelectionnees) {
        await copierVersBibliothequePersonnelle(e.id);
      }
      selectionMultiple.desactiver();
    } catch (e) {
      if (e instanceof ErreurApi && e.statusCode === 401) {
        setCompteRequisPourCopie(true);
      } else {
        window.alert(messageErreur(e));
      }
    }
  }

  async function attacherSelection() {
    if (idsDossiersSelectionnes.length === 0) return;
    try {
      for (const dossierId of idsDossiersSelectionnes) {
        if (!dossiersAttachesIds.has(dossierId)) {
          await attacherDossierPublic(dossierId);
        }
      }
      setDossiersAttachesIds((s) => {
        const suivant = new Set(s);
        idsDossiersSelectionnes.forEach((id) => suivant.add(id));
        return suivant;
      });
      selectionMultiple.desactiver();
    } catch (e) {
      window.alert(messageErreur(e));
    }
  }

  async function telechargerSelection() {
    for (const e of entreesSelectionnees) {
      if (e.type_mime !== "text/uri-list" && e.url_publique) {
        telecharger(e.url_publique, e.nom);
      }
    }
  }

  async function retirerDuDossierSelection() {
    if (!dossierCourantId || entreesSelectionnees.length === 0) return;
    let demandes = 0;
    try {
      for (const e of entreesSelectionnees) {
        const resultat = await retirerFichierDossierCataloguePublic(dossierCourantId, e.id);
        if (resultat) demandes++;
      }
      selectionMultiple.desactiver();
      charger(recherche);
      if (demandes > 0) {
        setMessageDemandeEnvoyee(
          `${demandes} demande${demandes > 1 ? "s" : ""} envoyée${demandes > 1 ? "s" : ""} : en attente de confirmation du créateur concerné.`
        );
      }
    } catch (e) {
      window.alert(messageErreur(e));
    }
  }

  // 12/09/2026, "Déplacer" en groupe : commun aux fichiers ET aux
  // dossiers (une seule destination choisie, appliquée à tout ce qui est
  // coché) -- le système de confirmation par créateur (09/09/2026)
  // fonctionne item par item, donc s'agrège proprement en comptant les
  // demandes envoyées, comme pour Supprimer.
  const [cibleGroupeOuverte, setCibleGroupeOuverte] = useState(false);
  async function deplacerSelectionVers(dossierDestinationId: string) {
    let demandes = 0;
    for (const dossierId of idsDossiersSelectionnes) {
      const resultat = await deplacerDossierCataloguePublic(dossierId, dossierDestinationId);
      if ("statut" in resultat) demandes++;
    }
    if (dossierCourantId) {
      for (const e of entreesSelectionnees) {
        const resultat = await deplacerFichierDossierCataloguePublic(dossierCourantId, e.id, dossierDestinationId);
        if ("id" in resultat) demandes++;
      }
    }
    selectionMultiple.desactiver();
    charger(recherche);
    chargerDossiers();
    if (demandes > 0) {
      setMessageDemandeEnvoyee(
        `${demandes} demande${demandes > 1 ? "s" : ""} envoyée${demandes > 1 ? "s" : ""} : en attente de confirmation du créateur concerné.`
      );
    }
  }

  if (sansCompte) {
    return <CTACompteRequis texte="Crée un compte pour ajouter un document à la bibliothèque publique." />;
  }

  // Sous-dossiers du niveau actuellement affiché (racine si
  // dossierCourantId est null) -- corrigé 01/09/2026, remplace
  // l'ancien "dossiersRacine" qui ne regardait jamais que le niveau 0
  // et empêchait donc toute arborescence.
  // 08/09/2026, demande Bourama : les dossiers filtrables par pays/
  // niveau/catégorie/classe/spécialité, même principe que les fichiers
  // (mêmes états filtrePays/filtreNiveau/etc, filtrage côté app -- la
  // liste des dossiers est déjà chargée intégralement, pas de scroll
  // infini côté dossiers contrairement aux fichiers).
  const sousDossiersAffiches = (dossiers ?? [])
    .filter((d) => (d.dossier_parent_id ?? null) === dossierCourantId)
    .filter((d) => filtreStatutDossier === "tous" || d.statut === filtreStatutDossier)
    .filter((d) => !filtrePays || d.pays === filtrePays)
    .filter((d) => !filtreNiveau || d.niveau === filtreNiveau)
    .filter((d) => !filtreCategorie || d.categorie === filtreCategorie)
    .filter((d) => !filtreClasse || d.classe === filtreClasse)
    .filter((d) => !filtreSpecialite || d.specialite === filtreSpecialite);
  const dossierActuel = dossierCourantId ? (dossiers ?? []).find((d) => d.id === dossierCourantId) : null;
  // 04/09/2026 : le filtrage par dossier se fait désormais côté serveur
  // (voir charger()/chargerPlus(), paramètre dossier_id) pour que le
  // scroll infini fonctionne aussi à l'intérieur d'un dossier -- `liste`
  // contient déjà exactement le bon sous-ensemble, plus besoin de le
  // refiltrer ici avec dossierActuel.fichier_ids.
  // 03/09/2026, demande Bourama : filtre par type appliqué côté app
  // (comme en privé), sur "Tous" ET à l'intérieur d'un dossier ouvert --
  // pays/niveau/catégorie sont déjà filtrés côté serveur (voir charger()).
  const listeAffichee = liste?.filter((e) => filtreType === "tous" || typeDe(e) === filtreType);
  // 08/09/2026 : vrai quand une liste de FICHIERS est affichée à l'écran
  // (onglet "Tous", ou à l'intérieur d'un dossier ouvert où fichiers ET
  // sous-dossiers apparaissent ensemble) -- sert à savoir si le filtre
  // "Type" (qui n'a pas de sens pour un dossier) doit apparaître dans le
  // panneau.
  const listeFichiersVisible = ongletBiblioPublique === "tous" || !!dossierCourantId;

  // 12/09/2026, demande Bourama : sélection multiple, même principe que
  // EspaceBibliotheque.tsx -- idsElementsAffiches reflète ce qui est
  // réellement visible (donc après filtre/recherche), condition pour que
  // "Tout sélectionner" et la sélection par plage (Shift) restent justes.
  const idsElementsAffiches = [
    ...sousDossiersAffiches.map((d) => d.id),
    ...(listeFichiersVisible ? (listeAffichee ?? []).map((e) => e.id) : []),
  ];
  const selectionMultiple = useSelectionMultiple(idsElementsAffiches);
  const idsDossiersSelectionnes = sousDossiersAffiches
    .filter((d) => selectionMultiple.selection.has(d.id))
    .map((d) => d.id);
  const entreesSelectionnees = (listeAffichee ?? []).filter((e) => selectionMultiple.selection.has(e.id));
  // 08/09/2026 : "Type" ne compte dans le badge que là où il s'applique réellement (voir listeFichiersVisible ci-dessus).
  const nombreFiltresActifs = [
    filtreType !== "tous" && listeFichiersVisible, !!filtrePays, !!filtreNiveau, !!filtreCategorie, !!filtreClasse, !!filtreSpecialite,
  ].filter(Boolean).length;

  // Description fixe (+ rappel légal CGU/copyright) remplacée par le
  // bouton "i" du titre de page (géré par le parent EspaceBibliotheque.tsx
  // selon l'onglet ouvert, voir lib/aideSections.tsx, rubrique
  // "bibliotheque-publique") -- correctif 02/09/2026, suite audit
  // Bourama. Texte et liens repris tels quels, aucune reformulation du
  // rappel légal.
  return (
    <div className="flex animate-dj-fade-in-rapide flex-col gap-4">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dj-texte-muet" />
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher dans la bibliothèque publique..."
          className="w-full rounded-cgpt-bouton border border-dj-bordure bg-dj-surface py-2 pl-9 pr-3 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
        />
      </div>

      {demandesEnAttente.length > 0 && (
        <button
          onClick={() => setPanneauDemandesOuvert(true)}
          className="flex items-center gap-2 rounded-cgpt-bouton border border-dj-accent-1 bg-dj-accent-1-conteneur px-3 py-2 text-left text-xs font-semibold text-dj-accent-1-texte"
        >
          <Bell size={14} className="flex-shrink-0" />
          {demandesEnAttente.length === 1
            ? "1 demande attend ta confirmation"
            : `${demandesEnAttente.length} demandes attendent ta confirmation`}
        </button>
      )}

      <div className="flex items-center justify-between gap-2 text-xs">
        {/* 08/09/2026, demande Bourama : dossiers présentés en premier -- onglet avant "Tous". */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOngletBiblioPublique("dossiers")}
            className={`rounded-cgpt-bouton px-2 py-1 font-semibold transition-colors ${
              ongletBiblioPublique === "dossiers" ? "bg-dj-surface-haute text-dj-texte" : "text-dj-texte-muet hover:text-dj-texte"
            }`}
          >
            Dossiers
          </button>
          <button
            onClick={() => {
              setOngletBiblioPublique("tous");
              setPileDossiers([]);
            }}
            className={`rounded-cgpt-bouton px-2 py-1 font-semibold transition-colors ${
              ongletBiblioPublique === "tous" ? "bg-dj-surface-haute text-dj-texte" : "text-dj-texte-muet hover:text-dj-texte"
            }`}
          >
            Tous
          </button>
        </div>
        {/* 08/09/2026, demande Bourama : le bouton Filtre est désormais
            toujours visible (avant, absent sur l'écran racine de l'onglet
            Dossiers) -- il filtre soit les fichiers (Tous / dans un
            dossier ouvert), soit les dossiers eux-mêmes par pays/niveau/
            catégorie/classe/spécialité (racine de l'onglet Dossiers), les
            deux listes utilisant les mêmes champs, comme demandé. */}
        <button
          type="button"
          onClick={() => setPanneauFiltreOuvert(true)}
          className={`flex flex-shrink-0 items-center gap-1 rounded-cgpt-bouton border px-3 py-1.5 font-semibold transition-colors ${
            nombreFiltresActifs > 0
              ? "border-dj-accent-1 bg-dj-accent-1-conteneur text-dj-accent-1-texte"
              : "border-dj-bordure text-dj-texte-muet hover:text-dj-texte"
          }`}
        >
          <SlidersHorizontal size={13} />
          Filtre
          {nombreFiltresActifs > 0 && (
            <span className="rounded-full bg-dj-accent-1 px-1.5 py-0.5 text-[10px] leading-none text-[#1A0D02]">
              {nombreFiltresActifs}
            </span>
          )}
        </button>
      </div>

      {/* Étiquettes des filtres actifs (03/09/2026) -- "filter feedback
          bar", chaque filtre reste visible et retirable individuellement
          sans rouvrir le panneau. */}
      {nombreFiltresActifs > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {filtreType !== "tous" && listeFichiersVisible && (
            <span className="flex items-center gap-1 rounded-full border border-dj-bordure bg-dj-surface px-2.5 py-1 text-dj-texte">
              {TYPES_BIBLIO_PUBLIQUE.find((t) => t.id === filtreType)?.label}
              <button onClick={() => setFiltreType("tous")} aria-label="Retirer le filtre de type" className="text-dj-texte-muet hover:text-dj-texte">
                <X size={11} />
              </button>
            </span>
          )}
          {filtrePays && (
            <span className="flex items-center gap-1 rounded-full border border-dj-bordure bg-dj-surface px-2.5 py-1 text-dj-texte">
              {filtrePays}
              <button onClick={() => setFiltrePays("")} aria-label="Retirer le filtre de pays" className="text-dj-texte-muet hover:text-dj-texte">
                <X size={11} />
              </button>
            </span>
          )}
          {filtreNiveau && (
            <span className="flex items-center gap-1 rounded-full border border-dj-bordure bg-dj-surface px-2.5 py-1 text-dj-texte">
              {filtreNiveau}
              <button onClick={() => setFiltreNiveau("")} aria-label="Retirer le filtre de niveau" className="text-dj-texte-muet hover:text-dj-texte">
                <X size={11} />
              </button>
            </span>
          )}
          {filtreCategorie && (
            <span className="flex items-center gap-1 rounded-full border border-dj-bordure bg-dj-surface px-2.5 py-1 text-dj-texte">
              {filtreCategorie}
              <button onClick={() => setFiltreCategorie("")} aria-label="Retirer le filtre de catégorie" className="text-dj-texte-muet hover:text-dj-texte">
                <X size={11} />
              </button>
            </span>
          )}
          {filtreClasse && (
            <span className="flex items-center gap-1 rounded-full border border-dj-bordure bg-dj-surface px-2.5 py-1 text-dj-texte">
              {filtreClasse}
              <button onClick={() => setFiltreClasse("")} aria-label="Retirer le filtre de classe" className="text-dj-texte-muet hover:text-dj-texte">
                <X size={11} />
              </button>
            </span>
          )}
          {filtreSpecialite && (
            <span className="flex items-center gap-1 rounded-full border border-dj-bordure bg-dj-surface px-2.5 py-1 text-dj-texte">
              {filtreSpecialite}
              <button onClick={() => setFiltreSpecialite("")} aria-label="Retirer le filtre de spécialité" className="text-dj-texte-muet hover:text-dj-texte">
                <X size={11} />
              </button>
            </span>
          )}
          {nombreFiltresActifs > 1 && (
            <button onClick={reinitialiserFiltres} className="text-dj-texte-muet underline-offset-2 hover:text-dj-texte hover:underline">
              Tout effacer
            </button>
          )}
        </div>
      )}

      {ongletBiblioPublique === "dossiers" && (
        <>
          {/* Fil d'ariane (03/09/2026, refonte demandée par Bourama) : plus
              de label racine ("Dossiers") affiché seul à la racine --
              juste une flèche pour remonter d'un niveau quand on est dans
              un dossier, sans réserver de place sinon. Les actions
              ("Nouveau dossier", "Importer un dossier") ont été fusionnées
              dans le "+" flottant existant plus bas (menuAjoutOuvert), pas
              de deuxième "+" séparé. */}
          {dossierCourantId !== null && (
            <button
              onClick={() => setPileDossiers((p) => p.slice(0, -1))}
              aria-label="Revenir au dossier précédent"
              className="flex w-fit min-w-0 items-center gap-1 rounded-cgpt-bouton px-2 py-1 text-xs font-medium text-dj-texte transition-colors hover:text-dj-texte-muet"
            >
              <ChevronLeft size={14} className="flex-shrink-0" />
              <span className="truncate">{dossierActuel?.nom}</span>
            </button>
          )}

          <div className="flex items-center gap-1 text-xs">
            {(
              [
                ["tous", "Tous statuts"],
                ["contribution_libre", "Libre"],
                ["privee", "Privé"],
              ] as const
            ).map(([valeur, libelle]) => (
              <button
                key={valeur}
                onClick={() => setFiltreStatutDossier(valeur)}
                className={`rounded-cgpt-bouton px-2 py-1 font-medium transition-colors ${
                  filtreStatutDossier === valeur ? "bg-dj-surface-haute text-dj-texte" : "text-dj-texte-muet hover:text-dj-texte"
                }`}
              >
                {libelle}
              </button>
            ))}
          </div>

          <input
            ref={inputDossierRef}
            type="file"
            className="hidden"
            // @ts-expect-error -- webkitdirectory n'est pas dans le typage React standard, mais bien supporté par les navigateurs (PC + mobile web, pas l'app native)
            webkitdirectory=""
            onChange={(e) => {
              const fichiers = e.target.files;
              if (fichiers && fichiers.length > 0) setDossierEnAttenteStatut(Array.from(fichiers));
              e.target.value = "";
            }}
          />

          {dossierEnAttenteStatut && (
            <div className="flex animate-dj-fade-in-rapide flex-col gap-2 rounded-xl border border-dj-bordure bg-dj-surface px-4 py-3">
              <p className="text-sm text-dj-texte">
                Statut du dossier importé ({dossierEnAttenteStatut.length} fichier{dossierEnAttenteStatut.length > 1 ? "s" : ""}) :
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const fichiers = dossierEnAttenteStatut;
                    setDossierEnAttenteStatut(null);
                    if (fichiers) envoyerDossierDirect(fichiers, "contribution_libre");
                  }}
                  className="flex items-center gap-1 rounded-cgpt-bouton bg-dj-accent-1 px-3 py-1.5 text-xs font-bold text-[#1A0D02] hover:bg-dj-accent-2"
                >
                  <Globe size={14} />
                  Contribution libre
                </button>
                <button
                  onClick={() => {
                    const fichiers = dossierEnAttenteStatut;
                    setDossierEnAttenteStatut(null);
                    if (fichiers) envoyerDossierDirect(fichiers, "privee");
                  }}
                  className="flex items-center gap-1 rounded-cgpt-bouton border border-dj-bordure px-3 py-1.5 text-xs font-bold text-dj-texte hover:bg-dj-surface-haute"
                >
                  <Lock size={14} />
                  Privé (moi seul)
                </button>
                <button
                  onClick={() => setDossierEnAttenteStatut(null)}
                  className="ml-auto text-dj-texte-muet hover:text-dj-texte"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {uploadDossierEnCours && (
            <p className="text-xs text-dj-texte-muet">
              {progressionEnvoi
                ? `Import du dossier : ${progressionEnvoi.envoyes}/${progressionEnvoi.total} (${Math.round((progressionEnvoi.envoyes / progressionEnvoi.total) * 100)}%)`
                : "Import du dossier en cours…"}
            </p>
          )}

          {/* Skeleton précis (30/08, suite audit ; mis à jour 08/09/2026
              suite à l'ajout de la description aux dossiers) : icône
              plate 16px (Globe/Lock, sans rond coloré -- contrairement à
              la bibliothèque privée qui a un conteneur tonal), titre +
              sous-titre (comme les fichiers, maintenant que le dossier
              peut avoir une description), 1 bouton d'action à droite
              (suppression). 4 lignes pour remplir l'espace au lieu de 2
              fixes. */}
          {dossiers === undefined && (
            <div className="flex flex-col gap-2" aria-hidden>
              {[
                { titre: "w-2/5", soustitre: "w-1/4", delai: "0ms" },
                { titre: "w-1/2", soustitre: "w-1/3", delai: "100ms" },
                { titre: "w-1/3", soustitre: "w-1/5", delai: "200ms" },
                { titre: "w-3/5", soustitre: "w-2/5", delai: "300ms" },
              ].map(({ titre, soustitre, delai }, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-xl border border-dj-bordure bg-dj-surface px-4 py-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Skeleton className="h-4 w-4 flex-shrink-0 rounded" style={{ animationDelay: delai }} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Skeleton className={`h-3.5 rounded ${titre}`} style={{ animationDelay: delai }} />
                      <Skeleton className={`h-2.5 rounded ${soustitre}`} style={{ animationDelay: delai }} />
                    </div>
                  </div>
                  <Skeleton className="h-3.5 w-3.5 flex-shrink-0 rounded" style={{ animationDelay: delai }} />
                </div>
              ))}
            </div>
          )}

          {dossiers !== undefined && sousDossiersAffiches.length > 0 && (
            <div className="flex flex-col gap-2">
              {sousDossiersAffiches.map((d) => {
                const selectionne = selectionMultiple.estSelectionne(d.id);
                return (
                <div
                  key={d.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors ${
                    selectionne ? "border-dj-accent-1 bg-dj-accent-1-conteneur" : "border-dj-bordure bg-dj-surface"
                  }`}
                >
                  <button
                    onClick={(e) =>
                      selectionMultiple.actif
                        ? selectionMultiple.basculer(d.id, { shiftKey: e.shiftKey })
                        : setPileDossiers((p) => [...p, { id: d.id, nom: d.nom }])
                    }
                    title={d.statut === "contribution_libre" ? "Contribution libre : tout le monde peut y ajouter" : "Privé : seul le créateur peut y ajouter"}
                    className="flex min-w-0 items-center gap-2 text-sm text-dj-texte hover:text-dj-texte"
                  >
                    {d.statut === "contribution_libre" ? (
                      <Globe size={16} className="flex-shrink-0 text-dj-texte-muet" />
                    ) : (
                      <Lock size={16} className="flex-shrink-0 text-dj-texte-muet" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium">{d.nom}</p>
                      {/* 08/09/2026, demande Bourama : dossiers = même logique que les fichiers, description affichée en sous-titre. */}
                      {d.description && (
                        <p className="truncate text-xs text-dj-texte-muet">{d.description}</p>
                      )}
                    </div>
                  </button>
                  {/* 08/09/2026 (correctif) : les deux boutons d'action
                      groupés dans un même conteneur -- avant, ils étaient
                      enfants directs de la carte en justify-between, qui
                      les répartissait sur toute la largeur au lieu de les
                      garder collés à droite. Icône Download (au lieu de
                      FolderSync, jugée confuse) : "attacher" se lit
                      simplement comme "récupérer ce dossier chez moi". */}
                  {selectionMultiple.actif ? (
                    <button
                      onClick={(e) => selectionMultiple.basculer(d.id, { shiftKey: e.shiftKey })}
                      aria-label="Sélectionner"
                      className="flex flex-shrink-0 items-center p-1"
                    >
                      <CaseACocher checked={selectionne} onChange={() => {}} />
                    </button>
                  ) : (
                  <div className="flex flex-shrink-0 items-center gap-3">
                    <ButtonPartager lien={lienPartage("dossier-public", d.id)} titre={d.nom} variante="icone" />
                    <button
                      onClick={() => basculerAttache(d)}
                      disabled={attacheEnCours === d.id}
                      className={`flex-shrink-0 disabled:opacity-50 ${
                        dossiersAttachesIds.has(d.id) ? "text-dj-accent-1-texte" : "text-dj-texte-muet hover:text-dj-texte"
                      }`}
                      title={dossiersAttachesIds.has(d.id) ? "Attaché à ma bibliothèque (cliquer pour détacher)" : "Attacher à ma bibliothèque (copie + mise à jour automatique)"}
                    >
                      {attacheEnCours === d.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    </button>
                    <button
                      onClick={() => setCibleDeplacement({ type: "dossier", dossier: d })}
                      className="flex-shrink-0 text-dj-texte-muet hover:text-dj-texte"
                      title="Déplacer vers un autre dossier"
                    >
                      <Move size={14} />
                    </button>
                    <button
                      onClick={() => supprimerDossier(d)}
                      className="flex-shrink-0 text-dj-texte-muet hover:text-[var(--dj-erreur)]"
                      title="Supprimer le dossier"
                    >
                      <FolderX size={14} />
                    </button>
                  </div>
                  )}
                </div>
              );
              })}
            </div>
          )}

          {creationDossierOuverte && (
            // 03/09/2026, demande Bourama : passage d'une simple ligne à
            // une petite carte -- nom/statut/pays/niveau/catégorie ne
            // tiennent plus sur une seule rangée, surtout sur mobile.
            <div className="flex animate-dj-fade-in-rapide flex-col gap-2 rounded-xl border border-dj-bordure bg-dj-surface p-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  autoFocus
                  type="text"
                  value={nouveauNomDossier}
                  onChange={(e) => setNouveauNomDossier(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && creerDossier()}
                  placeholder="Nom du dossier… (optionnel)"
                  className="min-w-0 flex-1 rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-3 py-1.5 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
                />
                <div className="sm:w-48 sm:flex-shrink-0">
                  <SelectPersonnalise
                    options={[
                      { id: "contribution_libre", label: "Contribution libre" },
                      { id: "privee", label: "Privé (moi seul)" },
                    ]}
                    valeur={nouveauStatutDossier}
                    onChange={(id) => setNouveauStatutDossier(id as "contribution_libre" | "privee")}
                  />
                </div>
              </div>
              <textarea
                value={nouvelleDescriptionDossier}
                onChange={(e) => setNouvelleDescriptionDossier(e.target.value)}
                placeholder="Décris-le en quelques mots (optionnel)"
                rows={2}
                className="resize-none rounded-xl border border-dj-bordure bg-dj-fond px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
              />
              <ChampsFiltragePublication
                pays={champPays}
                niveau={champNiveau}
                categorie={champCategorie}
                classe={champClasse}
                specialite={champSpecialite}
                onChangePays={setChampPays}
                onChangeNiveau={setChampNiveau}
                onChangeCategorie={setChampCategorie}
                onChangeClasse={setChampClasse}
                onChangeSpecialite={setChampSpecialite}
                listes={listesFiltres}
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setCreationDossierOuverte(false);
                    setNouveauNomDossier("");
                    setNouvelleDescriptionDossier("");
                    reinitialiserChampsFiltragePublication();
                  }}
                  className="rounded-cgpt-bouton border border-dj-bordure px-3 py-1.5 text-xs text-dj-texte-muet hover:text-dj-texte"
                >
                  Annuler
                </button>
                <button
                  onClick={creerDossier}
                  className="rounded-cgpt-bouton bg-dj-accent-1 px-3 py-1.5 text-xs font-bold text-[#1A0D02] hover:bg-dj-accent-2"
                >
                  Créer
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {erreursEnvoi.length > 0 && (
        <div className="flex items-start gap-2 rounded-cgpt-carte border border-[var(--dj-erreur)] bg-dj-surface p-3 text-xs text-[var(--dj-erreur)]">
          <div className="flex flex-1 flex-col gap-1">
            {erreursEnvoi.map((e, i) => (
              <p key={i}>« {e.nom} » : {e.erreur}</p>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setErreursEnvoi([])}
            className="shrink-0 text-[var(--dj-erreur)]/70 hover:text-[var(--dj-erreur)]"
            aria-label="Fermer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {(ongletBiblioPublique === "tous" || dossierCourantId) && (
        <>
          {/* Skeleton précis (30/08, suite audit) : icône plate 16px + 2
              lignes (titre + sous-titre, contrairement au privé qui n'en
              a qu'une -- ici la description est un vrai second élément
              visuel), 2 boutons d'action à droite (signaler + retirer,
              toujours présents ; copier/statut sont conditionnels donc
              pas représentés ici). 5 lignes pour remplir l'espace au lieu
              de 2 fixes. */}
          {liste === undefined && (
            <div className="flex flex-col gap-2" aria-hidden>
              {[
                { titre: "w-1/2", soustitre: "w-1/3", delai: "0ms" },
                { titre: "w-3/5", soustitre: "w-2/5", delai: "100ms" },
                { titre: "w-2/5", soustitre: "w-1/4", delai: "200ms" },
                { titre: "w-3/4", soustitre: "w-1/2", delai: "300ms" },
                { titre: "w-1/3", soustitre: "w-1/5", delai: "400ms" },
              ].map(({ titre, soustitre, delai }, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-xl border border-dj-bordure bg-dj-surface px-4 py-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Skeleton className="h-4 w-4 flex-shrink-0 rounded" style={{ animationDelay: delai }} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Skeleton className={`h-3.5 rounded ${titre}`} style={{ animationDelay: delai }} />
                      <Skeleton className={`h-2.5 rounded ${soustitre}`} style={{ animationDelay: delai }} />
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3">
                    <Skeleton className="h-3.5 w-3.5 rounded" style={{ animationDelay: delai }} />
                    <Skeleton className="h-3.5 w-3.5 rounded" style={{ animationDelay: delai }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {listeAffichee?.length === 0 && (
            <p className="text-sm text-dj-texte-muet">
              {recherche ? "Aucun résultat pour cette recherche." : "Rien ici pour l'instant."}
            </p>
          )}
          {listeAffichee && listeAffichee.length > 0 && (
            <div className="flex flex-col gap-2">
              {listeAffichee.map((entree) => {
            const Icone = iconePourType(entree.type_mime);
            const selectionne = selectionMultiple.estSelectionne(entree.id);
            return (
              <div
                key={entree.id}
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  selectionne ? "border-dj-accent-1 bg-dj-accent-1-conteneur" : "border-dj-bordure bg-dj-surface"
                }`}
              >
                <button
                  onClick={(e) =>
                    selectionMultiple.actif
                      ? selectionMultiple.basculer(entree.id, { shiftKey: e.shiftKey })
                      : entree.url_publique && setEntreeOuverte(entree)
                  }
                  disabled={!selectionMultiple.actif && !entree.url_publique}
                  className="group flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                >
                  <Icone size={16} className="flex-shrink-0 text-dj-texte-muet" />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-dj-texte group-hover:underline">{entree.nom}</p>
                    {entree.description && (
                      <p className="truncate text-xs text-dj-texte-muet">{entree.description}</p>
                    )}
                  </div>
                </button>
                {selectionMultiple.actif ? (
                  <button
                    onClick={(e) => selectionMultiple.basculer(entree.id, { shiftKey: e.shiftKey })}
                    aria-label="Sélectionner"
                    className="flex flex-shrink-0 items-center p-1"
                  >
                    <CaseACocher checked={selectionne} onChange={() => {}} />
                  </button>
                ) : (
                <div className="flex flex-shrink-0 items-center gap-3">
                  {(entree.statut_vectorisation === "en_attente" || entree.statut_vectorisation === "en_cours" || entree.statut_vectorisation === "echec") && (
                    <span className="relative flex-shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setBadgeInfoId((id) => (id === entree.id ? null : entree.id));
                        }}
                        onMouseEnter={() => setBadgeInfoId(entree.id)}
                        onMouseLeave={() => setBadgeInfoId((id) => (id === entree.id ? null : id))}
                        className={entree.statut_vectorisation === "echec" ? "text-[var(--dj-erreur)]" : "text-dj-accent-1-texte"}
                      >
                        {entree.statut_vectorisation === "echec" ? (
                          <span className="block h-2 w-2 rounded-full bg-[var(--dj-erreur)]" />
                        ) : (
                          <Loader2 size={12} className="animate-spin" />
                        )}
                      </button>
                      {badgeInfoId === entree.id && (
                        <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-cgpt-bouton border border-dj-bordure bg-dj-surface p-2 text-[11px] text-dj-texte shadow-xl animate-dj-fade-in-rapide">
                          {entree.statut_vectorisation === "echec" ? (
                            <>
                              <p>
                                Échec du traitement -- l'IA ne peut pas retrouver ce fichier par son
                                contenu. Un nouveau réessai automatique aura lieu sous peu.
                              </p>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  reessayerVectorisation(entree);
                                }}
                                disabled={reessaiEnCoursId === entree.id}
                                className="mt-2 w-full rounded-cgpt-bouton bg-dj-accent-1-conteneur px-2 py-1 text-dj-accent-1-texte hover:opacity-90 disabled:opacity-50"
                              >
                                {reessaiEnCoursId === entree.id ? "Réessai en cours…" : "Réessayer maintenant"}
                              </button>
                            </>
                          ) : (
                            "Traitement en cours : l'IA ne peut pas encore retrouver ce fichier facilement."
                          )}
                        </div>
                      )}
                    </span>
                  )}
                  {entree.url_publique && (
                    <button
                      onClick={() => copierVersBiblioPerso(entree)}
                      disabled={copieEnCours === entree.id}
                      title="Copier dans ma bibliothèque"
                      className="text-dj-texte-muet transition-colors hover:text-dj-texte disabled:opacity-50"
                    >
                      {copieReussie === entree.id ? (
                        <Check size={15} className="text-dj-accent-1-texte" />
                      ) : (
                        <Download size={15} />
                      )}
                    </button>
                  )}
                  <ButtonPartager lien={lienPartage("fichier-public", entree.id)} titre={entree.nom} variante="icone" />
                  <button
                    onClick={() => setEntreeSignalee(entree)}
                    title="Signaler ce contenu"
                    className="text-dj-texte-muet transition-colors hover:text-[var(--dj-erreur)]"
                  >
                    <Flag size={14} />
                  </button>
                  {dossierCourantId && (
                    <>
                      <button
                        onClick={() =>
                          setCibleDeplacement({ type: "fichier", entree, dossierSourceId: dossierCourantId })
                        }
                        title="Déplacer vers un autre dossier"
                        className="text-dj-texte-muet transition-colors hover:text-dj-texte"
                      >
                        <Move size={14} />
                      </button>
                      <button
                        onClick={() => retirerDuDossier(entree)}
                        title="Retirer de ce dossier"
                        className="text-dj-texte-muet transition-colors hover:text-dj-texte"
                      >
                        <FolderMinus size={14} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => supprimer(entree.id, entree.nom)}
                    title="Retirer (uniquement si c'est toi qui l'as ajouté)"
                    className="text-dj-texte-muet transition-colors hover:text-[var(--dj-erreur)]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                )}
              </div>
            );
          })}
        </div>
      )}
          {/* Sentinelle du scroll infini : invisible, déclenche
              chargerPlus() dès qu'elle entre dans le viewport (voir le
              useEffect IntersectionObserver plus haut). 04/09/2026,
              demande Bourama : le rond qui tourne (Loader2) remplacé par
              le même skeleton précis que le chargement initial (icône
              16px + titre/sous-titre + 2 boutons d'action) -- juste 2
              lignes au lieu de 5, pour rester léger vu que c'est un lot
              suivant et pas le premier affichage. */}
          {listeAffichee && listeAffichee.length > 0 && plusDeResultats && (
            <div ref={sentinelleRef} className="flex flex-col gap-2 py-1" aria-hidden>
              {chargementPage &&
                [
                  { titre: "w-2/5", soustitre: "w-1/4", delai: "0ms" },
                  { titre: "w-1/2", soustitre: "w-1/3", delai: "100ms" },
                ].map(({ titre, soustitre, delai }, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-xl border border-dj-bordure bg-dj-surface px-4 py-3"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Skeleton className="h-4 w-4 flex-shrink-0 rounded" style={{ animationDelay: delai }} />
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <Skeleton className={`h-3.5 rounded ${titre}`} style={{ animationDelay: delai }} />
                        <Skeleton className={`h-2.5 rounded ${soustitre}`} style={{ animationDelay: delai }} />
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3">
                      <Skeleton className="h-3.5 w-3.5 rounded" style={{ animationDelay: delai }} />
                      <Skeleton className="h-3.5 w-3.5 rounded" style={{ animationDelay: delai }} />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </>
      )}

      {entreeSignalee && (
        <SignalerContenuModal
          cible={{
            typeSignalement: "bibliotheque_publique",
            bibliothequePubliqueId: entreeSignalee.id,
            libelle: entreeSignalee.nom,
          }}
          onFermer={() => setEntreeSignalee(null)}
        />
      )}

      {cibleDeplacement && (
        <DeplacerVersModal
          titre={cibleDeplacement.type === "fichier" ? "Déplacer ce fichier vers…" : "Déplacer ce sous-dossier vers…"}
          dossiers={dossiers ?? []}
          destinationActuelleId={
            cibleDeplacement.type === "fichier" ? cibleDeplacement.dossierSourceId : cibleDeplacement.dossier.id
          }
          onChoisir={async (dossierDestinationId) => {
            if (cibleDeplacement.type === "fichier") {
              await deplacerFichierVers(cibleDeplacement.entree, cibleDeplacement.dossierSourceId, dossierDestinationId);
            } else {
              await deplacerDossierVers(cibleDeplacement.dossier, dossierDestinationId);
            }
          }}
          onFermer={() => setCibleDeplacement(null)}
        />
      )}

      {messageDemandeEnvoyee && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-cgpt-bouton border border-dj-bordure bg-dj-surface px-4 py-2 text-sm text-dj-texte shadow-xl animate-dj-fade-in-rapide sm:bottom-6">
          {messageDemandeEnvoyee}
        </div>
      )}

      {panneauDemandesOuvert && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={() => setPanneauDemandesOuvert(false)}
        >
          <div
            className="flex max-h-[85vh] w-full flex-col gap-3 overflow-y-auto rounded-t-2xl border border-dj-bordure bg-dj-surface p-5 shadow-[0_8px_40px_rgba(0,0,0,0.45)] sm:max-w-md sm:rounded-cgpt-carte"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-dj-texte">
                <Bell size={15} /> Demandes en attente
              </h4>
              <button onClick={() => setPanneauDemandesOuvert(false)} className="text-dj-texte-muet hover:text-dj-texte">
                <X size={16} />
              </button>
            </div>

            {demandesEnAttente.length === 0 ? (
              <p className="text-sm text-dj-texte-muet">Rien à confirmer pour le moment.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {demandesEnAttente.map((demande) => {
                  const dossier = (dossiers ?? []).find((d) => d.id === demande.dossier_id);
                  const destination = demande.dossier_destination_id
                    ? (dossiers ?? []).find((d) => d.id === demande.dossier_destination_id)
                    : null;
                  return (
                    <div key={demande.id} className="rounded-xl border border-dj-bordure bg-dj-surface-haute p-3 text-sm text-dj-texte">
                      <p className="font-medium">{libelleActionDemande(demande.action)}</p>
                      <p className="text-xs text-dj-texte-muet">
                        Dans « {dossier?.nom ?? "un dossier"} »
                        {destination && <> → vers « {destination.nom} »</>}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => confirmerDemande(demande.id)}
                          disabled={demandeEnCoursId === demande.id}
                          className="flex flex-1 items-center justify-center gap-1 rounded-cgpt-bouton bg-dj-accent-1-conteneur px-2 py-1.5 text-xs font-semibold text-dj-accent-1-texte hover:opacity-90 disabled:opacity-50"
                        >
                          <Check size={13} /> Confirmer
                        </button>
                        <button
                          onClick={() => refuserDemande(demande.id)}
                          disabled={demandeEnCoursId === demande.id}
                          className="flex flex-1 items-center justify-center gap-1 rounded-cgpt-bouton border border-dj-bordure px-2 py-1.5 text-xs font-semibold text-dj-texte-muet hover:text-[var(--dj-erreur)] disabled:opacity-50"
                        >
                          <XCircle size={13} /> Refuser
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <VisionneuseBibliotheque
        fichier={
          entreeOuverte && entreeOuverte.url_publique
            ? {
                id: entreeOuverte.id,
                nom_fichier: entreeOuverte.nom_fichier || entreeOuverte.nom,
                type_mime: entreeOuverte.type_mime || "application/octet-stream",
                description: entreeOuverte.description || entreeOuverte.nom,
                url_publique: entreeOuverte.url_publique,
                created_at: entreeOuverte.created_at,
              }
            : null
        }
        onFermer={() => setEntreeOuverte(null)}
      />

      {compteRequisPourCopie && (
        <CompteRequisModal
          texte="Crée un compte pour copier ce document dans ta bibliothèque."
          onFerme={() => setCompteRequisPourCopie(false)}
        />
      )}

      {/* 28/08/2026, refonte "Ajouter" (demande Bourama : "le bouton +
          doit être comme en privé") : bouton flottant unique, même
          principe que EspaceBibliotheque.tsx -- Fichier(s) / Texte /
          Lien. MISE À JOUR (29/08/2026) : "Nouveau dossier" ajouté ici
          aussi, en plus du bouton déjà présent dans l'onglet Dossiers --
          ouvre directement cet onglet avec le formulaire de création
          prêt, à la racine. */}
      <input
        ref={inputFichierRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) choisirFichiers(e.target.files);
          e.target.value = "";
          setMenuAjoutOuvert(false);
        }}
      />

      {menuAjoutOuvert && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuAjoutOuvert(false)} />
      )}

      {/* Popup de progression de l'ENVOI (stockage) lui-même, distinct de
          l'indexation plus bas -- 29/08/2026 ter, demande Bourama :
          "flottant pour pouvoir faire autre chose en attendant". Tourne
          dans l'onglet du navigateur (pas côté serveur comme
          l'indexation) : fermer l'app interromprait les fichiers pas
          encore envoyés, d'où l'avertissement -- mais on peut naviguer
          ailleurs dans l'app pendant ce temps, le popup reste visible. */}
      {(envoi || uploadDossierEnCours) && progressionEnvoi && progressionEnvoi.total > 1 && (
        <div className="fixed bottom-[calc(8.25rem+var(--cap-native-navigation-bottom,0px))] right-5 z-40 flex flex-col gap-1 rounded-cgpt-bouton border border-dj-bordure bg-dj-surface px-3 py-2 text-xs text-dj-texte shadow-xl animate-dj-fade-in-rapide">
          <div className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            <span>
              Envoi : {progressionEnvoi.envoyes}/{progressionEnvoi.total} ({Math.round((progressionEnvoi.envoyes / progressionEnvoi.total) * 100)}%)
            </span>
          </div>
          <p className="text-[10px] text-dj-texte-muet">Ne ferme pas l&apos;app tant que l&apos;envoi n&apos;est pas fini.</p>
        </div>
      )}

      {/* Popup de vectorisation en arrière-plan (29/08/2026) -- voir
          EspaceBibliotheque.tsx pour le raisonnement complet, même
          mécanisme ici. Décalé au-dessus du popup d'envoi ci-dessus
          s'ils sont visibles en même temps. */}
      {lotVectorisation && lotVectorisation.enAttente.size > 0 && (
        <div
          className={`fixed right-5 z-40 flex flex-col gap-1 rounded-cgpt-bouton border border-dj-bordure bg-dj-surface px-3 py-2 text-xs text-dj-texte shadow-xl animate-dj-fade-in-rapide ${
            (envoi || uploadDossierEnCours) && progressionEnvoi && progressionEnvoi.total > 1
              ? "bottom-[calc(11.5rem+var(--cap-native-navigation-bottom,0px))]"
              : "bottom-[calc(8.25rem+var(--cap-native-navigation-bottom,0px))]"
          }`}
        >
          <div className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin text-dj-accent-1-texte" />
            <span>
              Indexation : {lotVectorisation.total - lotVectorisation.enAttente.size}/{lotVectorisation.total} (
              {Math.round(((lotVectorisation.total - lotVectorisation.enAttente.size) / lotVectorisation.total) * 100)}%)
            </span>
          </div>
          <p className="text-[10px] text-dj-texte-muet">
            Les fichiers sont déjà disponibles. Tu peux fermer l&apos;app, ça continue côté serveur.
          </p>
        </div>
      )}

      {menuAjoutOuvert && (
        <div className="fixed bottom-[calc(8.25rem+var(--cap-native-navigation-bottom,0px))] right-5 z-40 flex animate-dj-fade-in-rapide flex-col items-end gap-2">
          {/* 12/09/2026, demande Bourama : sélection multiple, même
              principe que EspaceBibliotheque.tsx. */}
          {idsElementsAffiches.length > 0 && (
            <button
              onClick={() => {
                selectionMultiple.activer();
                setMenuAjoutOuvert(false);
              }}
              className="flex items-center gap-2 rounded-cgpt-bouton border border-dj-bordure bg-dj-surface px-4 py-2 text-sm font-medium text-dj-texte shadow-lg transition-colors hover:border-dj-bordure-forte"
            >
              Sélectionner
              <CheckSquare size={15} />
            </button>
          )}
          <button
            onClick={() => {
              setOngletBiblioPublique("dossiers");
              setPileDossiers([]);
              setCreationDossierOuverte(true);
              setMenuAjoutOuvert(false);
            }}
            className="flex items-center gap-2 rounded-cgpt-bouton border border-dj-bordure bg-dj-surface px-4 py-2 text-sm font-medium text-dj-texte shadow-lg transition-colors hover:border-dj-bordure-forte"
          >
            Nouveau dossier
            <FolderPlus size={15} />
          </button>
          {/* 03/09/2026, demande Bourama : "Importer un dossier" (jusque-là
              dans un bouton texte séparé de l'onglet Dossiers) fusionné ici
              -- un seul "+" flottant pour toute la bibliothèque publique. */}
          <button
            onClick={() => {
              setOngletBiblioPublique("dossiers");
              setMenuAjoutOuvert(false);
              inputDossierRef.current?.click();
            }}
            className="flex items-center gap-2 rounded-cgpt-bouton border border-dj-bordure bg-dj-surface px-4 py-2 text-sm font-medium text-dj-texte shadow-lg transition-colors hover:border-dj-bordure-forte"
          >
            Importer un dossier
            <Upload size={15} />
          </button>
          <button
            onClick={() => {
              inputFichierRef.current?.click();
            }}
            className="flex items-center gap-2 rounded-cgpt-bouton border border-dj-bordure bg-dj-surface px-4 py-2 text-sm font-medium text-dj-texte shadow-lg transition-colors hover:border-dj-bordure-forte"
          >
            Importer des fichiers
            <Upload size={15} />
          </button>
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
      {!selectionMultiple.actif && (
      <button
        onClick={() => setMenuAjoutOuvert((v) => !v)}
        aria-label={menuAjoutOuvert ? "Fermer le menu d'ajout" : "Ajouter"}
        className="fixed bottom-[calc(5rem+var(--cap-native-navigation-bottom,0px))] right-5 z-40 flex h-10 w-10 items-center justify-center rounded-cgpt-bouton bg-dj-accent-1 text-[#1A0D02] shadow-[0_4px_20px_rgba(0,0,0,0.35)] transition-transform hover:bg-dj-accent-2"
      >
        <Plus size={18} className={`transition-transform ${menuAjoutOuvert ? "rotate-45" : ""}`} />
      </button>
      )}

      {modaleFichierOuverte && fichiers.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModaleFichierOuverte(false)}>
          <div
            className="flex w-full max-w-sm animate-dj-fade-in-rapide flex-col gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {fichiers.length === 1 ? (
              <>
                <p className="flex items-center gap-2 text-sm text-dj-texte-muet">
                  <Paperclip size={15} /> {fichiers[0].name}
                </p>
                <input
                  autoFocus
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Nom du document (optionnel)"
                  className="rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-4 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
                />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décris-le en quelques mots (optionnel)"
                  rows={3}
                  className="resize-none rounded-xl border border-dj-bordure bg-dj-fond px-4 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
                />
                <ChampsFiltragePublication
                  pays={champPays}
                  niveau={champNiveau}
                  categorie={champCategorie}
                  classe={champClasse}
                  specialite={champSpecialite}
                  onChangePays={setChampPays}
                  onChangeNiveau={setChampNiveau}
                  onChangeCategorie={setChampCategorie}
                  onChangeClasse={setChampClasse}
                  onChangeSpecialite={setChampSpecialite}
                  listes={listesFiltres}
                />
              </>
            ) : (
              <div className="flex flex-col gap-1">
                <p className="text-sm text-dj-texte-muet">{fichiers.length} fichiers -- chacun garde son nom, pas de description.</p>
                <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                  {fichiers.map((f, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 rounded-cgpt-bouton border border-dj-bordure px-3 py-1.5 text-xs text-dj-texte">
                      <span className="truncate">{f.name}</span>
                      <button onClick={() => retirerFichier(f)} className="text-dj-texte-muet hover:text-[var(--dj-erreur)]">
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {erreur && <p className="text-xs text-[var(--dj-erreur)]">{erreur}</p>}
            {envoi && progressionEnvoi && progressionEnvoi.total > 1 && (
              <p className="text-xs text-dj-texte-muet">
                Envoi : {progressionEnvoi.envoyes}/{progressionEnvoi.total} ({Math.round((progressionEnvoi.envoyes / progressionEnvoi.total) * 100)}%)
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  setModaleFichierOuverte(false);
                  setFichiers([]);
                  setNom("");
                  setDescription("");
                  reinitialiserChampsFiltragePublication();
                }}
                className="rounded-cgpt-bouton border border-dj-bordure px-3 py-1.5 text-xs text-dj-texte-muet hover:text-dj-texte"
              >
                Annuler
              </button>
              <button
                onClick={ajouterFichier}
                disabled={envoi || fichiers.length === 0}
                className="rounded-cgpt-bouton bg-dj-accent-1 px-4 py-1.5 text-xs font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
              >
                {envoi ? "Envoi…" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modaleAjout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModaleAjout(null)}>
          <div
            className="flex w-full max-w-sm animate-dj-fade-in-rapide flex-col gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-dj-texte">
              {modaleAjout === "lien" ? "Ajouter un lien" : "Ajouter un texte"}
            </p>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Nom (optionnel)"
              className="rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-4 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
            />
            {modaleAjout === "lien" ? (
              <input
                autoFocus
                value={texteOuLien}
                onChange={(e) => setTexteOuLien(e.target.value)}
                placeholder="https://…"
                className="rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-4 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
              />
            ) : (
              <textarea
                autoFocus
                value={texteOuLien}
                onChange={(e) => setTexteOuLien(e.target.value)}
                placeholder="Ton texte…"
                rows={5}
                className="resize-none rounded-xl border border-dj-bordure bg-dj-fond px-4 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
              />
            )}
            {modaleAjout === "lien" && (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décris-le en quelques mots (optionnel)"
                rows={2}
                className="resize-none rounded-xl border border-dj-bordure bg-dj-fond px-4 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
              />
            )}
            <ChampsFiltragePublication
              pays={champPays}
              niveau={champNiveau}
              categorie={champCategorie}
              classe={champClasse}
              specialite={champSpecialite}
              onChangePays={setChampPays}
              onChangeNiveau={setChampNiveau}
              onChangeCategorie={setChampCategorie}
              onChangeClasse={setChampClasse}
              onChangeSpecialite={setChampSpecialite}
              listes={listesFiltres}
            />
            {erreur && <p className="text-xs text-[var(--dj-erreur)]">{erreur}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  setModaleAjout(null);
                  setTexteOuLien("");
                  setNom("");
                  reinitialiserChampsFiltragePublication();
                  setDescription("");
                }}
                className="rounded-cgpt-bouton border border-dj-bordure px-3 py-1.5 text-xs text-dj-texte-muet hover:text-dj-texte"
              >
                Annuler
              </button>
              <button
                onClick={envoyerTexteOuLien}
                disabled={!texteOuLien.trim() || envoi}
                className="rounded-cgpt-bouton bg-dj-accent-1 px-4 py-1.5 text-xs font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
              >
                {envoi ? "Envoi…" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 03/09/2026, demande Bourama : panneau des 4 filtres (type +
          pays/niveau/catégorie), norme "un seul bouton Filtre + panneau"
          (Airbnb/Amazon/Material Design) plutôt que 4 menus séparés qui
          prendraient toute la largeur sur mobile. Chaque select
          applique son filtre immédiatement (pas de bouton "Appliquer"
          séparé), donc "Fermer" suffit. */}
      {panneauFiltreOuvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPanneauFiltreOuvert(false)}>
          <div
            className="flex w-full max-w-sm animate-dj-fade-in-rapide flex-col gap-3 overflow-y-auto rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4"
            style={{ maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-dj-texte">Filtrer</p>

            {/* 08/09/2026, demande Bourama : "Type" n'a de sens que pour
                une liste de fichiers -- masqué à la racine de l'onglet
                Dossiers, où le panneau filtre les dossiers eux-mêmes. */}
            {listeFichiersVisible && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-dj-texte-muet">Type</p>
                <div className="flex flex-wrap gap-1">
                  {TYPES_BIBLIO_PUBLIQUE.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setFiltreType(t.id)}
                      className={`rounded-cgpt-bouton px-2.5 py-1 text-xs font-medium transition-colors ${
                        filtreType === t.id ? "bg-dj-accent-1 text-[#1A0D02]" : "border border-dj-bordure text-dj-texte-muet hover:text-dj-texte"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-dj-texte-muet">Pays</p>
              <SelectPersonnalise
                options={[{ id: "", label: "Tous les pays" }, ...listesFiltres.pays.map((v) => ({ id: v, label: v }))]}
                valeur={filtrePays}
                onChange={setFiltrePays}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-dj-texte-muet">Niveau</p>
              <SelectPersonnalise
                options={[{ id: "", label: "Tous les niveaux" }, ...listesFiltres.niveaux.map((v) => ({ id: v, label: v }))]}
                valeur={filtreNiveau}
                onChange={setFiltreNiveau}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-dj-texte-muet">Catégorie</p>
              <SelectPersonnalise
                options={[{ id: "", label: "Toutes les catégories" }, ...listesFiltres.categories.map((v) => ({ id: v, label: v }))]}
                valeur={filtreCategorie}
                onChange={setFiltreCategorie}
              />
            </div>

            {/* 04/09/2026, demande Bourama : 2 filtres supplémentaires, même principe. */}
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-dj-texte-muet">Classe</p>
              <SelectPersonnalise
                options={[{ id: "", label: "Toutes les classes" }, ...listesFiltres.classes.map((v) => ({ id: v, label: v }))]}
                valeur={filtreClasse}
                onChange={setFiltreClasse}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-dj-texte-muet">Spécialité</p>
              <SelectPersonnalise
                options={[{ id: "", label: "Toutes les spécialités" }, ...listesFiltres.specialites.map((v) => ({ id: v, label: v }))]}
                valeur={filtreSpecialite}
                onChange={setFiltreSpecialite}
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              {nombreFiltresActifs > 0 ? (
                <button onClick={reinitialiserFiltres} className="text-xs text-dj-texte-muet underline-offset-2 hover:text-dj-texte hover:underline">
                  Réinitialiser
                </button>
              ) : (
                <span />
              )}
              <button
                onClick={() => setPanneauFiltreOuvert(false)}
                className="rounded-cgpt-bouton bg-dj-accent-1 px-4 py-1.5 text-xs font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {cibleGroupeOuverte && (
        <DeplacerVersModal
          titre="Déplacer vers…"
          dossiers={(dossiers ?? []).filter((d) => !idsDossiersSelectionnes.includes(d.id))}
          destinationActuelleId={null}
          onChoisir={deplacerSelectionVers}
          onFermer={() => setCibleGroupeOuverte(false)}
        />
      )}

      {selectionMultiple.actif && selectionMultiple.nombreSelectionne > 0 && (
        <BarreActionsSelection
          nombreSelectionne={selectionMultiple.nombreSelectionne}
          toutEstSelectionne={selectionMultiple.toutEstSelectionne}
          onToutSelectionner={selectionMultiple.toutSelectionner}
          onToutDeselectionner={selectionMultiple.toutDeselectionner}
          onFermer={selectionMultiple.desactiver}
          actions={(() => {
            // 12/09/2026, demande Bourama : classement explicite par
            // composition -- que des fichiers -> toutes les actions
            // fichier ; que des dossiers -> toutes les actions dossier ;
            // mélange -> seulement les actions communes aux deux
            // (Partager, Déplacer si on est dans un dossier, Supprimer).
            // "Signaler" (formulaire légal, un contenu précis à la fois)
            // et "Ouvrir le site"/"Copier" (actions liées au contenu d'un
            // seul fichier ouvert) restent volontairement hors du groupe.
            const queDesFichiers = entreesSelectionnees.length > 0 && idsDossiersSelectionnes.length === 0;
            const queDesDossiers = idsDossiersSelectionnes.length > 0 && entreesSelectionnees.length === 0;
            const liste: ActionSelection[] = [];
            liste.push({ cle: "partager", label: "Partager", icone: <Share2 size={14} />, onClick: partagerSelection });
            if (queDesFichiers) {
              liste.push({
                cle: "copier",
                label: "Copier dans ma bibliothèque",
                icone: <Download size={14} />,
                onClick: copierSelectionVersBiblioPerso,
              });
              liste.push({
                cle: "telecharger",
                label: "Télécharger",
                icone: <Download size={14} />,
                onClick: telechargerSelection,
              });
            }
            if (queDesDossiers) {
              liste.push({
                cle: "attacher",
                label: "Attacher à ma bibliothèque",
                icone: <Download size={14} />,
                onClick: attacherSelection,
              });
            }
            // Déplacer : toujours possible pour des dossiers ; pour des
            // fichiers (seuls ou mélangés à des dossiers), seulement
            // depuis l'intérieur d'un dossier -- même contrainte que le
            // bouton "Déplacer" à l'unité sur une carte fichier.
            if (queDesDossiers || dossierCourantId) {
              liste.push({ cle: "deplacer", label: "Déplacer", icone: <Move size={14} />, onClick: () => setCibleGroupeOuverte(true) });
            }
            if (queDesFichiers && dossierCourantId) {
              liste.push({
                cle: "retirer-dossier",
                label: "Retirer de ce dossier",
                icone: <FolderMinus size={14} />,
                onClick: retirerDuDossierSelection,
              });
            }
            liste.push({
              cle: "supprimer",
              label: "Retirer",
              icone: <Trash2 size={14} />,
              onClick: supprimerSelection,
              destructif: true,
            });
            return liste;
          })()}
        />
      )}
    </div>
  );
}
