import { supabase } from "./supabase";
import { ErreurApi, messageErreur } from "./erreurs";

// URL du backend FastAPI (voir api/main.py). En local pendant le dev :
// http://localhost:8000. Une fois déployé sur Railway : l'URL publique de
// ce service (pas encore un domaine définitif tant que djiguigne.com n'est
// pas branché — voir RAILWAY_DEPLOY.md du dépôt djiguigne-backend).
const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL est requis (voir .env.local.example).");
}

/**
 * Construit une ErreurApi à partir d'une réponse HTTP en échec.
 *
 * AVANT (bug corrigé le 2026-07-31) : le corps JSON de la réponse était
 * pris comme texte brut et collé dans le message d'erreur affiché à
 * l'utilisateur, ex. `Erreur API 403 sur /api/agents/x : {"detail":{"code":
 * "CET_AGENT_NE_T_APPARTIENT_PAS","message":"Cet agent ne t'appartient
 * pas."}}`. Tout le travail de messages propres côté backend (voir
 * djiguigne-backend/core/erreurs.py) était donc invisible : ce JSON brut
 * atterrissait tel quel dans les <p>{erreur}</p> et les alert() du front.
 *
 * MAINTENANT : on parse le corps et on extrait proprement `code`,
 * `message` et `params` (voir erreur_api() côté backend), avec un repli
 * sur chaque format qu'on peut rencontrer :
 * - {"detail": {"code": ..., "message": ..., "params"?: {...}}}  (notre format)
 * - {"detail": [{"msg": ..., ...}, ...]}                         (422 auto FastAPI/pydantic)
 * - {"detail": "texte brut"}                                     (ancien format / lib externe)
 * - corps non-JSON ou vide                                       (erreur réseau, proxy, etc.)
 */
async function construireErreurApi(reponse: Response, chemin: string): Promise<ErreurApi> {
  const texteBrut = await reponse.text().catch(() => "");

  let corps: unknown = null;
  try {
    corps = texteBrut ? JSON.parse(texteBrut) : null;
  } catch {
    corps = null;
  }

  const detail = corps && typeof corps === "object" ? (corps as any).detail : undefined;

  if (detail && typeof detail === "object" && !Array.isArray(detail) && typeof detail.message === "string") {
    // Notre format standard (voir erreur_api() dans core/erreurs.py).
    return new ErreurApi(reponse.status, detail.message, detail.code, detail.params);
  }

  if (typeof detail === "string" && detail.trim()) {
    // Ancienne HTTPException FastAPI avec un detail texte simple.
    return new ErreurApi(reponse.status, detail);
  }

  if (Array.isArray(detail) && detail.length > 0) {
    // Erreur de validation automatique de FastAPI/pydantic (422), jamais
    // écrite pour un humain -- on ne montre pas sa structure technique.
    return new ErreurApi(reponse.status, "La requête envoyée est invalide.", "REQUETE_INVALIDE");
  }

  if (reponse.status === 401) {
    return new ErreurApi(401, "Ta session a expiré, reconnecte-toi.", "SESSION_EXPIREE");
  }

  // Corps vide/non-JSON (ex: proxy, 502/504, coupure réseau) : pas de code
  // exploitable, mais on évite au moins d'afficher du JSON brut ou "".
  return new ErreurApi(
    reponse.status,
    `Une erreur est survenue (${reponse.status}), réessaie dans un instant.`,
    "ERREUR_INCONNUE"
  );
}

/**
 * Appelle l'API avec le token Supabase de la session en cours, si elle
 * existe. N'échoue pas si personne n'est connecté : certaines routes sont
 * publiques (ex: /api/feed, /api/search) et n'ont pas besoin de token.
 */
export async function appelerApi(chemin: string, options: RequestInit = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const entetes = new Headers(options.headers);
  entetes.set("Content-Type", "application/json");
  if (session?.access_token) {
    entetes.set("Authorization", `Bearer ${session.access_token}`);
  }

  const reponse = await fetch(`${API_URL}${chemin}`, {
    ...options,
    headers: entetes,
  });

  if (!reponse.ok) {
    throw await construireErreurApi(reponse, chemin);
  }

  // Certaines routes (ex: POST .../rating) renvoient 204 No Content —
  // aucun corps à parser. Sans ce garde-fou, response.json() plante avec

  // "Unexpected end of JSON input" (bug remonté par Bourama, 2026-07-12,
  // sur le clic étoile de la note). content-length à "0" couvre aussi le
  // cas d'un corps vide envoyé avec un autre code que 204.
  if (reponse.status === 204 || reponse.headers.get("content-length") === "0") {
    return null;
  }

  return reponse.json();
}

/**
 * Variante streaming (Server-Sent Events) pour /api/chat -- voir
 * api/chat.py côté backend. Contrairement à appelerApi, ne parse pas
 * directement un JSON unique : appelle `surEvenement` pour chaque
 * événement reçu (mêmes types que core/main.py:chat(), voir sa
 * docstring : "statut", "statut_termine", "reponse", "confirmation_requise",
 * "meta"), au fur et à mesure du streaming.
 */
export async function appelerApiStream(
  chemin: string,
  corps: unknown,
  surEvenement: (evenement: any) => void
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const entetes = new Headers();
  entetes.set("Content-Type", "application/json");
  if (session?.access_token) {
    entetes.set("Authorization", `Bearer ${session.access_token}`);
  }

  const reponse = await fetch(`${API_URL}${chemin}`, {
    method: "POST",
    headers: entetes,
    body: JSON.stringify(corps),
  });

  if (!reponse.ok || !reponse.body) {
    throw await construireErreurApi(reponse, chemin);
  }

  const lecteur = reponse.body.getReader();
  const decodeur = new TextDecoder();
  let tampon = "";

  while (true) {
    const { done, value } = await lecteur.read();
    if (done) break;
    tampon += decodeur.decode(value, { stream: true });

    // Un événement SSE = une ligne "data: {...}", séparée par \n\n.
    const morceaux = tampon.split("\n\n");
    tampon = morceaux.pop() ?? "";

    for (const morceau of morceaux) {
      const ligne = morceau.trim();
      if (!ligne.startsWith("data:")) continue;
      const contenu = ligne.slice("data:".length).trim();
      if (contenu === "[DONE]") return;
      try {
        surEvenement(JSON.parse(contenu));
      } catch {
        // Ligne mal formée : on l'ignore plutôt que de casser tout le flux.
      }
    }
  }
}
/**
 * Ajoutée pour le fix du 2026-07-12 (champs URL image remplacés par un
 * vrai upload, voir components/ChampImage.tsx). Pas de
 * Content-Type manuel : le navigateur doit le fixer lui-même avec le
 * boundary du FormData, le mettre à la main casse l'upload.
 */
