"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search, Plus, Trash2, Paperclip, FileText, Image as IconImage, Music as IconAudio, Video as IconVideo,
  Flag, FolderPlus, Check, Link as IconLien, Upload, FolderX, X, Globe, Lock, Loader2, Download,
} from "lucide-react";
import Link from "next/link";
import {
  listerBibliothequePublique,
  ajouterABibliothequePublique,
  ajouterFichiersABibliothequePublique,
  ajouterLienBibliothequePublique,
  ajouterTexteBibliothequePublique,
  supprimerDeBibliothequePublique,
  copierVersBibliothequePersonnelle,
  listerDossiersCataloguePublic,
  creerDossierCataloguePublic,
  supprimerDossierCataloguePublic,
  type EntreeBibliothequePublique,
  type DossierCataloguePublic,
} from "@/lib/api";
import { messageErreur, ErreurApi } from "@/lib/erreurs";
import { CTACompteRequis } from "@/components/CTACompteRequis";
import { CompteRequisModal } from "@/components/CompteRequisModal";
import { SignalerContenuModal } from "@/components/SignalerContenuModal";
import { VisionneuseBibliotheque } from "@/components/VisionneuseBibliotheque";
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
  const [dossierCourantId, setDossierCourantId] = useState<string | null>(null);
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

  // 29/08/2026 bis, demande Bourama : progression réelle de l'ENVOI
  // lui-même (stockage), distincte de la vectorisation qui vient après
  // -- voir EspaceBibliotheque.tsx pour le même mécanisme et son
  // raisonnement détaillé.
  const [progressionEnvoi, setProgressionEnvoi] = useState<{ total: number; envoyes: number } | null>(null);

  function suivreVectorisation(ids: string[]) {
    if (ids.length === 0) return;
    setLotVectorisation((precedent) => {
      const enAttente = new Set(precedent?.enAttente ?? []);
      ids.forEach((id) => enAttente.add(id));
      return { total: (precedent?.total ?? 0) + ids.length, enAttente };
    });
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
    const intervalle = setInterval(() => charger(recherche), 3000);
    return () => clearInterval(intervalle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lotVectorisation?.enAttente.size]);

  function charger(q?: string) {
    listerBibliothequePublique(q)
      .then(setListe)
      .catch(() => setListe([]));
  }

  function chargerDossiers() {
    listerDossiersCataloguePublic()
      .then(setDossiers)
      .catch(() => setDossiers([]));
  }

  useEffect(() => {
    charger();
    chargerDossiers();
  }, []);

  useEffect(() => {
    const id = setTimeout(() => charger(recherche), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche]);

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
        const ligne = await ajouterABibliothequePublique(fichiers[0], nom, description, dossierCourantId || undefined);
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
      setModaleFichierOuverte(false);
      charger(recherche);
      chargerDossiers();
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
    try {
      const ligne =
        modaleAjout === "lien"
          ? await ajouterLienBibliothequePublique(contenu, titre || undefined, description || undefined, dossierCourantId || undefined)
          : await ajouterTexteBibliothequePublique(contenu, titre || undefined, dossierCourantId || undefined);
      if (ligne?.statut_vectorisation === "en_attente" && ligne.id) suivreVectorisation([ligne.id]);
      setTexteOuLien("");
      setNom("");
      setDescription("");
      setModaleAjout(null);
      charger(recherche);
      chargerDossiers();
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
    // Nom optionnel (28/08, demande Bourama) -- l'API se rabat sur "Nouveau dossier" si vide.
    try {
      await creerDossierCataloguePublic(nouveauNomDossier.trim(), nouveauStatutDossier);
      setNouveauNomDossier("");
      setCreationDossierOuverte(false);
      chargerDossiers();
    } catch (e) {
      window.alert(messageErreur(e));
    }
  }

  async function supprimerDossier(d: DossierCataloguePublic) {
    if (!window.confirm(`Supprimer le dossier « ${d.nom} » ? (les documents qu'il contient restent dans le catalogue)`)) return;
    try {
      await supprimerDossierCataloguePublic(d.id);
      if (dossierCourantId === d.id) setDossierCourantId(null);
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

  const dossiersRacine = (dossiers ?? [])
    .filter((d) => !d.dossier_parent_id)
    .filter((d) => filtreStatutDossier === "tous" || d.statut === filtreStatutDossier);
  const dossierActuel = dossierCourantId ? (dossiers ?? []).find((d) => d.id === dossierCourantId) : null;
  const listeAffichee = dossierCourantId
    ? (liste || []).filter((e) => dossierActuel?.fichier_ids.includes(e.id))
    : liste;

  return (
    <div className="flex animate-dj-fade-in-rapide flex-col gap-4">
      <p className="text-sm text-dj-texte-muet">
        Un catalogue de documents partagé par tout le monde : ajoute un fichier, un lien ou une note avec un nom et
        une description pour que les autres le retrouvent facilement. En publiant, tu garantis détenir les droits sur
        ce contenu, voir les{" "}
        <Link href="/cgu" className="text-dj-texte-muet underline hover:text-dj-texte">
          CGU
        </Link>{" "}
        et la{" "}
        <Link href="/copyright" className="text-dj-texte-muet underline hover:text-dj-texte">
          politique de copyright
        </Link>
        .
      </p>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dj-texte-muet" />
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher dans la bibliothèque publique..."
          className="w-full rounded-cgpt-bouton border border-dj-bordure bg-dj-surface py-2 pl-9 pr-3 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
        />
      </div>

      <div className="flex items-center gap-1 text-xs">
        <button
          onClick={() => {
            setOngletBiblioPublique("tous");
            setDossierCourantId(null);
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

      {ongletBiblioPublique === "dossiers" && (
        <>
          {dossierCourantId ? (
            <button
              onClick={() => setDossierCourantId(null)}
              className="flex w-fit items-center gap-1 text-xs font-medium text-dj-texte-muet hover:text-dj-texte"
            >
              ← Dossiers
            </button>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1">
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
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCreationDossierOuverte((v) => !v)}
                    className="flex items-center gap-1 rounded-cgpt-bouton px-2 py-1 font-semibold text-dj-texte-muet transition-colors hover:text-dj-texte"
                  >
                    <FolderPlus size={14} />
                    Nouveau dossier
                  </button>
                  <button
                    onClick={() => inputDossierRef.current?.click()}
                    className="flex items-center gap-1 rounded-cgpt-bouton px-2 py-1 font-semibold text-dj-texte-muet transition-colors hover:text-dj-texte"
                  >
                    <Upload size={14} />
                    Importer un dossier
                  </button>
                </div>
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

              {dossiers !== undefined && dossiersRacine.length > 0 && (
                <div className="flex flex-col gap-2">
                  {dossiersRacine.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-dj-bordure bg-dj-surface px-4 py-3 transition-colors"
                    >
                      <button
                        onClick={() => setDossierCourantId(d.id)}
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
            </>
          )}

          {creationDossierOuverte && (
            <div className="flex animate-dj-fade-in-rapide items-center gap-2">
              <input
                autoFocus
                type="text"
                value={nouveauNomDossier}
                onChange={(e) => setNouveauNomDossier(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && creerDossier()}
                placeholder="Nom du dossier… (optionnel)"
                className="flex-1 rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-3 py-1.5 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
              />
              <select
                value={nouveauStatutDossier}
                onChange={(e) => setNouveauStatutDossier(e.target.value as "contribution_libre" | "privee")}
                className="rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-2 py-1.5 text-xs text-dj-texte outline-none focus:border-dj-bordure-forte"
              >
                <option value="contribution_libre">Contribution libre</option>
                <option value="privee">Privé (moi seul)</option>
              </select>
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
        </>
      )}

      {erreursEnvoi.length > 0 && (
        <div className="flex flex-col gap-1 rounded-cgpt-carte border border-[var(--dj-erreur)] bg-dj-surface p-3 text-xs text-[var(--dj-erreur)]">
          {erreursEnvoi.map((e, i) => (
            <p key={i}>« {e.nom} » : {e.erreur}</p>
          ))}
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
                          {entree.statut_vectorisation === "echec"
                            ? "Échec du traitement -- l'IA ne peut pas retrouver ce fichier par son contenu."
                            : "Traitement en cours : l'IA ne peut pas encore retrouver ce fichier facilement."}
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
              setDossierCourantId(null);
              setCreationDossierOuverte(true);
              setMenuAjoutOuvert(false);
            }}
            className="flex items-center gap-2 rounded-cgpt-bouton border border-dj-bordure bg-dj-surface px-4 py-2 text-sm font-medium text-dj-texte shadow-lg transition-colors hover:border-dj-bordure-forte"
          >
            Nouveau dossier
            <FolderPlus size={15} />
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
            {erreur && <p className="text-xs text-[var(--dj-erreur)]">{erreur}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  setModaleAjout(null);
                  setTexteOuLien("");
                  setNom("");
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
    </div>
  );
}
