/**
 * Traduction des erreurs API par code stable (voir
 * djiguigne-backend/core/erreurs.py:MESSAGES_FR pour la source de vérité
 * côté backend -- les codes doivent rester synchronisés des deux côtés).
 *
 * Une seule locale est active pour l'instant (fr), mais la structure est
 * prête pour en ajouter d'autres : il suffit de renseigner LOCALE_ACTIVE
 * et/ou d'ajouter une clé dans MESSAGES ci-dessous.
 */
export type Locale = "fr" | "en";

export const LOCALE_ACTIVE: Locale = "fr";

export const MESSAGES: Record<Locale, Record<string, string>> = {
  fr: {
    PRECISE_MATIERE_AUTRE: "Précise la matière dans \"Autre\".",
    PRECISE_LA_VALEUR_POUR: "Précise la valeur pour {libelle}.",
    EST_DEJA_PRISE_PAR_UNE: "{libelle} est déjà prise.",
    AUCUNE_FORMULE_DETECTEE_DANS_CETTE_IMAGE: "Aucune formule détectée dans cette image.",
    AUCUN_TEXTE_TROUVE_DOCUMENT_SCANNE_IMAGE: "Aucun texte trouvé (document scanné/image sans OCR ?).",
    AUDIO_TROP_LONG_20_MO_MAX: "Audio trop long (20 Mo max).",
    CATEGORIE_INCONNUE: "Catégorie inconnue.",
    CIBLE_DU_SIGNALEMENT_MANQUANTE: "Précise le document ou l'emplacement concerné.",
    CONTENU_LEGAL_INTROUVABLE: "Contenu légal introuvable.",
    TYPE_DE_SIGNALEMENT_INVALIDE: "Type de signalement invalide.",
    MOTIF_REQUIS: "Précise le motif du signalement.",
    COORDONNEES_PLAIGNANT_REQUISES: "Ton nom et ton email sont requis.",
    DECLARATION_SUR_L_HONNEUR_REQUISE: "La déclaration sur l'honneur est requise.",
    PAS_LE_DROIT_ADMIN: "Réservé aux administrateurs.",
    ACTION_INVALIDE: "Action invalide.",
    SIGNALEMENT_INTROUVABLE: "Signalement introuvable.",
    SIGNALEMENT_DEJA_TRAITE: "Ce signalement a déjà été traité.",
    CETTE_MATIERE_EST_DEJA_PRISE_PAR: "Cette matière est déjà prise.",
    CE_DOCUMENT_N_APPARTIENT_PAS_A: "Ce document n'est pas accessible ici.",
    CONNEXION_INDISPONIBLE: "Connexion à {service} indisponible pour le moment.",
    DOCUMENT_TROP_LOURD_15_MO_MAX: "Document trop lourd (15 Mo max).",
    ECHEC_DE_LA_GENERATION_AUDIO_REESSAIE: "Échec de la génération audio, réessaie.",
    ECHEC_DE_LA_GENERATION_DU_DOCUMENT: "Échec de la génération du document, réessaie.",
    ECHEC_DE_LA_LECTURE_DU_DOCUMENT: "Échec de la lecture du document.",
    ECHEC_DE_LA_TRANSCRIPTION_REESSAIE: "Échec de la transcription, réessaie.",
    ECHEC_DE_L_ENREGISTREMENT_DE_L: "Échec de l'enregistrement de l'abonnement.",
    ECHEC_DE_L_EXPORT_REESSAIE: "Échec de l'export, réessaie.",
    ECHEC_DE_L_EXTRACTION_REESSAIE: "Échec de l'extraction, réessaie.",
    ECHEC_DE_L_UPLOAD_REESSAIE: "Échec de l'upload, réessaie.",
    ECHEC_DU_DESABONNEMENT: "Échec du désabonnement.",
    ERREUR_INCONNUE: "Une erreur est survenue, réessaie dans un instant.",
    NOM_DEJA_UTILISE_BIBLIOTHEQUE_PERSO: "Tu as déjà un fichier nommé « {nom} » dans ta bibliothèque. Renomme-le ou remplace l'existant.",
    NOM_DEJA_UTILISE_BIBLIOTHEQUE_PUBLIQUE: "Un document nommé « {nom} » existe déjà dans la bibliothèque publique. Choisis un autre nom.",
    MATIERE_ET_SYSTEM_PROMPT_REQUIS: "La matière et le contenu sont obligatoires.",
    CONTENU_MATIERE_INTROUVABLE: "Contenu introuvable.",
    CODE_INVALIDE: "Ce code ne correspond à aucun contenu.",
    DEJA_RATTACHE_A_CE_CONTENU: "Tu as déjà débloqué ce contenu.",
    RATTACHEMENT_INTROUVABLE: "Rattachement introuvable.",
    COMPORTEMENT_INTROUVABLE: "Skill introuvable.",
    FRONTMATTER_INVALIDE: "Le skill doit commencer par --- et contenir un bloc d'en-tête valide.",
    FRONTMATTER_INCOMPLET: "Le skill doit avoir une description et un corps de texte, tous les deux non vides.",
    TEXTE_REQUIS: "Le texte ne peut pas être vide.",
    FICHIER_AUDIO_VIDE: "Fichier audio vide.",
    FICHIER_TROP_LOURD_50_MO_MAX: "Fichier trop lourd (50 Mo max).",
    FICHIER_VECTORISATION_ECHEC: "« {nom} » n'a pas pu être vectorisé.",
    FICHIER_INTROUVABLE: "Fichier introuvable.",
    CE_FICHIER_NE_T_APPARTIENT_PAS: "Ce fichier ne t'appartient pas.",
    FICHIER_PAS_EN_ECHEC: "Ce fichier n'est pas en échec, rien à réessayer.",
    ENTREE_INTROUVABLE: "Entrée introuvable.",
    CETTE_ENTREE_NE_T_APPARTIENT_PAS: "Cette entrée ne t'appartient pas.",
    ENTREE_PAS_EN_ECHEC: "Cette entrée n'est pas en échec, rien à réessayer.",
    FICHIER_VECTORISE_MAIS_ECHEC_DU_STOCKAGE: "Fichier vectorisé mais échec du stockage en bibliothèque.",
    FICHIER_VIDE: "Fichier vide.",
    FORMAT_NON_SUPPORTE_JPEG_PNG_OU: "Format non supporté (jpeg, png ou webp uniquement).",
    FORMAT_NON_SUPPORTE_MP4_WEBM_OU: "Format non supporté (mp4, webm ou mov uniquement).",
    FORMAT_NON_SUPPORTE_PDF_WORD_DOCX: "Format non supporté (PDF, Word .docx ou Excel .xlsx uniquement).",
    GENERATION_AUDIO_INDISPONIBLE: "La génération audio n'est pas encore disponible.",
    GITHUB_DEPOTS_INDISPONIBLE: "Impossible de récupérer la liste des dépôts.",
    GITHUB_NON_CONNECTE: "Compte GitHub non connecté.",
    IMAGE_TROP_LOURDE_5_MO_MAX: "Image trop lourde (5 Mo max).",
    IMPOSSIBLE_DE_CHARGER_CETTE_CONVERSATION: "Impossible de charger cette conversation.",
    IMPOSSIBLE_DE_CHARGER_CET_AGENT_POUR: "Impossible de charger cette conversation pour le moment.",
    IMPOSSIBLE_DE_CHARGER_CE_PROFIL_POUR: "Impossible de charger ce profil pour le moment.",
    IMPOSSIBLE_DE_CHARGER_LA_MEMOIRE_POUR: "Impossible de charger la mémoire pour le moment.",
    IMPOSSIBLE_DE_CHARGER_LA_NOTE_POUR: "Impossible de charger la note pour le moment.",
    IMPOSSIBLE_DE_CHARGER_LES_DROITS_POUR: "Impossible de charger les droits pour le moment.",
    IMPOSSIBLE_DE_CHARGER_LES_MATIERES_POUR: "Impossible de charger les matières pour le moment.",
    IMPOSSIBLE_DE_CHARGER_LES_NOTIFICATIONS_POUR: "Impossible de charger les notifications pour le moment.",
    IMPOSSIBLE_DE_CHARGER_LES_OUTILS_DISPONIBLES: "Impossible de charger les outils disponibles pour le moment.",
    IMPOSSIBLE_DE_CHARGER_LE_PROFIL_POUR: "Impossible de charger le profil pour le moment.",
    IMPOSSIBLE_DE_CHARGER_LE_REGISTRE_POUR: "Impossible de charger le registre pour le moment.",
    IMPOSSIBLE_DE_CHARGER_L_AGENT_POUR: "Impossible de charger Clovis pour le moment.",
    IMPOSSIBLE_DE_CHARGER_L_HISTORIQUE: "Impossible de charger l'historique.",
    IMPOSSIBLE_DE_CREER_L_AGENT_ERREUR: "Erreur technique. Réessaie dans un instant.",
    IMPOSSIBLE_DE_LISTER_LA_BIBLIOTHEQUE_POUR: "Impossible de lister la bibliothèque pour le moment.",
    IMPOSSIBLE_DE_LISTER_LES_DOCUMENTS_POUR: "Impossible de lister les documents pour le moment.",
    IMPOSSIBLE_DE_MARQUER_CETTE_NOTIFICATION_COMME: "Impossible de marquer cette notification comme lue.",
    IMPOSSIBLE_DE_MARQUER_LES_NOTIFICATIONS_COMME: "Impossible de marquer les notifications comme lues.",
    IMPOSSIBLE_DE_METTRE_A_JOUR_LE: "Impossible de mettre à jour le profil pour le moment.",
    IMPOSSIBLE_DE_MODIFIER_LES_DROITS_POUR: "Impossible de modifier les droits pour le moment.",
    IMPOSSIBLE_DE_RECUPERER_LE_STATUT: "Impossible de récupérer le statut.",
    IMPOSSIBLE_DE_SUPPRIMER_CE_DOCUMENT: "Impossible de supprimer ce document.",
    IMPOSSIBLE_DE_SUPPRIMER_CE_DOCUMENT_POUR: "Impossible de supprimer ce document pour le moment.",
    IMPOSSIBLE_DE_SUPPRIMER_CE_FICHIER_POUR: "Impossible de supprimer ce fichier pour le moment.",
    IMPOSSIBLE_D_AJOUTER_CE_DOCUMENT_POUR: "Impossible d'ajouter ce document pour le moment.",
    IMPOSSIBLE_D_AJOUTER_CE_FICHIER_POUR: "Impossible d'ajouter ce fichier pour le moment.",
    IMPOSSIBLE_D_ANALYSER_CETTE_VIDEO_REESSAIE: "Impossible d'analyser cette vidéo, réessaie.",
    IMPOSSIBLE_D_EFFACER_LA_MEMOIRE_POUR: "Impossible d'effacer la mémoire pour le moment.",
    IMPOSSIBLE_D_ENREGISTRER_LA_MEMOIRE_POUR: "Impossible d'enregistrer la mémoire pour le moment.",
    IMPOSSIBLE_D_ENREGISTRER_LA_NOTE_POUR: "Impossible d'enregistrer la note pour le moment.",
    IMPOSSIBLE_D_ENREGISTRER_LE_PROFIL_POUR: "Impossible d'enregistrer le profil pour le moment.",
    IMPOSSIBLE_D_ENVOYER_CE_RETOUR_POUR: "Impossible d'envoyer ce retour pour le moment.",
    LE_CONTENU_NE_PEUT_PAS_ETRE: "Le contenu ne peut pas être vide.",
    MATIERE_INCONNUE: "Matière inconnue.",
    NOTIFICATIONS_PUSH_INDISPONIBLE: "Les notifications push ne sont pas encore activées.",
    PHOTOS_SUPP_MAXIMUM: "Maximum {maximum} photos supplémentaires en plus de la couverture.",
    PROFIL_INTROUVABLE: "Profil introuvable.",
    PROFIL_MIS_A_JOUR_MAIS_IMPOSSIBLE: "Profil mis à jour mais impossible de le relire pour confirmation.",
    PROFIL_RELECTURE_ECHEC: "Profil mis à jour mais impossible de le relire pour confirmation.",
    RECHERCHE_INDISPONIBLE: "La recherche est indisponible pour le moment.",
    REQUETE_INVALIDE: "La requête envoyée est invalide.",
    RIEN_A_MODIFIER: "Rien à modifier.",
    RIEN_N_A_ETE_COMPRIS_REESSAIE: "Rien n'a été compris, réessaie plus près du micro.",
    SERVICE_INCONNU: "Service « {service} » inconnu.",
    SESSION_EXPIREE: "Ta session a expiré, reconnecte-toi.",
    SEULS_LES_FICHIERS_PDF_SONT_ACCEPTES: "Seuls les fichiers PDF sont acceptés.",
    TOKEN_INVALIDE: "Token invalide ou expiré",
    TOKEN_MANQUANT: "Token d'authentification manquant",
    TYPE_DE_FICHIER_NON_SUPPORTE: "Type de fichier non supporté.",
    VIDEO_ILLISIBLE_REESSAIE_AVEC_UN_AUTRE: "Vidéo illisible, réessaie avec un autre fichier.",
    VIDEO_TROP_LONGUE: "Vidéo trop longue ({duree}s, {maximum}s max).",
    VIDEO_TROP_LOURDE_40_MO_MAX: "Vidéo trop lourde (40 Mo max).",
  },
  en: {
    PRECISE_MATIERE_AUTRE: "Specify the subject in \"Other\".",
    PRECISE_LA_VALEUR_POUR: "Specify a value for {libelle}.",
    EST_DEJA_PRISE_PAR_UNE: "{libelle} is already taken.",
    AUCUNE_FORMULE_DETECTEE_DANS_CETTE_IMAGE: "No formula detected in this image.",
    AUCUN_TEXTE_TROUVE_DOCUMENT_SCANNE_IMAGE: "No text found (scanned document/image without OCR?).",
    AUDIO_TROP_LONG_20_MO_MAX: "Audio too long (20 MB max).",
    CATEGORIE_INCONNUE: "Unknown category.",
    CETTE_MATIERE_EST_DEJA_PRISE_PAR: "This subject is already taken.",
    COMPORTEMENT_INTROUVABLE: "Skill not found.",
    FRONTMATTER_INVALIDE: "The skill must start with --- and contain a valid header block.",
    FRONTMATTER_INCOMPLET: "The skill must have a description and a body of text, both non-empty.",
    CE_DOCUMENT_N_APPARTIENT_PAS_A: "This document isn't accessible here.",
    CONNEXION_INDISPONIBLE: "Connection to {service} is unavailable right now.",
    DOCUMENT_TROP_LOURD_15_MO_MAX: "Document too large (15 MB max).",
    ECHEC_DE_LA_GENERATION_AUDIO_REESSAIE: "Audio generation failed, try again.",
    ECHEC_DE_LA_GENERATION_DU_DOCUMENT: "Document generation failed, try again.",
    ECHEC_DE_LA_LECTURE_DU_DOCUMENT: "Failed to read the document.",
    ECHEC_DE_LA_TRANSCRIPTION_REESSAIE: "Transcription failed, try again.",
    ECHEC_DE_L_ENREGISTREMENT_DE_L: "Failed to save the subscription.",
    ECHEC_DE_L_EXPORT_REESSAIE: "Export failed, try again.",
    ECHEC_DE_L_EXTRACTION_REESSAIE: "Extraction failed, try again.",
    ECHEC_DE_L_UPLOAD_REESSAIE: "Upload failed, try again.",
    ECHEC_DU_DESABONNEMENT: "Failed to unsubscribe.",
    ERREUR_INCONNUE: "Something went wrong, try again in a moment.",
    NOM_DEJA_UTILISE_BIBLIOTHEQUE_PERSO: "You already have a file named \"{nom}\" in your library. Rename it or replace the existing one.",
    NOM_DEJA_UTILISE_BIBLIOTHEQUE_PUBLIQUE: "A document named \"{nom}\" already exists in the public library. Choose a different name.",
    FICHIER_AUDIO_VIDE: "Empty audio file.",
    FICHIER_TROP_LOURD_50_MO_MAX: "File too large (50 MB max).",
    FICHIER_VECTORISATION_ECHEC: "« {nom} » could not be indexed.",
    FICHIER_INTROUVABLE: "File not found.",
    CE_FICHIER_NE_T_APPARTIENT_PAS: "This file doesn't belong to you.",
    FICHIER_PAS_EN_ECHEC: "This file isn't in a failed state, nothing to retry.",
    ENTREE_INTROUVABLE: "Entry not found.",
    CETTE_ENTREE_NE_T_APPARTIENT_PAS: "This entry doesn't belong to you.",
    ENTREE_PAS_EN_ECHEC: "This entry isn't in a failed state, nothing to retry.",
    FICHIER_VECTORISE_MAIS_ECHEC_DU_STOCKAGE: "File indexed but could not be saved to the library.",
    FICHIER_VIDE: "Empty file.",
    FORMAT_NON_SUPPORTE_JPEG_PNG_OU: "Unsupported format (jpeg, png or webp only).",
    FORMAT_NON_SUPPORTE_MP4_WEBM_OU: "Unsupported format (mp4, webm or mov only).",
    FORMAT_NON_SUPPORTE_PDF_WORD_DOCX: "Unsupported format (PDF, Word .docx or Excel .xlsx only).",
    GENERATION_AUDIO_INDISPONIBLE: "Audio generation isn't available yet.",
    GITHUB_DEPOTS_INDISPONIBLE: "Could not retrieve the list of repositories.",
    GITHUB_NON_CONNECTE: "GitHub account not connected.",
    IMAGE_TROP_LOURDE_5_MO_MAX: "Image too large (5 MB max).",
    IMPOSSIBLE_DE_CHARGER_CETTE_CONVERSATION: "Could not load this conversation.",
    IMPOSSIBLE_DE_CHARGER_CET_AGENT_POUR: "Could not load this conversation right now.",
    IMPOSSIBLE_DE_CHARGER_CE_PROFIL_POUR: "Could not load this profile right now.",
    IMPOSSIBLE_DE_CHARGER_LA_MEMOIRE_POUR: "Could not load memory right now.",
    IMPOSSIBLE_DE_CHARGER_LA_NOTE_POUR: "Could not load the rating right now.",
    IMPOSSIBLE_DE_CHARGER_LES_DROITS_POUR: "Could not load permissions right now.",
    IMPOSSIBLE_DE_CHARGER_LES_MATIERES_POUR: "Could not load subjects right now.",
    IMPOSSIBLE_DE_CHARGER_LES_NOTIFICATIONS_POUR: "Could not load notifications right now.",
    IMPOSSIBLE_DE_CHARGER_LES_OUTILS_DISPONIBLES: "Could not load available tools right now.",
    IMPOSSIBLE_DE_CHARGER_LE_PROFIL_POUR: "Could not load the profile right now.",
    IMPOSSIBLE_DE_CHARGER_LE_REGISTRE_POUR: "Could not load the registry right now.",
    IMPOSSIBLE_DE_CHARGER_L_AGENT_POUR: "Could not load Clovis right now.",
    IMPOSSIBLE_DE_CHARGER_L_HISTORIQUE: "Could not load history.",
    IMPOSSIBLE_DE_CREER_L_AGENT_ERREUR: "Technical error. Try again in a moment.",
    IMPOSSIBLE_DE_LISTER_LA_BIBLIOTHEQUE_POUR: "Could not list the library right now.",
    IMPOSSIBLE_DE_LISTER_LES_DOCUMENTS_POUR: "Could not list documents right now.",
    IMPOSSIBLE_DE_MARQUER_CETTE_NOTIFICATION_COMME: "Could not mark this notification as read.",
    IMPOSSIBLE_DE_MARQUER_LES_NOTIFICATIONS_COMME: "Could not mark notifications as read.",
    IMPOSSIBLE_DE_METTRE_A_JOUR_LE: "Could not update the profile right now.",
    IMPOSSIBLE_DE_MODIFIER_LES_DROITS_POUR: "Could not update permissions right now.",
    IMPOSSIBLE_DE_RECUPERER_LE_STATUT: "Could not retrieve the status.",
    IMPOSSIBLE_DE_SUPPRIMER_CE_DOCUMENT: "Could not delete this document.",
    IMPOSSIBLE_DE_SUPPRIMER_CE_DOCUMENT_POUR: "Could not delete this document right now.",
    IMPOSSIBLE_DE_SUPPRIMER_CE_FICHIER_POUR: "Could not delete this file right now.",
    IMPOSSIBLE_D_AJOUTER_CE_DOCUMENT_POUR: "Could not add this document right now.",
    IMPOSSIBLE_D_AJOUTER_CE_FICHIER_POUR: "Could not add this file right now.",
    IMPOSSIBLE_D_ANALYSER_CETTE_VIDEO_REESSAIE: "Could not analyze this video, try again.",
    IMPOSSIBLE_D_EFFACER_LA_MEMOIRE_POUR: "Could not clear memory right now.",
    IMPOSSIBLE_D_ENREGISTRER_LA_MEMOIRE_POUR: "Could not save memory right now.",
    IMPOSSIBLE_D_ENREGISTRER_LA_NOTE_POUR: "Could not save the rating right now.",
    IMPOSSIBLE_D_ENREGISTRER_LE_PROFIL_POUR: "Could not save the profile right now.",
    IMPOSSIBLE_D_ENVOYER_CE_RETOUR_POUR: "Could not send this feedback right now.",
    LE_CONTENU_NE_PEUT_PAS_ETRE: "The content cannot be empty.",
    MATIERE_INCONNUE: "Unknown subject.",
    NOTIFICATIONS_PUSH_INDISPONIBLE: "Push notifications aren't available yet.",
    PHOTOS_SUPP_MAXIMUM: "Maximum {maximum} extra photos in addition to the cover.",
    PROFIL_INTROUVABLE: "Profile not found.",
    PROFIL_MIS_A_JOUR_MAIS_IMPOSSIBLE: "Profile updated, but could not reload it for confirmation.",
    PROFIL_RELECTURE_ECHEC: "Profile updated, but could not reload it for confirmation.",
    RECHERCHE_INDISPONIBLE: "Search is unavailable right now.",
    REQUETE_INVALIDE: "The request sent is invalid.",
    RIEN_A_MODIFIER: "Nothing to change.",
    RIEN_N_A_ETE_COMPRIS_REESSAIE: "Nothing was understood, try again closer to the microphone.",
    SERVICE_INCONNU: "Unknown service « {service} ».",
    SESSION_EXPIREE: "Your session has expired, please sign in again.",
    SEULS_LES_FICHIERS_PDF_SONT_ACCEPTES: "Only PDF files are accepted.",
    TOKEN_INVALIDE: "Invalid or expired token.",
    TOKEN_MANQUANT: "Missing authentication token.",
    TEXTE_REQUIS: "Text can't be empty.",
    TYPE_DE_FICHIER_NON_SUPPORTE: "Unsupported file type.",
    VIDEO_ILLISIBLE_REESSAIE_AVEC_UN_AUTRE: "Video unreadable, try again with a different file.",
    VIDEO_TROP_LONGUE: "Video too long ({duree}s, {maximum}s max).",
    VIDEO_TROP_LOURDE_40_MO_MAX: "Video too large (40 MB max).",
  },
};