export async function appelerApiFichier(chemin: string, fichier: File) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Connecte-toi pour envoyer un fichier.");
  }

  const corps = new FormData();
  corps.append("fichier", fichier);

  const reponse = await fetch(`${API_URL}${chemin}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: corps,
  });

  if (!reponse.ok) {
    throw await construireErreurApi(reponse, chemin);
  }

  return reponse.json();
}

/**
 * Upload vers la bibliothèque d'un agent (n'importe quel type de fichier
 * + un titre) -- voir api/agents.py:uploader_fichier_bibliotheque.
 * Distincte de appelerApiFichier : celle-ci envoie un champ "titre" en
 * plus du fichier dans le FormData.
 */
export async function ajouterFichierBibliotheque(
  agentId: string,
  fichier: File,
  description: string,
  titre?: string
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Connecte-toi pour envoyer un fichier.");
  }

  const corps = new FormData();
  corps.append("fichier", fichier);
  if (titre?.trim()) corps.append("titre", titre.trim());
  corps.append("description", description);

  const reponse = await fetch(`${API_URL}/api/agents/${agentId}/bibliotheque`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: corps,
  });

  if (!reponse.ok) {
    throw await construireErreurApi(reponse, `/api/agents/${agentId}/bibliotheque`);
  }

  return reponse.json();
}

export type FichierBibliothequePersonnelle = {
  id: string;
  nom_fichier: string;
  type_mime: string;
  description: string | null;
  url_publique: string;
  created_at: string;
  statut_vectorisation?: string;
};

/**
 * Liste la bibliothèque personnelle complète (17/08 -- extrait en
 * fonction nommée pour être réutilisé par le sélecteur "Depuis ma
 * bibliothèque" des sections Documents du programme, voir
 * lib/emplacementsProgramme.ts). EspaceBibliotheque.tsx continue
 * d'appeler appelerApi("/api/bibliotheque") directement, comportement
 * inchangé -- même endpoint, juste une signature typée en plus ici.
 */
export async function listerBibliothequePersonnelle() {
  const resultat = await appelerApi("/api/bibliotheque");
  return resultat as FichierBibliothequePersonnelle[];
}

export type ResultatDiffusion = { diffuse_a: number; total_receveurs: number; echecs: string[] };
// MonRole/lireMonRole/diffuserDocumentEtablissement/diffuserLien/
// listerMesDiffusions retirés le 09/08 (demande Bourama : plus de rôle
// pour Clovis) -- voir plus bas dans ce fichier les nouvelles
// fonctions basées sur /api/agents/clovis/contenus-matiere et
// /rattachements (contenu dynamique par matière, système déjà existant
// et partagé avec Djiguignè, pas de vérification de rôle dessus).

/**
 * Upload vers la bibliothèque PERSONNELLE de l'utilisateur connecté
 * (2026-08-01, nouvelle section "Mon espace" -- voir
 * api/bibliotheque_utilisateur.py:uploader_document). Même mécanique que
 * ajouterFichierBibliotheque ci-dessus, sans agentId : ces documents ne
 * sont liés à aucun agent, consultables depuis n'importe quelle
 * conversation via l'outil consulter_bibliotheque.
 */
export async function ajouterFichierBibliothequePersonnelle(fichier: File, description: string, titre?: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Connecte-toi pour envoyer un fichier.");
  }

  const corps = new FormData();
  // CORRECTIF 2026-08-27 (bug remonté par Bourama : un fichier issu d'un
  // dossier importé gardait "le nom de toutes ses mères et grand-mères
  // séparé par /" -- ex: nom_fichier = "Cours/Chimie/td1.pdf" au lieu de
  // "td1.pdf"). Cause : pour un fichier obtenu via un input
  // webkitdirectory, certains navigateurs utilisent la propriété
  // webkitRelativePath (le chemin complet) plutôt que .name comme nom de
  // fichier dans l'encodage multipart de FormData.append quand aucun 3e
  // argument n'est fourni -- ce que le backend reçoit tel quel comme
  // nom_original (voir api/bibliotheque_utilisateur.py). On force donc
  // explicitement le nom envoyé au SEUL nom de fichier (dernier segment),
  // jamais son chemin -- corrige la source, pour tous les appelants
  // (dossier importé ou fichier simple), peu importe le navigateur.
  const nomSeul = (fichier.webkitRelativePath || fichier.name).split("/").pop() || fichier.name;
  corps.append("fichier", fichier, nomSeul);
  if (titre?.trim()) corps.append("titre", titre.trim());
  corps.append("description", description);

  const reponse = await fetch(`${API_URL}/api/bibliotheque`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: corps,
  });

  if (!reponse.ok) {
    throw await construireErreurApi(reponse, "/api/bibliotheque");
  }

  return reponse.json();
}

/**
 * Ajoute un lien ou une note de texte à la bibliothèque personnelle
 * (2026-08-01, demande Bourama : "ajoute le cas des liens et du texte",
 * "pas de filtre au moment de l'upload" -- voir espace/page.tsx pour la
 * détection automatique du type). Deux fonctions séparées car les
 * payloads backend diffèrent (voir api/bibliotheque_utilisateur.py :
 * /lien attend {url, titre}, /texte attend {contenu, titre}).
 */
/**
 * Bouton "Réessayer" (03/09/2026, demande Bourama : un fichier en échec
 * de vectorisation restait affiché avec un point rouge indéfiniment --
 * voir api/bibliotheque_utilisateur.py:reessayer_vectorisation).
 */
export async function reessayerVectorisationBibliothequePersonnelle(fichierId: string) {
  return appelerApi(`/api/bibliotheque/${fichierId}/reessayer-vectorisation`, { method: "POST" });
}

export async function ajouterLienBibliothequePersonnelle(url: string, titre?: string) {
  return appelerApi("/api/bibliotheque/lien", {
    method: "POST",
    body: JSON.stringify({ url, titre: titre?.trim() || null }),
  });
}

export async function ajouterTexteBibliothequePersonnelle(contenu: string, titre?: string) {
  return appelerApi("/api/bibliotheque/texte", {
    method: "POST",
    body: JSON.stringify({ contenu, titre: titre?.trim() || null }),
  });
}

// 21/08/2026, demande Bourama : "un bibliothèque publique dans la
// section bibliothèque, tout le monde peut y ajouter des documents,
// juste en le décrivant et en donnant un nom" -- CORRECTION le même
// jour (malentendu de ma part) : nom + description accompagnent un VRAI
// fichier uploadé, ils ne le remplacent pas. Catalogue distinct de la
// bibliothèque personnelle (voir docstring backend), mais upload réel
// comme elle.
export type EntreeBibliothequePublique = {
  id: string;
  nom: string;
  description: string;
  nom_fichier: string | null;
  type_mime: string | null;
  taille_octets: number | null;
  url_publique: string | null;
  created_at: string;
  // 29/08/2026, file d'attente de vectorisation en arrière-plan : "en_attente" / "en_cours" / "pret" / "echec".
  statut_vectorisation?: string;
  // 03/09/2026, demande Bourama : 3 filtres cochables à la publication
  // (voir core/listes_bibliotheque_publique.py côté backend), optionnels.
  pays?: string | null;
  niveau?: string | null;
  categorie?: string | null;
};

// 03/09/2026, demande Bourama : filtres pays/niveau/catégorie en plus de
// la recherche texte -- voir GET /api/bibliotheque-publique côté backend.
// 04/09/2026 : + dossierId/decalage/limite pour le scroll infini (plus
// de plafond fixe côté serveur, qui cachait les fichiers les plus
// anciens dès que le catalogue dépassait 200 entrées).
export type FiltresBibliothequePublique = {
  pays?: string;
  niveau?: string;
  categorie?: string;
  dossierId?: string;
  decalage?: number;
  limite?: number;
};

export async function listerBibliothequePublique(q?: string, filtres?: FiltresBibliothequePublique) {
  const params = new URLSearchParams();
  if (q?.trim()) params.set("q", q.trim());
  if (filtres?.pays?.trim()) params.set("pays", filtres.pays.trim());
  if (filtres?.niveau?.trim()) params.set("niveau", filtres.niveau.trim());
  if (filtres?.categorie?.trim()) params.set("categorie", filtres.categorie.trim());
  if (filtres?.dossierId) params.set("dossier_id", filtres.dossierId);
  if (filtres?.decalage !== undefined) params.set("decalage", String(filtres.decalage));
  if (filtres?.limite !== undefined) params.set("limite", String(filtres.limite));
  const suffixe = params.toString() ? `?${params.toString()}` : "";
  const resultat = await appelerApi(`/api/bibliotheque-publique${suffixe}`);
  return resultat as EntreeBibliothequePublique[];
}

// 03/09/2026, demande Bourama : valeurs déjà connues de pays/niveau/
// catégorie, pour peupler les suggestions du formulaire de publication
// ET les menus des filtres de recherche -- voir GET
// /api/bibliotheque-publique/listes côté backend.
export type ListesFiltresBibliothequePublique = {
  pays: string[];
  niveaux: string[];
  categories: string[];
};

export async function listerListesFiltresBibliothequePublique() {
  return appelerApi("/api/bibliotheque-publique/listes") as Promise<ListesFiltresBibliothequePublique>;
}

export async function ajouterABibliothequePublique(
  fichier: File,
  nom?: string,
  description?: string,
  dossierId?: string,
  filtres?: FiltresBibliothequePublique,
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Connecte-toi pour envoyer un fichier.");
  }

  const corps = new FormData();
  corps.append("fichier", fichier);
  corps.append("nom", (nom || "").trim());
  corps.append("description", description || "");
  if (dossierId) corps.append("dossier_id", dossierId);
  if (filtres?.pays?.trim()) corps.append("pays", filtres.pays.trim());
  if (filtres?.niveau?.trim()) corps.append("niveau", filtres.niveau.trim());
  if (filtres?.categorie?.trim()) corps.append("categorie", filtres.categorie.trim());

  const reponse = await fetch(`${API_URL}/api/bibliotheque-publique`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: corps,
  });

  if (!reponse.ok) {
    throw await construireErreurApi(reponse, "/api/bibliotheque-publique");
  }

  return (await reponse.json()) as EntreeBibliothequePublique;
}

// 28/08/2026, demande Bourama : "le bouton + doit être comme en privé"
// -- parité texte/lien avec ajouterTexteBibliothequePersonnelle /
// ajouterLienBibliothequePersonnelle.
export async function ajouterLienBibliothequePublique(
  url: string,
  nom?: string,
  description?: string,
  dossierId?: string,
  filtres?: FiltresBibliothequePublique,
) {
  return appelerApi("/api/bibliotheque-publique/lien", {
    method: "POST",
    body: JSON.stringify({
      url,
      nom: nom || "",
      description: description || "",
      dossier_id: dossierId || "",
      pays: filtres?.pays || "",
      niveau: filtres?.niveau || "",
      categorie: filtres?.categorie || "",
    }),
  }) as Promise<EntreeBibliothequePublique>;
}

export async function ajouterTexteBibliothequePublique(
  contenu: string,
  nom?: string,
  dossierId?: string,
  filtres?: FiltresBibliothequePublique,
) {
  return appelerApi("/api/bibliotheque-publique/texte", {
    method: "POST",
    body: JSON.stringify({
      contenu,
      nom: nom || "",
      dossier_id: dossierId || "",
      pays: filtres?.pays || "",
      niveau: filtres?.niveau || "",
      categorie: filtres?.categorie || "",
    }),
  }) as Promise<EntreeBibliothequePublique>;
}

export type DossierCataloguePublic = {
  id: string;
  cree_par: string | null;
  nom: string;
  statut: "contribution_libre" | "privee";
  dossier_parent_id: string | null;
  created_at: string;
  fichier_ids: string[];
  // 03/09/2026, demande Bourama : mêmes 3 filtres que pour un fichier.
  pays?: string | null;
  niveau?: string | null;
  categorie?: string | null;
};

export async function listerDossiersCataloguePublic() {
  return appelerApi("/api/bibliotheque-publique/dossiers") as Promise<DossierCataloguePublic[]>;
}

export async function creerDossierCataloguePublic(
  nom: string,
  statut: "contribution_libre" | "privee" = "contribution_libre",
  dossierParentId?: string,
  filtres?: FiltresBibliothequePublique,
) {
  return appelerApi("/api/bibliotheque-publique/dossiers", {
    method: "POST",
    body: JSON.stringify({
      nom,
      statut,
      dossier_parent_id: dossierParentId || null,
      pays: filtres?.pays || "",
      niveau: filtres?.niveau || "",
      categorie: filtres?.categorie || "",
    }),
  }) as Promise<DossierCataloguePublic>;
}

export async function renommerDossierCataloguePublic(dossierId: string, nom: string) {
  return appelerApi(`/api/bibliotheque-publique/dossiers/${dossierId}`, {
    method: "PATCH",
    body: JSON.stringify({ nom }),
  });
}

export async function supprimerDossierCataloguePublic(dossierId: string) {
  return appelerApi(`/api/bibliotheque-publique/dossiers/${dossierId}`, { method: "DELETE" });
}

export async function rangerFichierDossierCataloguePublic(dossierId: string, fichierId: string) {
  return appelerApi(`/api/bibliotheque-publique/dossiers/${dossierId}/fichiers`, {
    method: "POST",
    body: JSON.stringify({ fichier_id: fichierId }),
  });
}

export async function retirerFichierDossierCataloguePublic(dossierId: string, fichierId: string) {
  return appelerApi(`/api/bibliotheque-publique/dossiers/${dossierId}/fichiers/${fichierId}`, { method: "DELETE" });
}

export async function supprimerDeBibliothequePublique(entreeId: string) {
  return appelerApi(`/api/bibliotheque-publique/${entreeId}`, { method: "DELETE" });
}

/** Pendant de reessayerVectorisationBibliothequePersonnelle ci-dessus, pour la bibliothèque publique. */
export async function reessayerVectorisationBibliothequePublique(entreeId: string) {
  return appelerApi(`/api/bibliotheque-publique/${entreeId}/reessayer-vectorisation`, { method: "POST" });
}

/**
 * Upload de PLUSIEURS fichiers d'un coup vers la bibliothèque publique
 * (28/08/2026, demande Bourama). Même pattern que
 * ajouterFichiersBibliothequePersonnelle : boucle séquentielle, pas
 * d'endpoint bulk dédié côté backend. Chaque fichier reçoit son nom
 * (sans extension) comme nom de document, sans description -- voir
 * BibliothequePublique.tsx pour la raison (choix de Bourama : dans ce
 * cas précis, pas de description). Si un fichier échoue, les autres
 * continuent quand même ; l'appelant reçoit la liste des erreurs (vide
 * si tout est passé) pour les afficher.
 */
export async function ajouterFichiersABibliothequePublique(
  fichiers: File[],
  onProgres?: (envoyes: number, total: number) => void,
) {
  const erreurs: { nom: string; erreur: string }[] = [];
  const idsAVectoriser: string[] = [];
  for (const [index, fichier] of fichiers.entries()) {
    const nomAuto = fichier.name.replace(/\.[^/.]+$/, "");
    try {
      const ligne = await ajouterABibliothequePublique(fichier, nomAuto, "");
      if (ligne?.statut_vectorisation === "en_attente" && ligne.id) idsAVectoriser.push(ligne.id);
    } catch (e) {
      erreurs.push({ nom: fichier.name, erreur: messageErreur(e) });
    }
    onProgres?.(index + 1, fichiers.length);
  }
  return { erreurs, idsAVectoriser };
}

// Copie un fichier de la bibliothèque publique vers la bibliothèque
// personnelle de l'utilisateur connecté (25/08, demande Bourama).
// appelerApi lève déjà une ErreurApi (statusCode 401) si pas connecté --
// même pattern de gestion que ajouterABibliothequePublique.
export async function copierVersBibliothequePersonnelle(entreeId: string) {
  return appelerApi(`/api/bibliotheque/copier-depuis-publique/${entreeId}`, { method: "POST" });
}

/**
 * Upload de PLUSIEURS fichiers d'un coup vers la bibliothèque personnelle
 * (2026-08-01, demande Bourama : "plusieurs upload à la fois") -- simple
 * boucle séquentielle sur ajouterFichierBibliothequePersonnelle (pas de
 * endpoint bulk dédié côté backend, inutile pour ce volume). Si un
 * fichier échoue, les autres continuent quand même ; l'appelant reçoit
 * la liste des erreurs (vide si tout est passé) pour les afficher.
 */
export async function ajouterFichiersBibliothequePersonnelle(fichiers: File[]) {
  const erreurs: { nom: string; erreur: string }[] = [];
  for (const fichier of fichiers) {
    try {
      await ajouterFichierBibliothequePersonnelle(fichier, "", "");
    } catch (e) {
      erreurs.push({ nom: fichier.name, erreur: messageErreur(e) });
    }
  }
  return erreurs;
}

/**
 * Upload d'une image jointe à un message de chat -- voir
 * components/chat/ChatIA.tsx:envoyerMessage côté appelant. Réutilise
 * appelerApiFichier (même mécanique FormData) sur le nouvel endpoint dédié
 * au chat. Renvoie l'URL publique à passer dans `image_url` du payload
 * /api/chat.
 */
export async function uploaderImageChat(fichier: File) {
  const resultat = await appelerApiFichier("/api/uploads/image-chat", fichier);
  return resultat.url as string;
}

/**
 * Extraction texte d'un document (PDF/Word/Excel) joint à un message de
 * chat -- voir api/uploads.py:uploader_document_chat. Le fichier original
 * est stocké (url) et, pour Word/Excel, converti en PDF pour aperçu
 * visuel (url_apercu, peut être null si CloudConvert indisponible/pas
 * configuré -- voir core/conversion_pdf.py côté backend). Le texte extrait
 * est injecté directement dans le message avant envoi à /api/chat.
 */
export async function uploaderDocumentChat(fichier: File) {
  const resultat = await appelerApiFichier("/api/uploads/document-chat", fichier);
  return resultat as { texte: string; tronque: boolean; url: string | null; url_apercu: string | null };
}

/**
 * Transcription d'un enregistrement audio (dictée vocale) via
 * api/uploads.py:uploader_audio_chat (Whisper/Groq). Le fichier est un
 * Blob MediaRecorder emballé en File côté BarreDeSaisie.tsx.
 */
export async function transcrireAudioChat(fichier: File) {
  const resultat = await appelerApiFichier("/api/uploads/audio-chat", fichier);
  return resultat as { texte: string; url: string | null };
}

/**
 * Traitement d'une vidéo jointe à un message de chat -- voir
 * api/uploads.py:uploader_video_chat (extraction audio via Whisper +
 * frames via ffmpeg, analysées ensuite par Gemini). Depuis le
 * 2026-07-22, la vidéo originale est aussi gardée dans la bibliothèque
 * (niveau utilisateur), pas seulement traitée puis jetée.
 */
export async function uploaderVideoChat(fichier: File) {
  const resultat = await appelerApiFichier("/api/uploads/video-chat", fichier);
  return resultat as { transcript: string; frames_base64: string[]; url: string | null };
}

/**
 * OCR ciblé formule (2026-07-26, priorité maths de Bourama) -- voir
 * api/uploads.py:extraire_formule. Contrairement à uploaderImageChat,
 * cette image ne rejoint jamais la conversation : elle sert uniquement
 * à extraire le LaTeX, ouvert ensuite dans EditeurFormule.tsx (éditable
 * avant insertion). Lève une erreur si aucune formule n'est détectée
 * (422 côté backend).
 */
export async function extraireFormuleImage(fichier: File) {
  const resultat = await appelerApiFichier("/api/uploads/extraire-formule", fichier);
  return resultat.latex as string;
}

/**
 * Registre d'affichage des outils (nom, label, icône, onglet, appli) --
 * voir api/outils_registre.py côté backend, source unique pour éviter
 * d'avoir à toucher ce dépôt à chaque nouvel outil (2026-08-15, demande
 * Bourama). Pas d'authentification requise (accessible avant connexion).
 */
export async function lireRegistreOutils() {
  return appelerApi(`/api/outils/registre`);
}

export async function lireDroitsAgent(agentId: string) {
  return appelerApi(`/api/agents/${agentId}/droits`);
}

export async function modifierDroitsAgent(
  agentId: string,
  payload: {
    outils_generation: string[];
    serveurs: string[];
    actions_locales: string[];
    informer_utilisateurs: boolean;
  }
) {
  return appelerApi(`/api/agents/${agentId}/droits`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/**
 * Outils/actions locales réellement actifs pour CET agent, côté chat --
 * endpoint public (pas besoin d'être le créateur), sert à filtrer les
 * boutons de BarreDeSaisie.tsx pour que ce que le créateur n'a pas coché
 * n'apparaisse jamais dans le chat. `outils` réutilise directement
 * lister_outils_autorises_pour_agent côté backend (même fonction que la
 * vraie requête envoyée à Groq) -- inclut donc déjà les noms d'outils
 * dérivés d'un serveur (ex. tavily_search, explorer_depot_github).
 * `actions_locales` couvre les boutons UI (préfixe "ui_") qui ne sont pas
 * des outils LLM et donc invisibles à cette fonction.
 */
export async function lireOutilsChatAgent(agentId: string) {
  return appelerApi(`/api/agents/${agentId}/outils-disponibles`) as Promise<{
    outils: string[];
    actions_locales: string[];
  }>;
}

/**
 * Statut de connexion OAuth à un service externe (ex. "github") via le
 * moteur générique -- voir connexions/oauth_generique.py côté backend.
 */
export async function statutConnexion(service: string) {
  const resultat = await appelerApi(`/api/connexions/${service}/statut`);
  return resultat as { connecte: boolean };
}

/**
 * CORRECTION (2026-07-30) : obtenirOutilsDisponibles() faisait double
 * emploi avec lireOutilsChatAgent() ci-dessus -- même endpoint, mais
 * lireOutilsChatAgent() couvre en plus les actions locales (catégorie 4,
 * boutons UI type localisation/LaTeX/dessin, ajoutées le même jour).
 * Fusionné en une seule fonction pour ne pas avoir deux sources
 * divergentes du même appel réseau.
 */

/**
 * Démarre une connexion OAuth : renvoie l'URL d'autorisation à ouvrir
 * (redirection complète, pas de popup) -- voir app/oauth/retour/page.tsx
 * pour la page qui traite le retour.
 *
 * CORRECTION (2026-07-31) : le backend renvoyait avant un statut 200 avec
 * `{url: null, erreur: "..."}` en cas d'échec (voir api/connexions.py) --
 * incohérent avec le reste de l'API et invisible pour tout code qui ne
 * pense pas à lire ce champ précis. Il lève maintenant une vraie erreur
 * (voir erreur_api() côté backend) : à catcher avec messageErreur(e),
 * comme n'importe quel autre appel API.
 */
export async function demarrerConnexion(service: string, agentId?: string) {
  const chemin = agentId
    ? `/api/connexions/${service}/demarrer?agent_id=${encodeURIComponent(agentId)}`
    : `/api/connexions/${service}/demarrer`;
  const resultat = await appelerApi(chemin);
  return resultat as { url: string };
}

/**
 * Liste les dépôts GitHub (publics et privés) de la personne connectée --
 * voir api/connexions.py:depots_github, utilisé par le sélecteur de dépôt
 * dans BarreDeSaisie.tsx. Voir demarrerConnexion ci-dessus pour la même
 * correction (vraie erreur levée plutôt que champ `erreur` dans le corps).
 */
export async function depotsGithub() {
  const resultat = await appelerApi("/api/connexions/github/depots");
  return resultat as {
    depots: { nom_complet: string; prive: boolean; description: string | null; url: string }[];
  };
}

/**
 * Cherche des pages/bases Notion visibles par la personne connectée --
 * voir api/connexions.py:pages_notion, utilisé par le sélecteur de page
 * dans BarreDeSaisie.tsx. Même correction (2026-07-31) que depotsGithub
 * ci-dessus : une vraie erreur est levée en cas d'échec.
 *
 * CORRECTION (01/08) : contrairement à depotsGithub (listing complet),
 * ceci passe désormais par l'outil MCP notion-search côté backend, qui
 * exige un texte de recherche -- sans `q`, le backend renvoie une liste
 * vide plutôt qu'un listing complet (impossible avec cet outil).
 */
export async function pagesNotion(q: string) {
  const resultat = await appelerApi(`/api/connexions/notion/pages?q=${encodeURIComponent(q)}`);
  return resultat as {
    pages: { titre: string; type: "page" | "database"; url: string }[];
  };
}

/**
 * Interroge le contenu d'une base Notion (02/08, demande Bourama : "on va
 * ajouter" query-data-sources/query-database-view) -- `url` est l'URL de la
 * base choisie dans le sélecteur (résultat de pagesNotion, type
 * "database"), `q` le texte tapé sur le 2e écran de requête. Voir
 * api/connexions.py:lignes_base_notion pour le detail (fetch de la base ->
 * data source URL -> SQL, filtre par `q` fait côté backend en Python, pas
 * une vraie clause SQL dynamique).
 */
export async function lignesBaseNotion(url: string, q: string) {
  const resultat = await appelerApi(
    `/api/connexions/notion/bases/lignes?url=${encodeURIComponent(url)}&q=${encodeURIComponent(q)}`
  );
  return resultat as {
    lignes: { titre: string; url: string | null; proprietes: Record<string, unknown> }[];
  };
}

/**
 * Crée une page Notion standalone (02/08, demande Bourama : titre + zone de
 * texte pour le contenu, pas de choix de parent dans cette itération). Voir
 * api/connexions.py:creer_page_notion -- appel MCP direct, pas de passage
 * par la confirmation OUTILS_SENSIBLES (le clic "Créer" du formulaire en
 * tient lieu).
 */
export async function creerPageNotion(titre: string, contenu: string) {
  const resultat = await appelerApi(`/api/connexions/notion/pages`, {
    method: "POST",
    body: JSON.stringify({ titre, contenu }),
  });
  return resultat as { url: string };
}

/**
 * Contenu dynamique par matière -- agent "Clovis" (06/08/2026, demande
 * Bourama). Voir djiguigne-backend/api/contenu_dynamique_matiere.py.
 * "Enseignant" et "étudiant" ici ne sont pas des rôles de compte : ce
 * sont juste les deux rôles qu'on joue sur CET agent précis en écrivant
 * du contenu ou en entrant un code -- n'importe quel compte connecté
 * peut faire les deux. Fonctions ci-dessous ajoutées le 09/08 (le bloc
 * repris tel quel de djiguigne-frontend au bootstrap du projet n'avait
 * jamais été câblé nulle part, retiré) -- toujours agent_id="clovis"
 * en dur, Clovis n'ayant qu'une seule IA (contrairement à
 * djiguigne-frontend, générique sur plusieurs agents).
 */

// Section "Mes comportements" (06/08/2026, demande Bourama : "on peut en
// mettre plusieurs hein, pas juste un") : plusieurs instructions perso
// écrites par l'étudiant, chacune ajoutée EN PLUS du system_prompt déjà
// résolu (voir core/main.py::_construire_system_prompt côté backend).
//
// NOTE (21/08/2026, demande Bourama) : le mot affiché à l'utilisateur
// est désormais "skill" ("plus connu, plus simple à expliquer et à
// reconnaître") -- mais UNIQUEMENT le texte visible. En interne (ce
// type, les fonctions ci-dessous, les routes /api/.../mes-comportements,
// les tables Supabase, les outils MCP) tout reste nommé "comportement".
// Ne pas renommer les identifiants techniques à partir de cette demande.
export type Comportement = {
  id: string;
  texte: string;
  description: string;
  nom: string;
  lien_type: string | null;
  lien_id: string | null;
  lien_libelle: string | null;
  actif: boolean;
  depuis_public: boolean;
};

export async function lireMesComportements(agentId: string) {
  const resultat = await appelerApi(`/api/agents/${agentId}/mes-comportements`);
  return resultat as Comportement[];
}

// 21/08/2026, demande Bourama : "ajoute activer et désactiver aux
// comportements" -- désactiver n'efface rien, voir le backend.
export async function activerDesactiverComportement(agentId: string, comportementId: string, actif: boolean) {
  const resultat = await appelerApi(`/api/agents/${agentId}/mes-comportements/${comportementId}/actif`, {
    method: "PATCH",
    body: JSON.stringify({ actif }),
  });
  return resultat as Comportement;
}

// 21/08/2026, demande Bourama : "je veux un onglet public... quelqu'un
// peut l'uploader et l'activer". Publier prend une copie figée du
// comportement (l'original ici n'est jamais modifié).
export async function publierComportement(agentId: string, comportementId: string) {
  return appelerApi(`/api/agents/${agentId}/mes-comportements/${comportementId}/publier`, { method: "POST" });
}

export type ComportementPublic = {
  id: string;
  nom: string;
  description: string;
  texte: string;
  skill_md: string;
  activations_count: number;
};

export async function rechercherComportementsPublics(q?: string) {
  const suffixe = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  const resultat = await appelerApi(`/api/comportements-publics${suffixe}`);
  return resultat as ComportementPublic[];
}

export async function activerComportementPublic(comportementPublicId: string) {
  const resultat = await appelerApi(`/api/comportements-publics/${comportementPublicId}/activer`, { method: "POST" });
  return resultat as Comportement;
}

// 25/08/2026, demande Bourama : uploader directement un fichier .md dans
// le catalogue public, publié immédiatement pour tout le monde (pas de
// passage par "Mes comportements"). Même pattern fetch manuel que
// ajouterABibliothequePublique (appelerApi force le JSON, inadapté à un
// FormData).
export async function uploaderSkillPublic(fichier: File, nom: string, description?: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Connecte-toi pour envoyer un skill.");
  }

  const corps = new FormData();
  corps.append("fichier", fichier);
  corps.append("nom", nom.trim());
  corps.append("description", description || "");

  const reponse = await fetch(`${API_URL}/api/comportements-publics/uploader`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: corps,
  });

  if (!reponse.ok) {
    throw await construireErreurApi(reponse, "/api/comportements-publics/uploader");
  }

  return (await reponse.json()) as ComportementPublic;
}

// nom = null/undefined -> mode "auto" (nom généré côté serveur avec le
// skill) ; sinon nom choisi par l'étudiant, gardé tel quel. lienType/
// lienId optionnels (20/08) : rattache dès la création à un emplacement
// du programme.
export async function ajouterComportement(
  agentId: string,
  texte: string,
  nom?: string | null,
  lienType?: string | null,
  lienId?: string | null
) {
  const resultat = await appelerApi(`/api/agents/${agentId}/mes-comportements`, {
    method: "POST",
    body: JSON.stringify({ texte, nom: nom || null, lien_type: lienType || null, lien_id: lienId || null }),
  });
  return resultat as Comportement;
}

// 25/08/2026, demande Bourama : uploader un fichier .md directement dans
// "Mes comportements", gardé TEL QUEL (pas de passage par l'IA -- voir
// importer_comportement_depuis_skill_md côté backend). Même pattern
// fetch manuel que uploaderSkillPublic ci-dessus.
export async function importerComportementDepuisFichier(agentId: string, fichier: File, nom: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Connecte-toi pour importer un skill.");
  }

  const corps = new FormData();
  corps.append("fichier", fichier);
  corps.append("nom", nom.trim());

  const reponse = await fetch(`${API_URL}/api/agents/${agentId}/mes-comportements/importer`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: corps,
  });

  if (!reponse.ok) {
    throw await construireErreurApi(reponse, `/api/agents/${agentId}/mes-comportements/importer`);
  }

  return (await reponse.json()) as Comportement;
}

// Attache (lienType+lienId fournis) ou détache (les deux null) un
// comportement DÉJÀ EXISTANT -- séparé de modifierComportement exprès,
// un seul emplacement à la fois (20/08/2026, demande Bourama).
export async function attacherComportement(agentId: string, comportementId: string, lienType: string | null, lienId: string | null) {
  const resultat = await appelerApi(`/api/agents/${agentId}/mes-comportements/${comportementId}/lien`, {
    method: "PATCH",
    body: JSON.stringify({ lien_type: lienType, lien_id: lienId }),
  });
  return resultat as Comportement;
}

export async function modifierComportement(agentId: string, comportementId: string, texte: string, nom?: string | null) {
  const resultat = await appelerApi(`/api/agents/${agentId}/mes-comportements/${comportementId}`, {
    method: "PATCH",
    body: JSON.stringify({ texte, nom: nom || null }),
  });
  return resultat as Comportement;
}

// 18/08/2026, demande Bourama ("les deux : édite le texte, l'impacte,
// ou tu peux l'éditer directement") : édition DIRECTE du skill généré
// (frontmatter + corps), lue/écrite à la demande (onglet dédié), sans
// passer par le texte brut. Éditer le texte régénère toujours le skill
// (via modifierComportement ci-dessus) -- ces deux chemins coexistent,
// le second écrasant le premier s'ils sont utilisés l'un après l'autre.
export async function lireSkillComportement(agentId: string, comportementId: string) {
  const resultat = await appelerApi(`/api/agents/${agentId}/mes-comportements/${comportementId}/skill`);
  return (resultat as { skill_md: string }).skill_md;
}

export async function modifierSkillComportement(agentId: string, comportementId: string, skillMd: string) {
  const resultat = await appelerApi(`/api/agents/${agentId}/mes-comportements/${comportementId}/skill`, {
    method: "PATCH",
    body: JSON.stringify({ skill_md: skillMd }),
  });
  return resultat as Comportement;
}

export async function supprimerComportement(agentId: string, comportementId: string) {
  return appelerApi(`/api/agents/${agentId}/mes-comportements/${comportementId}`, { method: "DELETE" });
}

// Utilisée par EspaceClovis.tsx pour savoir si l'onglet "Mes
// comportements" doit s'afficher -- agentId toujours "clovis" ici (plus
// de rôle, voir EspaceClovis.tsx), mais la fonction reste générique.
// Endpoint public (GET /api/agents/{id}), pas besoin d'appelerApi/auth.
// Renvoie false silencieusement si l'agent n'existe pas ou en cas
// d'erreur réseau, pour ne jamais faire planter Mon espace.
export async function sectionComportementsActivee(agentId: string): Promise<boolean> {
  try {
    const reponse = await fetch(`${API_URL}/api/agents/${agentId}`);
    if (!reponse.ok) return false;
    const data = await reponse.json();
    return !!data.section_mes_comportements;
  } catch {
    return false;
  }
}

/** Voir api/profiles.py:mettre_a_jour_mon_profil -- endpoint générique
 * partagé (upsert), utilisé ici juste pour enregistrer le nom saisi à
 * l'inscription, sans aucun rôle (09/08, remplace l'ancien
 * creerEtudiantAutonome qui écrivait aussi role="etudiant"). */
export async function mettreAJourMonProfil(nomAffiche: string) {
  return appelerApi("/api/profiles/me", {
    method: "PATCH",
    body: JSON.stringify({ nom_affiche: nomAffiche }),
  });
}

// --- Page Paramètres (22/08/2026, demande Bourama) -------------------------
//
// Réutilise entièrement les endpoints déjà en place côté backend
// (api/profiles.py) : rien de nouveau à créer côté FastAPI. Le mot de
// passe n'est PAS géré ici (voir lib/supabase.ts : "le backend FastAPI ne
// gère jamais de mot de passe", supabase.auth.updateUser() appelé
// directement depuis EspaceParametres.tsx).

/** GET /api/profiles/{user_id} avec l'id de la session en cours -- pas de
 * endpoint "GET /me" dédié côté backend, voir api/profiles.py. */
export async function lireMonProfil() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    throw new ErreurApi(401, "Connecte-toi pour voir ton profil.", "SESSION_EXPIREE");
  }
  return appelerApi(`/api/profiles/${session.user.id}`);
}

/** PATCH partiel générique (voir MettreAJourProfilPayload côté backend) --
 * distincte de mettreAJourMonProfil(nomAffiche) ci-dessus pour ne pas
 * changer sa signature existante (utilisée telle quelle à l'inscription). */
export async function enregistrerMonProfil(payload: {
  nom_affiche?: string;
  bio?: string;
  avatar_url?: string;
  notifications_proactives_actives?: boolean;
}) {
  return appelerApi("/api/profiles/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/** DELETE /api/profiles/me -- voir api/profiles.py:supprimer_mon_compte
 * pour la purge complète (agents, posts, follows, profil, compte Auth). */
export async function supprimerMonCompte() {
  return appelerApi("/api/profiles/me", { method: "DELETE" });
}

/** GET /api/profiles/me/export -- voir api/profiles.py:exporter_mes_donnees.
 * Contrairement à appelerApi (qui retourne le JSON parsé pour l'utiliser
 * en mémoire), déclenche un vrai téléchargement de fichier dans le
 * navigateur : on récupère le JSON nous-mêmes puis on construit un blob
 * + un lien <a download> temporaire (fetch() seul ne fait jamais
 * apparaître la boîte de dialogue "Enregistrer sous" du navigateur,
 * même avec l'en-tête Content-Disposition renvoyé par le backend). */
export async function exporterMesDonnees() {
  const donnees = await appelerApi("/api/profiles/me/export");
  const blob = new Blob([JSON.stringify(donnees, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = `clovis_mes_donnees_${donnees.user_id ?? "export"}.json`;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(url);
}

// --- Codes de partage (14/08/2026, remplace le système matière ci-dessus,
// qui n'était de toute façon jamais lu par le chat -- voir
// core/codes_partage.py côté backend) --------------------------------------
//
// Un code peut porter, chacun optionnel et combinable : des comportements
// (18/08/2026 : sélection parmi "Mes comportements", référence vivante --
// plus un texte tapé ici, voir MesCodes.tsx), un ou plusieurs dossiers de
// bibliothèque partagés (02/09/2026, remplace partage_bibliotheque tout
// ou rien -- copie automatique à chaque ajout, sous-dossiers inclus), un
// texte libre. Vivant : modifier le code (ou un comportement/dossier
// référencé) met à jour ce que voient tous ses receveurs, pas besoin
// d'un nouveau code.

export type ComportementLie = { id: string; nom: string };
export type DossierLie = { id: string; nom: string };

export type CodePartage = {
  id: string;
  code: string;
  nom: string | null;
  comportements: ComportementLie[];
  dossiers: DossierLie[];
  texte_libre: string | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
};

export type CodePartagePayload = {
  nom?: string | null;
  comportement_ids?: string[];
  dossier_ids?: string[];
  texte_libre?: string | null;
};

export async function listerMesCodes() {
  return appelerApi("/api/codes") as Promise<CodePartage[]>;
}

export async function creerCode(payload: CodePartagePayload) {
  return appelerApi("/api/codes", { method: "POST", body: JSON.stringify(payload) }) as Promise<CodePartage>;
}

export async function modifierCode(codeId: string, payload: CodePartagePayload) {
  return appelerApi(`/api/codes/${codeId}`, { method: "PATCH", body: JSON.stringify(payload) }) as Promise<CodePartage>;
}

export async function activerCode(codeId: string, actif: boolean) {
  return appelerApi(`/api/codes/${codeId}/actif`, { method: "POST", body: JSON.stringify({ actif }) }) as Promise<CodePartage>;
}

export async function supprimerCode(codeId: string) {
  return appelerApi(`/api/codes/${codeId}`, { method: "DELETE" });
}

export type RattachementCode = {
  rattachement_id: string;
  code_id: string;
  code: string;
  nom_code: string | null;
  proprietaire_id: string;
  proprietaire_nom: string;
  a_comportement: boolean;
  comportements: ComportementLie[];
  a_dossier: boolean;
  dossiers: DossierLie[];
  texte_libre: string | null;
};

/** Ce que J'AI reçu en entrant des codes d'autres utilisateurs. */
export async function listerMesRattachementsCodes() {
  return appelerApi("/api/rattachements-codes") as Promise<RattachementCode[]>;
}

/** Entre un code à 6 caractères -- reçoit tout ce que ce code porte. */
export async function entrerCodePartage(code: string) {
  return appelerApi("/api/rattachements-codes", {
    method: "POST",
    body: JSON.stringify({ code }),
  }) as Promise<{ id: string; code_id: string }>;
}

export async function retirerRattachementCode(rattachementId: string) {
  return appelerApi(`/api/rattachements-codes/${rattachementId}`, { method: "DELETE" });
}

export type ContenuMatiere = {
  id: string;
  matiere: string;
  system_prompt: string;
  code: string;
};

/** Les matières que J'AI écrites (mes codes à partager). */
export async function listerMesContenus() {
  return appelerApi("/api/agents/clovis/contenus-matiere") as Promise<ContenuMatiere[]>;
}

/** Crée ou met à jour (même matière = même ligne) le contenu d'une
 * matière. Le code ne change jamais après la première création. */
export async function ecrireContenuMatiere(matiere: string, systemPrompt: string) {
  return appelerApi("/api/agents/clovis/contenus-matiere", {
    method: "PUT",
    body: JSON.stringify({ matiere, system_prompt: systemPrompt }),
  }) as Promise<ContenuMatiere>;
}

export type Rattachement = {
  contenu_id: string;
  matiere: string;
  enseignant_nom: string;
  actif: boolean;
  surnom: string | null;
};

/** Les matières que J'AI débloquées en entrant un code, actives ou non. */
export async function listerMesRattachements() {
  return appelerApi("/api/agents/clovis/rattachements") as Promise<Rattachement[]>;
}

/** Entre un code à 6 caractères pour débloquer la matière correspondante. */
export async function entrerCode(code: string) {
  return appelerApi("/api/agents/clovis/rattachements", {
    method: "POST",
    body: JSON.stringify({ code }),
  }) as Promise<Rattachement>;
}

export async function renommerRattachement(contenuId: string, surnom: string) {
  return appelerApi(`/api/agents/clovis/rattachements/${contenuId}/surnom`, {
    method: "PATCH",
    body: JSON.stringify({ surnom }),
  });
}

/** Bascule quelle matière est active quand plusieurs rattachements se
 * chevauchent sur la même matière (ex: deux codes reçus pour "Maths"). */
export async function activerRattachement(contenuId: string) {
  return appelerApi(`/api/agents/clovis/rattachements/${contenuId}/activer`, { method: "PATCH" });
}

export type Receveur = {
  user_id: string;
  nom_affiche: string;
  surnom: string | null;
  actif: boolean;
};

/** Qui a entré MON code pour cette matière précise (contenu_id = un des
 * miens, voir listerMesContenus). */
export async function listerReceveurs(contenuId: string) {
  return appelerApi(`/api/agents/clovis/contenus-matiere/${contenuId}/receveurs`) as Promise<Receveur[]>;
}

/** Diffuse un fichier à tous ceux qui ont entré mon code pour ce
 * contenu_id -- ajouté à la bibliothèque personnelle de chacun, pas à
 * la base partagée de Clovis. */
export async function diffuserDocumentMatiere(
  contenuId: string,
  fichier: File,
  description: string,
  titre?: string
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Connecte-toi pour envoyer un fichier.");
  }

  const corps = new FormData();
  corps.append("fichier", fichier);
  if (titre?.trim()) corps.append("titre", titre.trim());
  corps.append("description", description);

  const chemin = `/api/agents/clovis/contenus-matiere/${contenuId}/diffuser`;
  const reponse = await fetch(`${API_URL}${chemin}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: corps,
  });

  if (!reponse.ok) {
    throw await construireErreurApi(reponse, chemin);
  }

  return reponse.json() as Promise<ResultatDiffusion>;
}

