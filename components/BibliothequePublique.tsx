"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search, Plus, Trash2, Paperclip, FileText, Image as IconImage, Music as IconAudio, Video as IconVideo,
  Flag, FolderPlus, Check, Link as IconLien, Upload, FolderX, X, Globe, Lock, Loader2, Download, ChevronLeft,
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
  listerDossiersCataloguePublic,
  creerDossierCataloguePublic,
  supprimerDossierCataloguePublic,
  listerListesFiltresBibliothequePublique,
  type EntreeBibliothequePublique,
  type DossierCataloguePublic,
  type ListesFiltresBibliothequePublique,
} from "@/lib/api";
import { messageErreur, ErreurApi } from "@/lib/erreurs";
import { CTACompteRequis } from "@/components/CTACompteRequis";
import { CompteRequisModal } from "@/components/CompteRequisModal";
import { SignalerContenuModal } from "@/components/SignalerContenuModal";
import { VisionneuseBibliotheque } from "@/components/VisionneuseBibliotheque";
import { SelectPersonnalise } from "@/components/SelectPersonnalise";
import { Skeleton } from "./Skeleton";

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
  const [liste, setListe] = useState<EntreeBibliothequePublique[] | undefined>(undefined);
  const [dossiers, setDossiers] = useState<DossierCataloguePublic[] | undefined>(undefined);
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
  const nombreFiltresActifs = [
    filtreType !== "tous", !!filtrePays, !!filtreNiveau, !!filtreCategorie, !!filtreClasse, !!filtreSpecialite,
  ].filter(Boolean).length;

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
  const [ongletBiblioPublique, setOngletBiblioPublique] = useState<"tous" | "dossiers">("tous");
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

  // Recharge depuis le début (recherche/filtre/dossier changé, ou ajout/
  // suppression d'une entrée) -- réinitialise la pagination.
  function charger(q?: string) {
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
        setListe(resultat);
        setDecalage(resultat.length);
        setPlusDeResultats(resultat.length === TAILLE_PAGE_BIBLIO_PUBLIQUE);
      })
      .catch(() => {
        setListe([]);
        setPlusDeResultats(false);
      });
  }

  // Charge le lot suivant quand la sentinelle en bas de liste devient
  // visible -- ajoute à la liste déjà affichée, ne réinitialise rien.
  function chargerPlus() {
    if (chargementPage || !plusDeResultats) return;
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
        setListe((precedent) => (precedent ?? []).concat(resultat));
        setDecalage((d) => d + resultat.length);
        setPlusDeResultats(resultat.length === TAILLE_PAGE_BIBLIO_PUBLIQUE);
      })
      .catch(() => setPlusDeResultats(false))
      .finally(() => setChargementPage(false));
  }

  // Pendant du polling de vectorisation (voir plus bas) : ne rafraîchit
  // que ce qui est déjà affiché (0 -> decalage actuel), pour mettre à
  // jour les statuts sans faire sauter le scroll ni relancer la
  // pagination depuis le début.
  function rafraichirStatuts() {
    if (!liste || liste.length === 0) return;
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
      .then(setListe)
      .catch(() => {});
  }

  function chargerDossiers() {
    listerDossiersCataloguePublic()
      .then(setDossiers)
      .catch(() => setDossiers([]));
  }

  useEffect(() => {
    charger();
    chargerDossiers();
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
  }, [liste, dossierCourantId, recherche, filtrePays, filtreNiveau, filtreCategorie, filtreClasse, filtreSpecialite, plusDeResultats]);

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
        const { erreurs, idsAVectoriser } = await ajouterFichiersABibliothequePublique(fichiers, (envoyes, total) =>
          setProgressionEnvoi({ total, envoyes }),
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
      await creerDossierCataloguePublic(nouveauNomDossier.trim(), nouveauStatutDossier, dossierCourantId ?? undefined, {
        pays: champPays,
        niveau: champNiveau,
        categorie: champCategorie,
        classe: champClasse,
        specialite: champSpecialite,
      });
      setNouveauNomDossier("");
      reinitialiserChampsFiltragePublication();
      setCreationDossierOuverte(false);
      chargerDossiers();
      chargerListesFiltres();
    } catch (e) {
      window.alert(messageErreur(e));
    }
  }

  async function supprimerDossier(d: DossierCataloguePublic) {
    if (!window.confirm(`Supprimer le dossier « ${d.nom} » ? (les documents qu'il contient restent dans le catalogue)`)) return;
    try {
      await supprimerDossierCataloguePublic(d.id);
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

  if (sansCompte) {
    return <CTACompteRequis texte="Crée un compte pour ajouter un document à la bibliothèque publique." />;
  }

  // Sous-dossiers du niveau actuellement affiché (racine si
  // dossierCourantId est null) -- corrigé 01/09/2026, remplace
  // l'ancien "dossiersRacine" qui ne regardait jamais que le niveau 0
  // et empêchait donc toute arborescence.
  const sousDossiersAffiches = (dossiers ?? [])
    .filter((d) => (d.dossier_parent_id ?? null) === dossierCourantId)
    .filter((d) => filtreStatutDossier === "tous" || d.statut === filtreStatutDossier);
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

      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1">
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
          <button
            onClick={() => setOngletBiblioPublique("dossiers")}
            className={`rounded-cgpt-bouton px-2 py-1 font-semibold transition-colors ${
              ongletBiblioPublique === "dossiers" ? "bg-dj-surface-haute text-dj-texte" : "text-dj-texte-muet hover:text-dj-texte"
            }`}
          >
            Dossiers
          </button>
        </div>
        {/* 03/09/2026, demande Bourama : filtre par type + pays/niveau/
            catégorie -- visible seulement là où une liste de FICHIERS est
            montrée (onglet "Tous", ou à l'intérieur d'un dossier ouvert),
            pas sur l'écran de navigation des dossiers eux-mêmes (qui a
            déjà son propre filtre Libre/Privé, une autre notion). */}
        {(ongletBiblioPublique === "tous" || dossierCourantId) && (
          <button
            type="button"
            onClick={() => setPanneauFiltreOuvert(true)}
            className={`flex flex-shrink-0 items-center gap-1 rounded-cgpt-bouton border px-3 py-1.5 font-semibold transition-colors ${
              nombreFiltresActifs > 0
                ? "border-dj-accent-1 bg-dj-accent-1-conteneur text-dj-accent-1-texte"
                : "border-dj-bordure text-dj-texte-muet hover:text-dj-texte"
            }`}
          >
            Filtre
            {nombreFiltresActifs > 0 && (
              <span className="rounded-full bg-dj-accent-1 px-1.5 py-0.5 text-[10px] leading-none text-[#1A0D02]">
                {nombreFiltresActifs}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Étiquettes des filtres actifs (03/09/2026) -- "filter feedback
          bar", chaque filtre reste visible et retirable individuellement
          sans rouvrir le panneau. */}
      {(ongletBiblioPublique === "tous" || dossierCourantId) && nombreFiltresActifs > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {filtreType !== "tous" && (
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

          {/* Skeleton précis (30/08, suite audit) : icône plate 16px
              (Globe/Lock, sans rond coloré -- contrairement à la
              bibliothèque privée qui a un conteneur tonal), une seule
              ligne (le nom, pas de sous-titre ici), 1 bouton d'action
              à droite (suppression). 4 lignes pour remplir l'espace
              au lieu de 2 fixes. */}
          {dossiers === undefined && (
            <div className="flex flex-col gap-2" aria-hidden>
              {[
                { largeur: "w-2/5", delai: "0ms" },
                { largeur: "w-1/2", delai: "100ms" },
                { largeur: "w-1/3", delai: "200ms" },
                { largeur: "w-3/5", delai: "300ms" },
              ].map(({ largeur, delai }, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-xl border border-dj-bordure bg-dj-surface px-4 py-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Skeleton className="h-4 w-4 flex-shrink-0 rounded" style={{ animationDelay: delai }} />
                    <Skeleton className={`h-3.5 rounded ${largeur}`} style={{ animationDelay: delai }} />
                  </div>
                  <Skeleton className="h-3.5 w-3.5 flex-shrink-0 rounded" style={{ animationDelay: delai }} />
                </div>
              ))}
            </div>
          )}

          {dossiers !== undefined && sousDossiersAffiches.length > 0 && (
            <div className="flex flex-col gap-2">
              {sousDossiersAffiches.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-dj-bordure bg-dj-surface px-4 py-3 transition-colors"
                >
                  <button
                    onClick={() => setPileDossiers((p) => [...p, { id: d.id, nom: d.nom }])}
                    title={d.statut === "contribution_libre" ? "Contribution libre : tout le monde peut y ajouter" : "Privé : seul le créateur peut y ajouter"}
                    className="flex min-w-0 items-center gap-2 text-sm text-dj-texte hover:text-dj-texte"
                  >
                    {d.statut === "contribution_libre" ? (
                      <Globe size={16} className="flex-shrink-0 text-dj-texte-muet" />
                    ) : (
                      <Lock size={16} className="flex-shrink-0 text-dj-texte-muet" />
                    )}
                    <span className="truncate font-medium">{d.nom}</span>
                  </button>
                  <button
                    onClick={() => supprimerDossier(d)}
                    className="flex-shrink-0 text-dj-texte-muet hover:text-[var(--dj-erreur)]"
                    title="Supprimer le dossier"
                  >
                    <FolderX size={14} />
                  </button>
                </div>
              ))}
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
            return (
              <div
                key={entree.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-dj-bordure bg-dj-surface px-4 py-3"
              >
                <button
                  onClick={() => entree.url_publique && setEntreeOuverte(entree)}
                  disabled={!entree.url_publique}
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
                        title={
                          entree.statut_vectorisation === "echec"
                            ? "Échec du traitement -- l'IA ne peut pas retrouver ce fichier par son contenu."
                            : "Traitement en cours : l'IA ne peut pas encore retrouver ce fichier facilement."
                        }
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
                  <button
                    onClick={() => setEntreeSignalee(entree)}
                    title="Signaler ce contenu"
                    className="text-dj-texte-muet transition-colors hover:text-[var(--dj-erreur)]"
                  >
                    <Flag size={14} />
                  </button>
                  <button
                    onClick={() => supprimer(entree.id, entree.nom)}
                    title="Retirer (uniquement si c'est toi qui l'as ajouté)"
                    className="text-dj-texte-muet transition-colors hover:text-[var(--dj-erreur)]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
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
      <button
        onClick={() => setMenuAjoutOuvert((v) => !v)}
        aria-label={menuAjoutOuvert ? "Fermer le menu d'ajout" : "Ajouter"}
        className="fixed bottom-[calc(5rem+var(--cap-native-navigation-bottom,0px))] right-5 z-40 flex h-10 w-10 items-center justify-center rounded-cgpt-bouton bg-dj-accent-1 text-[#1A0D02] shadow-[0_4px_20px_rgba(0,0,0,0.35)] transition-transform hover:bg-dj-accent-2"
      >
        <Plus size={18} className={`transition-transform ${menuAjoutOuvert ? "rotate-45" : ""}`} />
      </button>

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
    </div>
  );
}