/**
 * Remplace les paramètres {nom_du_champ} d'un message par leurs valeurs
 * (ex: PHOTOS_SUPP_MAXIMUM: "Maximum {maximum} photos..." + { maximum: 6 }).
 */
function interpoler(gabarit: string, params?: Record<string, string | number>): string {
  if (!params) return gabarit;
  return gabarit.replace(/\{(\w+)\}/g, (correspondance, cle) =>
    Object.prototype.hasOwnProperty.call(params, cle) ? String(params[cle]) : correspondance
  );
}

/**
 * Erreur levée par lib/api.ts pour toute réponse HTTP en échec.
 * Porte le `code` stable renvoyé par le backend (voir core/erreurs.py) en
 * plus du message texte, pour permettre la traduction côté front.
 */
export class ErreurApi extends Error {
  code?: string;
  statusCode: number;
  params?: Record<string, string | number>;

  constructor(
    statusCode: number,
    message: string,
    code?: string,
    params?: Record<string, string | number>
  ) {
    super(message);
    this.name = "ErreurApi";
    this.statusCode = statusCode;
    this.code = code;
    this.params = params;
  }
}

/**
 * Message à afficher à l'utilisateur pour une erreur donnée (issue d'un
 * catch autour d'un appel à lib/api.ts, ou de n'importe où ailleurs).
 *
 * Priorité :
 * 1. Le code est connu dans la locale active -> message traduit.
 * 2. Sinon, le message par défaut renvoyé par le backend (déjà en
 *    français, voir core/erreurs.py) -> toujours affichable tel quel.
 * 3. Sinon (erreur JS quelconque, réseau coupé...) -> message générique.
 */
export function messageErreur(e: unknown, locale: Locale = LOCALE_ACTIVE): string {
  if (e instanceof ErreurApi) {
    const gabarit = e.code ? MESSAGES[locale][e.code] : undefined;
    if (gabarit) return interpoler(gabarit, e.params);
    if (e.message) return e.message;
  }
  if (e instanceof Error && e.message) return e.message;
  return MESSAGES[locale].ERREUR_INCONNUE;
}