/** Pendant de diffuserDocumentMatiere pour un lien (pas de fichier, juste
 * une URL). */
export async function diffuserLienMatiere(contenuId: string, url: string, description: string, titre?: string) {
  return appelerApi(`/api/agents/clovis/contenus-matiere/${contenuId}/diffuser-lien`, {
    method: "POST",
    body: JSON.stringify({ url, titre, description }),
  }) as Promise<ResultatDiffusion>;
}

// ---------------------------------------------------------------------------
// Dossiers de la bibliothèque personnelle (22/08, demande Bourama), voir
// api/dossiers_bibliotheque.py côté backend. Un fichier peut être rangé dans
// plusieurs dossiers à la fois (fichier_ids ci-dessous est un tableau).

export type DossierBibliotheque = {
  id: string;
  nom: string;
  dossier_parent_id: string | null;
  created_at: string;
  fichier_ids: string[];
};

export async function listerDossiersBibliotheque() {
  const resultat = await appelerApi("/api/bibliotheque/dossiers");
  return resultat as DossierBibliotheque[];
}

export async function creerDossierBibliotheque(nom: string, dossierParentId?: string) {
  return appelerApi("/api/bibliotheque/dossiers", {
    method: "POST",
    body: JSON.stringify({ nom, dossier_parent_id: dossierParentId ?? null }),
  });
}

