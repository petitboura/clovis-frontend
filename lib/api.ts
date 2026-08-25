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
  corps.append("fichier", fichier);
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
};

export async function listerBibliothequePublique(q?: string) {
  const suffixe = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  const resultat = await appelerApi(`/api/bibliotheque-publique${suffixe}`);
  return resultat as EntreeBibliothequePublique[];
}

export async function ajouterABibliothequePublique(fichier: File, nom: string, description?: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Connecte-toi pour envoyer un fichier.");
  }

  const corps = new FormData();
  corps.append("fichier", fichier);
  corps.append("nom", nom.trim());
  corps.append("description", description || "");

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

export async function supprimerDeBibliothequePublique(entreeId: string) {
  return appelerApi(`/api/bibliotheque-publique/${entreeId}`, { method: "DELETE" });
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
  depuis_audit: boolean;
  depuis_public: boolean;
  matiere_id: string | null;
  matiere_nom: string | null;
};

export async function lireMesComportements(agentId: string) {
  const resultat = await appelerApi(`/api/agents/${agentId}/mes-comportements`);
  return resultat as Comportement[];
}

// 20/08/2026, demande Bourama : comportements déjà attachés à un
// emplacement précis du programme (chapitre, matière, examen, section…)
// -- pour les afficher directement sur l'écran correspondant.
export async function comportementsParLien(agentId: string, lienType: string, lienId: string) {
  const resultat = await appelerApi(`/api/agents/${agentId}/mes-comportements/par-lien/${lienType}/${lienId}`);
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

// --- Codes de partage (14/08/2026, remplace le système matière ci-dessus,
// qui n'était de toute façon jamais lu par le chat -- voir
// core/codes_partage.py côté backend) --------------------------------------
//
// Un code peut porter, chacun optionnel et combinable : des comportements
// (18/08/2026 : sélection parmi "Mes comportements", référence vivante --
// plus un texte tapé ici, voir MesCodes.tsx), un programme (référence
// vers un des miens), un partage de bibliothèque (copie automatique à
// chaque ajout), un texte libre. Vivant : modifier le code (ou un
// comportement référencé) met à jour ce que voient tous ses receveurs,
// pas besoin d'un nouveau code.

export type ComportementLie = { id: string; nom: string };

export type CodePartage = {
  id: string;
  code: string;
  nom: string | null;
  comportements: ComportementLie[];
  programme_id: string | null;
  partage_bibliotheque: boolean;
  texte_libre: string | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
};

export type CodePartagePayload = {
  nom?: string | null;
  comportement_ids?: string[];
  programme_id?: string | null;
  partage_bibliotheque?: boolean;
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
  a_programme: boolean;
  programme_id: string | null;
  programme_nom: string | null;
  partage_bibliotheque: boolean;
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

/**
 * Onglet "Mon programme" (lot 4/5, chantier programme étudiant) --
 * navigation classe/niveau -> matière -> chapitre. Voir
 * components/EspaceProgramme.tsx. Contrat backend construit en parallèle
 * par le lot 1 (peut ne pas encore être mergé au moment où ce fichier est
 * écrit) -- pas de agentId ici, ces routes sont personnelles à
 * l'utilisateur connecté, pas rattachées à un agent précis.
 */

export type Programme = {
  id: string;
  niveau: string;
  nom: string | null;
  created_at: string;
  updated_at: string;
};

export type MatiereDuProgramme = {
  id: string;
  nom: string;
  limites: string | null;
  created_at: string;
  updated_at: string;
};

export type ChapitreDeLaMatiere = {
  id: string;
  nom: string;
  ordre: number;
  limites: string | null;
  created_at: string;
  updated_at: string;
};

export async function listerProgrammes() {
  return appelerApi("/api/programmes") as Promise<Programme[]>;
}

export async function creerProgramme(niveau: string, nom?: string) {
  return appelerApi("/api/programmes", {
    method: "POST",
    body: JSON.stringify({ niveau, nom }),
  }) as Promise<Programme>;
}

export async function modifierProgramme(id: string, donnees: { niveau?: string; nom?: string }) {
  return appelerApi(`/api/programmes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(donnees),
  }) as Promise<Programme>;
}

export async function supprimerProgramme(id: string) {
  return appelerApi(`/api/programmes/${id}`, { method: "DELETE" });
}

export async function listerMatieresProgramme(programmeId: string) {
  return appelerApi(`/api/programmes/${programmeId}/matieres`) as Promise<MatiereDuProgramme[]>;
}

export async function creerMatiereProgramme(programmeId: string, nom: string, limites?: string) {
  return appelerApi(`/api/programmes/${programmeId}/matieres`, {
    method: "POST",
    body: JSON.stringify({ nom, limites }),
  }) as Promise<MatiereDuProgramme>;
}

export async function modifierMatiereProgramme(id: string, donnees: { nom?: string; limites?: string }) {
  return appelerApi(`/api/matieres/${id}`, {
    method: "PATCH",
    body: JSON.stringify(donnees),
  }) as Promise<MatiereDuProgramme>;
}

export async function supprimerMatiereProgramme(id: string) {
  return appelerApi(`/api/matieres/${id}`, { method: "DELETE" });
}

export async function listerChapitresMatiere(matiereId: string) {
  return appelerApi(`/api/matieres/${matiereId}/chapitres`) as Promise<ChapitreDeLaMatiere[]>;
}

export async function creerChapitreMatiere(matiereId: string, nom: string, ordre?: number, limites?: string) {
  return appelerApi(`/api/matieres/${matiereId}/chapitres`, {
    method: "POST",
    body: JSON.stringify({ nom, ordre, limites }),
  }) as Promise<ChapitreDeLaMatiere>;
}

export async function modifierChapitreMatiere(
  id: string,
  donnees: { nom?: string; ordre?: number; limites?: string }
) {
  return appelerApi(`/api/chapitres/${id}`, {
    method: "PATCH",
    body: JSON.stringify(donnees),
  }) as Promise<ChapitreDeLaMatiere>;
}

export async function supprimerChapitreMatiere(id: string) {
  return appelerApi(`/api/chapitres/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Audits IA hebdomadaires par matière (2026-08-12, chantier "connexion IA
// <-> structure programme"). Lecture seule : l'audit est écrit uniquement
// par la boucle planificatrice du lundi côté backend (core/audit_programme.py),
// jamais modifiable directement -- ce serait de toute façon écrasé au lundi
// suivant.

export type AuditMatiere = {
  matiere_id: string;
  matiere_nom: string;
  texte: string | null;
  derniere_execution: string | null;
};

export async function listerAuditsProgramme(programmeId: string) {
  return appelerApi(`/api/programmes/${programmeId}/audits`) as Promise<AuditMatiere[]>;
}

// 26/08/2026, chantier "Audits" complet (récap Bourama) : la cascade
// couvre désormais aussi le chapitre (le plus détaillé) et le programme
// entier (le plus large), en plus de la matière déjà existante.

export type AuditChapitre = {
  chapitre_id: string;
  chapitre_nom: string;
  matiere_id: string;
  texte: string | null;
  derniere_execution: string | null;
};

export type AuditProgrammeGlobal = {
  texte: string | null;
  derniere_execution: string | null;
};

export async function listerAuditsChapitres(programmeId: string) {
  return appelerApi(`/api/programmes/${programmeId}/audits/chapitres`) as Promise<AuditChapitre[]>;
}

export async function lireAuditProgrammeGlobal(programmeId: string) {
  return appelerApi(`/api/programmes/${programmeId}/audits/programme`) as Promise<AuditProgrammeGlobal>;
}

// Déclenchement manuel de la cascade pour CE programme -- pensé pour
// tester sans attendre le lundi suivant (voir core/audit_programme.py).
export async function executerAuditsProgramme(programmeId: string) {
  return appelerApi(`/api/programmes/${programmeId}/audits/executer`, { method: "POST" }) as Promise<{
    statut: string;
  }>;
}

// ---------------------------------------------------------------------------
// Programme étudiant (classe -> matière -> chapitre), lot 5 -- documents et
// exercices d'un chapitre, examens/devoirs multi-chapitres d'un programme,
// classements transversaux, et système de plugins. Contrat backend construit
// en parallèle par les lots 2/3 (voir chantier-programme-etudiant.md) --
// endpoints ci-dessous suivent ce contrat tel quel.

// ---------------------------------------------------------------------------
// Documents de la bibliothèque classés à un emplacement du programme
// (programme/matière/chapitre/exercice/examen), 17/08 -- voir
// api/emplacements_bibliotheque_programme.py côté backend (nouvelle
// couche REST par-dessus core/bibliotheque_programme.py, jusqu'ici
// réservé aux outils MCP). Distinct de DocumentChapitre plus bas
// (ancien système titre+lien, laissé tel quel -- Bourama : "bibliothèque
// et classement est un plus", pas un remplacement).

export type TypeEmplacementProgramme = "programme" | "matiere" | "chapitre" | "exercice" | "examen";

export type FichierEmplacementProgramme = {
  id: string;
  nom_fichier: string;
  type_mime: string;
  description: string | null;
  url_publique: string;
  created_at: string;
  // 22/08, chantier signalements : voir api/emplacements_bibliotheque_programme.py.
  ajoute_par: string | null;
  emplacement_public: boolean;
};

export async function listerDocumentsEmplacement(type: TypeEmplacementProgramme, cibleId: string) {
  const resultat = await appelerApi(`/api/emplacements/${type}/${cibleId}/documents`);
  return resultat as FichierEmplacementProgramme[];
}

export async function classerDocumentEmplacement(type: TypeEmplacementProgramme, cibleId: string, fichierId: string) {
  return appelerApi(`/api/emplacements/${type}/${cibleId}/documents`, {
    method: "POST",
    body: JSON.stringify({ fichier_id: fichierId }),
  });
}

export async function declasserDocumentEmplacement(type: TypeEmplacementProgramme, cibleId: string, fichierId: string) {
  return appelerApi(`/api/emplacements/${type}/${cibleId}/documents/${fichierId}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Dossiers de la bibliothèque personnelle (22/08, demande Bourama), voir
// api/dossiers_bibliotheque.py côté backend. Un fichier peut être rangé dans
// plusieurs dossiers à la fois (fichier_ids ci-dessous est un tableau).
// Distinct du classement ci-dessus (emplacements du Programme) : deux
// systèmes séparés, celui-ci concerne l'organisation interne de la
// bibliothèque elle-même.

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

// Signalements (bibliothèque publique + documents publics de programme)
// et contenu légal (CGU / copyright), 22/08, chantier "rendre la
// bibliothèque plus sérieuse" (guide Notion "Guide pour droit d'auteur").

export type TypeSignalement = "bibliotheque_publique" | "document_programme";

export type Signalement = {
  id: string;
  type_signalement: TypeSignalement;
  bibliotheque_publique_id: string | null;
  fichier_id: string | null;
  type_emplacement: string | null;
  emplacement_id: string | null;
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
  fichier_id?: string;
  type_emplacement?: string;
  emplacement_id?: string;
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

export async function lireContenuLegal(cle: "cgu" | "copyright") {
  const resultat = await appelerApi(`/api/legal/${cle}`);
  return resultat as ContenuLegal;
}

export type DocumentChapitre = { id: string; titre: string; url_ou_contenu: string; created_at: string };

export async function lireDocumentsChapitre(chapitreId: string) {
  const resultat = await appelerApi(`/api/chapitres/${chapitreId}/documents`);
  return resultat as DocumentChapitre[];
}

export async function ajouterDocumentChapitre(chapitreId: string, titre: string, urlOuContenu: string) {
  const resultat = await appelerApi(`/api/chapitres/${chapitreId}/documents`, {
    method: "POST",
    body: JSON.stringify({ titre, url_ou_contenu: urlOuContenu }),
  });
  return resultat as DocumentChapitre;
}

export async function supprimerDocumentChapitre(documentId: string) {
  return appelerApi(`/api/documents/${documentId}`, { method: "DELETE" });
}

export type ExerciceChapitre = { id: string; enonce: string; created_at: string; updated_at: string };

export async function lireExercicesChapitre(chapitreId: string) {
  const resultat = await appelerApi(`/api/chapitres/${chapitreId}/exercices`);
  return resultat as ExerciceChapitre[];
}

export async function ajouterExerciceChapitre(chapitreId: string, enonce: string) {
  const resultat = await appelerApi(`/api/chapitres/${chapitreId}/exercices`, {
    method: "POST",
    body: JSON.stringify({ enonce }),
  });
  return resultat as ExerciceChapitre;
}

export async function modifierExerciceChapitre(exerciceId: string, enonce: string) {
  const resultat = await appelerApi(`/api/exercices/${exerciceId}`, {
    method: "PATCH",
    body: JSON.stringify({ enonce }),
  });
  return resultat as ExerciceChapitre;
}

export async function supprimerExerciceChapitre(exerciceId: string) {
  return appelerApi(`/api/exercices/${exerciceId}`, { method: "DELETE" });
}

export type TypeExamen = "examen" | "devoir" | "probleme_composite";

export type Examen = {
  id: string;
  titre: string;
  type: TypeExamen;
  chapitre_ids: string[];
  created_at: string;
};

export async function lireExamensProgramme(programmeId: string) {
  const resultat = await appelerApi(`/api/programmes/${programmeId}/examens`);
  return resultat as Examen[];
}

export async function creerExamen(titre: string, type: TypeExamen, chapitreIds: string[]) {
  const resultat = await appelerApi(`/api/examens`, {
    method: "POST",
    body: JSON.stringify({ titre, type, chapitre_ids: chapitreIds }),
  });
  return resultat as Examen;
}

export async function modifierExamen(
  examenId: string,
  patch: { titre?: string; type?: TypeExamen; chapitre_ids?: string[] }
) {
  const resultat = await appelerApi(`/api/examens/${examenId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return resultat as Examen;
}

export async function supprimerExamen(examenId: string) {
  return appelerApi(`/api/examens/${examenId}`, { method: "DELETE" });
}

export type TypeClassement = "semestre" | "annee" | "section";
export type CibleClassement = "matiere" | "chapitre" | "document" | "exercice" | "examen";

export type Classement = { id: string; type: TypeClassement; label: string; created_at: string };

export type ItemClassement = { id: string; cible_type: CibleClassement; cible_id: string; libelle: string | null };

export async function lireClassements() {
  const resultat = await appelerApi(`/api/classements`);
  return resultat as Classement[];
}

// 20/08/2026 : jusqu'ici on pouvait seulement AJOUTER un élément à un
// classement (AjouterAClassementBouton) -- rien pour consulter son
// contenu. Voir VueClassementContenu dans EspaceProgramme.tsx.
export async function listerItemsClassement(classementId: string) {
  const resultat = await appelerApi(`/api/classements/${classementId}/items`);
  return resultat as ItemClassement[];
}

export async function creerClassement(type: TypeClassement, label: string) {
  const resultat = await appelerApi(`/api/classements`, {
    method: "POST",
    body: JSON.stringify({ type, label }),
  });
  return resultat as Classement;
}

export async function ajouterItemClassement(classementId: string, cibleType: CibleClassement, cibleId: string) {
  return appelerApi(`/api/classements/${classementId}/items`, {
    method: "POST",
    body: JSON.stringify({ cible_type: cibleType, cible_id: cibleId }),
  });
}

export async function supprimerItemClassement(classementId: string, itemId: string) {
  return appelerApi(`/api/classements/${classementId}/items/${itemId}`, { method: "DELETE" });
}

export async function supprimerClassement(classementId: string) {
  return appelerApi(`/api/classements/${classementId}`, { method: "DELETE" });
}

export type Plugin = {
  id: string;
  programme_source_id: string;
  nom: string;
  niveau: string;
  auteur_id: string;
  gratuit: boolean;
  contribution_libre: boolean;
  telechargements_count: number;
};

export type ExamenTransverse = {
  id: string;
  titre: string;
  type: string;
};

export async function examensTransversesProgramme(programmeId: string) {
  const resultat = await appelerApi(`/api/programmes/${programmeId}/examens-transverses`);
  return resultat as ExamenTransverse[];
}

export async function publierProgrammeCommePlugin(
  programmeId: string,
  nom: string,
  examensTransversesInclus: string[] = []
) {
  const resultat = await appelerApi(`/api/programmes/${programmeId}/publier-plugin`, {
    method: "POST",
    body: JSON.stringify({ nom, examens_transverses_inclus: examensTransversesInclus }),
  });
  return resultat as Plugin;
}

export async function listerPlugins(motCle?: string) {
  const suffixe = motCle && motCle.trim() ? `?q=${encodeURIComponent(motCle.trim())}` : "";
  const resultat = await appelerApi(`/api/plugins${suffixe}`);
  return resultat as Plugin[];
}

export async function telechargerPlugin(pluginId: string) {
  const resultat = await appelerApi(`/api/plugins/${pluginId}/telecharger`, { method: "POST" });
  return resultat as { programme_id: string };
}

export type ChapitreApercuPlugin = {
  id: string;
  nom: string;
  documents_count: number;
  exercices_count: number;
};

export type MatiereApercuPlugin = {
  id: string;
  nom: string;
  chapitres: ChapitreApercuPlugin[];
};

export type ApercuPlugin = {
  id: string;
  nom: string;
  niveau: string;
  auteur_nom: string | null;
  matieres: MatiereApercuPlugin[];
};

export async function apercuPlugin(pluginId: string) {
  const resultat = await appelerApi(`/api/plugins/${pluginId}/apercu`);
  return resultat as ApercuPlugin;
}

// ---------------------------------------------------------------------
// Section "Notion-like" (Partie 2, lot 5/5), 2026-08-20, demande Bourama.
// Voir api/pages_notion.py, api/bases_donnees.py, api/revision.py côté
// backend (lots 1 à 4). Noms volontairement différents de
// pagesNotion/creerPageNotion ci-dessus, qui sont pour le connecteur
// Notion externe (compte Notion réel de l'utilisateur) -- sans rapport.
// ---------------------------------------------------------------------

export type PageEspace = {
  id: string;
  proprietaire_id: string;
  parent_id: string | null;
  titre: string;
  ordre: number;
  est_carrefour: boolean;
  icone: string | null;
  created_at: string;
  updated_at: string;
};

export type BlocEspace = {
  id: string;
  page_id: string;
  type: string;
  contenu: Record<string, unknown>;
  ordre: number;
  parent_bloc_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ReferenceCarrefour = { id: string; type_cible: string; cible_id: string; label: string };

export type PageDetail = PageEspace & { sous_pages: PageEspace[]; blocs: BlocEspace[] };

export async function listerPagesRacines() {
  return (await appelerApi("/api/pages")) as PageEspace[];
}

// Recherche de pages par titre -- sert à la fois la recherche globale
// (Cmd/Ctrl+K) et l'autocomplete de lien [[ ]] / @ dans l'éditeur.
export async function rechercherPages(q: string) {
  if (!q.trim()) return [] as PageEspace[];
  return (await appelerApi(`/api/pages/recherche/tout?q=${encodeURIComponent(q.trim())}`)) as PageEspace[];
}

export async function creerPage(titre: string, parentId?: string | null) {
  return (await appelerApi("/api/pages", {
    method: "POST",
    body: JSON.stringify({ titre, parent_id: parentId ?? null }),
  })) as PageEspace;
}

export async function obtenirPage(pageId: string) {
  return (await appelerApi(`/api/pages/${pageId}`)) as PageDetail;
}

// Liste légère des sous-pages d'une page (sans les blocs), pour construire
// l'arbre de la sidebar façon Notion sans recharger la page entière à
// chaque dépliage d'un nœud.
export async function listerSousPages(pageId: string) {
  return (await appelerApi(`/api/pages/${pageId}/sous-pages`)) as PageEspace[];
}

export async function modifierPage(pageId: string, patch: string | { titre?: string; ordre?: number; icone?: string | null }) {
  const corps = typeof patch === "string" ? { titre: patch } : patch;
  return (await appelerApi(`/api/pages/${pageId}`, { method: "PATCH", body: JSON.stringify(corps) })) as PageEspace;
}

export async function supprimerPage(pageId: string) {
  await appelerApi(`/api/pages/${pageId}`, { method: "DELETE" });
}

export async function listerCarrefour(pageId: string) {
  return (await appelerApi(`/api/pages/${pageId}/carrefour`)) as ReferenceCarrefour[];
}

export async function ajouterCarrefour(pageId: string, typeCible: string, cibleId: string) {
  return (await appelerApi(`/api/pages/${pageId}/carrefour`, {
    method: "POST",
    body: JSON.stringify({ type_cible: typeCible, cible_id: cibleId }),
  })) as ReferenceCarrefour;
}

export async function supprimerCarrefour(pageId: string, referenceId: string) {
  await appelerApi(`/api/pages/${pageId}/carrefour/${referenceId}`, { method: "DELETE" });
}

export async function creerBloc(pageId: string, type: string, contenu: Record<string, unknown>, ordre = 0, parentBlocId: string | null = null) {
  return (await appelerApi("/api/blocs", {
    method: "POST",
    body: JSON.stringify({ page_id: pageId, type, contenu, ordre, parent_bloc_id: parentBlocId }),
  })) as BlocEspace;
}

// Upload direct (image ou fichier générique) + création du bloc en un
// seul appel -- voir POST /api/blocs/upload côté backend, réutilise
// core/bibliotheque_fichiers.py (même mécanisme que le chat).
export async function uploaderBlocFichier(
  pageId: string,
  typeBloc: "image" | "fichier",
  fichier: File,
  ordre = 0,
  parentBlocId: string | null = null
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Connecte-toi pour envoyer un fichier.");
  }
  const corps = new FormData();
  corps.append("fichier", fichier);
  corps.append("page_id", pageId);
  corps.append("type_bloc", typeBloc);
  corps.append("ordre", String(ordre));
  if (parentBlocId) corps.append("parent_bloc_id", parentBlocId);

  const reponse = await fetch(`${API_URL}/api/blocs/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: corps,
  });
  if (!reponse.ok) {
    throw await construireErreurApi(reponse, "/api/blocs/upload");
  }
  return (await reponse.json()) as BlocEspace;
}

export async function modifierBloc(
  blocId: string,
  patch: Partial<Pick<BlocEspace, "type" | "contenu" | "ordre">> & { parent_bloc_id?: string | null }
) {
  const corps: Record<string, unknown> = { ...patch };
  if ("parent_bloc_id" in patch) corps.parent_bloc_id_defini = true;
  return (await appelerApi(`/api/blocs/${blocId}`, { method: "PATCH", body: JSON.stringify(corps) })) as BlocEspace;
}

export async function supprimerBloc(blocId: string) {
  await appelerApi(`/api/blocs/${blocId}`, { method: "DELETE" });
}

export type ProprieteBase = {
  id: string;
  base_id: string;
  nom: string;
  type: string;
  options: string[];
  config: Record<string, unknown>;
  ordre: number;
};
export type ElementBase = { id: string; base_id: string; parent_element_id: string | null; ordre: number };
export type ValeurBase = { id: string; element_id: string; propriete_id: string; valeur: unknown };
export type BaseDonneesDetail = {
  id: string;
  page_id: string;
  titre: string;
  vue_par_defaut: string;
  proprietes: ProprieteBase[];
  elements: ElementBase[];
  valeurs: ValeurBase[];
};

export async function creerBaseDonnees(pageId: string, titre: string) {
  return (await appelerApi("/api/bases-donnees", {
    method: "POST",
    body: JSON.stringify({ page_id: pageId, titre }),
  })) as { id: string; page_id: string; titre: string; vue_par_defaut: string };
}

export async function obtenirBaseDonnees(baseId: string) {
  return (await appelerApi(`/api/bases-donnees/${baseId}`)) as BaseDonneesDetail;
}

export async function creerProprieteBase(
  baseId: string,
  nom: string,
  type: string,
  options: string[] = [],
  config: Record<string, unknown> = {}
) {
  return (await appelerApi(`/api/bases-donnees/${baseId}/proprietes`, {
    method: "POST",
    body: JSON.stringify({ nom, type, options, config }),
  })) as ProprieteBase;
}

export async function creerElementBase(baseId: string, valeurs: Record<string, unknown>, parentElementId?: string | null) {
  return (await appelerApi(`/api/bases-donnees/${baseId}/elements`, {
    method: "POST",
    body: JSON.stringify({ valeurs, parent_element_id: parentElementId ?? null }),
  })) as ElementBase;
}

export async function modifierElementBase(elementId: string, valeurs: Record<string, unknown>) {
  await appelerApi(`/api/bases-donnees/elements/${elementId}`, { method: "PATCH", body: JSON.stringify({ valeurs }) });
}

export async function supprimerElementBase(elementId: string) {
  await appelerApi(`/api/bases-donnees/elements/${elementId}`, { method: "DELETE" });
}

export type ElementARevisor = { element_id: string; base_id: string; prochaine_revision: string };

export async function listerRevisionsDues(baseId?: string) {
  const q = baseId ? `?base_id=${encodeURIComponent(baseId)}` : "";
  return (await appelerApi(`/api/revision/a-reviser${q}`)) as ElementARevisor[];
}

export async function repondreRevision(elementId: string, qualite: "echec" | "difficile" | "correct" | "facile") {
  return (await appelerApi(`/api/revision/${elementId}/reponse`, {
    method: "POST",
    body: JSON.stringify({ qualite }),
  })) as { prochaine_revision: string };
}