export async function renommerDossierBibliotheque(dossierId: string, nom: string) {
  return appelerApi(`/api/bibliotheque/dossiers/${dossierId}`, {
    method: "PATCH",
    body: JSON.stringify({ nom }),
  });
}

export async function supprimerDossierBibliotheque(dossierId: string) {
  return appelerApi(`/api/bibliotheque/dossiers/${dossierId}`, { method: "DELETE" });
}

export async function rangerFichierDansDossier(dossierId: string, fichierId: string) {
  return appelerApi(`/api/bibliotheque/dossiers/${dossierId}/fichiers`, {
    method: "POST",
    body: JSON.stringify({ fichier_id: fichierId }),
  });
}

export async function retirerFichierDuDossier(dossierId: string, fichierId: string) {
  return appelerApi(`/api/bibliotheque/dossiers/${dossierId}/fichiers/${fichierId}`, { method: "DELETE" });
}

// Signalements (bibliothèque publique) et contenu légal (CGU /
// copyright), 22/08, chantier "rendre la bibliothèque plus sérieuse"
// (guide Notion "Guide pour droit d'auteur").

export type TypeSignalement = "bibliotheque_publique";

export type Signalement = {
  id: string;
  type_signalement: TypeSignalement;
  bibliotheque_publique_id: string | null;
  lien_document: string;
  motif: string;
  plaignant_nom: string;
  plaignant_email: string;
  plaignant_organisation: string | null;
  declaration_honneur: boolean;
  statut: "en_attente" | "traite";
  action: "retire" | "rejete" | null;
  notes_admin: string | null;
  created_at: string;
  traite_le: string | null;
};

export type NouveauSignalement = {
  type_signalement: TypeSignalement;
  bibliotheque_publique_id?: string;
  lien_document: string;
  motif: string;
  plaignant_nom: string;
  plaignant_email: string;
  plaignant_organisation?: string;
  declaration_honneur: boolean;
};

export async function creerSignalement(payload: NouveauSignalement) {
  const resultat = await appelerApi("/api/signalements", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return resultat as Signalement;
}

export async function listerSignalements(statut?: "en_attente" | "traite") {
  const suffixe = statut ? `?statut=${statut}` : "";
  const resultat = await appelerApi(`/api/signalements${suffixe}`);
  return resultat as Signalement[];
}

export async function traiterSignalement(id: string, action: "retire" | "rejete", notesAdmin?: string) {
  const resultat = await appelerApi(`/api/signalements/${id}/traiter`, {
    method: "POST",
    body: JSON.stringify({ action, notes_admin: notesAdmin }),
  });
  return resultat as Signalement;
}

export type ContenuLegal = { cle: string; titre: string; contenu_markdown: string; updated_at: string };

export async function lireContenuLegal(cle: "cgu" | "copyright" | "confidentialite") {
  const resultat = await appelerApi(`/api/legal/${cle}`);
  return resultat as ContenuLegal;
}

// 26/08/2026, Bourama : Partie 3 mobile, temps d'écran -- contrat déjà en
// place côté backend (api/appareils_mobiles.py, core/usage_appareil_mobile.py).
// Le plugin natif TempsEcranPlugin.kt ne renvoie que les chiffres bruts, ces
// deux fonctions font le pont avec le backend (aucun client HTTP dupliqué
// côté Kotlin, voir le commentaire d'en-tête de TempsEcranPlugin.kt).
export type LigneUsage = { plateforme: string; nom_app: string; date: string; duree_secondes: number };

export async function synchroniserUsage(plateforme: "android" | "ios", entrees: { nom_app: string; date: string; duree_secondes: number }[]) {
  await appelerApi("/api/appareils-mobiles/usage", {
    method: "POST",
    body: JSON.stringify({ plateforme, entrees }),
  });
}

export async function obtenirUsage(jours = 7) {
  return (await appelerApi(`/api/appareils-mobiles/usage?jours=${jours}`)) as { usage: LigneUsage[] };
}

// 02/09/2026, Bourama : centre de notifications (bouton cloche, header,
// web + mobile). Voir api/notifications.py côté backend -- ne couvre
// que les 4 nouveaux types Clovis (rappel_echu, action_ia_terminee,
// document_recu_code, message_systeme), pas les anciens types de la
// table (follow/comment/rating/...), laissés de côté pour l'instant.
export type NotificationClovis = {
  id: number;
  type: "rappel_echu" | "action_ia_terminee" | "document_recu_code" | "message_systeme";
  titre: string;
  contenu: string | null;
  lien: string | null;
  lu: boolean;
  created_at: string;
};

export async function listerMesNotifications() {
  const resultat = await appelerApi("/api/notifications");
  return resultat as NotificationClovis[];
}

export async function marquerNotificationLue(id: number) {
  await appelerApi(`/api/notifications/${id}/lu`, { method: "POST" });
}

export async function marquerToutesNotificationsLues() {
  await appelerApi("/api/notifications/tout-lu", { method: "POST" });
}
