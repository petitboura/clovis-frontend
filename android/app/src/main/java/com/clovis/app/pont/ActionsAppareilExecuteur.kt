// Cree le 24/08/2026 (Lot 1B, clovis-mobile), porte tel quel le 25/08/2026
// dans le plugin Capacitor (Lot 3B). Etendu le 26/08/2026 : brancher le
// cerveau, voir clovis-backend/core/serveur_mcp_generation.py::
// executer_action_mobile pour la liste exacte des type_action et la
// forme de `parametres` attendue par l'agent. CE FICHIER DOIT RESTER EN
// MIROIR EXACT de TYPES_ACTION_MOBILE_VALIDES cote backend : aucun
// type_action ne doit exister d'un cote sans l'autre.
package com.clovis.app.pont

import android.content.Context
import android.net.Uri
import android.util.Log
import com.clovis.app.accessibilite.AccessibiliteExecuteur
import com.clovis.app.dossiers.DossierDesigne
import com.clovis.app.dossiers.DossiersDesignesRepository
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive

object ActionsAppareilExecuteur {

    private const val TAG = "ActionsAppareil"

    // Voir dossierParNom plus bas : filet de securite si un suffixe de
    // plateforme trainait encore dans dossier_nom malgre le nouveau format
    // cote backend (05/09/2026).
    private val SUFFIXES_PLATEFORME = listOf(" (android)", " (ios)")

    suspend fun executerAction(context: Context, actionId: String) {
        val client = ClovisApiClient(context)
        val action = try {
            client.obtenirAction(actionId)
        } catch (e: Exception) {
            Log.w(TAG, "Echec recuperation action $actionId, abandon (pas de retry ici).", e)
            return
        }

        val resultat = try {
            dispatcher(context, action.type_action, action.parametres)
        } catch (e: Exception) {
            Log.w(TAG, "Echec execution action $actionId (type ${action.type_action}).", e)
            ResultatAction(false, "Erreur inattendue pendant l'exécution : ${e.message}")
        }

        try {
            client.rapporterResultatAction(actionId, resultat)
        } catch (e: Exception) {
            Log.w(TAG, "Echec rapport resultat pour action $actionId (pas de retry ici).", e)
        }
    }

    /**
     * Un seul essai, jamais de boucle de reessai a l'aveugle (meme regle
     * que ExecuteurActions.kt, Lot 7) : dossier/element introuvable ->
     * echec clair immediat, pas de nouvelle tentative.
     */
    private fun dispatcher(context: Context, typeAction: String, parametres: JsonObject): ResultatAction {
        val repo = DossiersDesignesRepository(context)

        // Correctif 05/09/2026 (Bourama) : filet de securite si le modele
        // laisse malgre tout trainer un suffixe de plateforme du type
        // " (android)"/" (ios)" dans dossier_nom (celui-ci ne devrait plus
        // jamais etre envoye depuis le 05/09/2026, voir le nouveau format
        // de lister_dossiers cote backend, mais on ne fait jamais confiance
        // aveuglement a un texte genere par le modele). Egalite stricte
        // d'abord, retente sans le suffixe seulement si ca echoue.
        fun dossierParNom(nom: String): DossierDesigne? {
            val dossiers = repo.listerDossiersDesignes()
            dossiers.firstOrNull { it.nom == nom }?.let { return it }
            val nomSansSuffixe = SUFFIXES_PLATEFORME
                .firstOrNull { nom.endsWith(it, ignoreCase = true) }
                ?.let { nom.dropLast(it.length) }
                ?: return null
            return dossiers.firstOrNull { it.nom == nomSansSuffixe }
        }

        // Descend "chemin" (noms de sous-dossiers, PARENTS uniquement)
        // depuis racineUri, niveau par niveau via listerContenu -- meme
        // logique que resoudreCheminUri cote JS (canalTempsReel.ts,
        // explorer_dossier), portee ici pour gerer_dossier_telephone.
        // Profondeur illimitee. Chemin vide/absent -> racine telle quelle.
        fun dossierParChemin(racineUri: Uri, chemin: List<String>): Uri? {
            var uriCourant = racineUri
            for (segment in chemin) {
                val enfant = repo.listerContenu(uriCourant).firstOrNull { it.estDossier && it.nom == segment }
                    ?: return null
                uriCourant = enfant.uri
            }
            return uriCourant
        }

        fun elementParNom(dossierUri: Uri, nom: String) =
            repo.listerContenu(dossierUri).firstOrNull { it.nom == nom }

        fun resultatBooleen(succes: Boolean, messageSucces: String, messageEchec: String) =
            ResultatAction(succes, if (succes) messageSucces else messageEchec)

        // Resout dossierNom + chemin (parametre "chemin", optionnel) en
        // une seule Uri, avec message d'erreur explicite si un segment
        // du chemin est introuvable. libelleChemin sert juste a des
        // messages d'erreur/succes lisibles ("Cours/Maths" par exemple).
        fun resoudreEmplacement(dossierNom: String, cleChemin: String = "chemin"): Result<Pair<Uri, String>> {
            val dossier = dossierParNom(dossierNom)
                ?: return Result.failure(Exception("Dossier \"$dossierNom\" introuvable (a peut-être été retiré)."))
            val chemin = parametres.listeTexte(cleChemin) ?: emptyList()
            if (chemin.isEmpty()) return Result.success(dossier.uri to dossierNom)
            val uri = dossierParChemin(dossier.uri, chemin)
                ?: return Result.failure(Exception("Sous-dossier introuvable dans \"$dossierNom/${chemin.joinToString("/")}\"."))
            return Result.success(uri to "$dossierNom/${chemin.joinToString("/")}")
        }

        return when (typeAction) {
            "dossier_creer_fichier" -> {
                val dossierNom = parametres.texte("dossier_nom")
                val nom = parametres.texte("nom")
                if (dossierNom == null || nom == null) {
                    return ResultatAction(false, "Paramètres manquants (dossier_nom, nom).")
                }
                val (parentUri, libelle) = resoudreEmplacement(dossierNom).getOrElse {
                    return ResultatAction(false, it.message ?: "Emplacement introuvable.")
                }
                val typeMime = parametres.texte("type_mime") ?: "text/plain"
                val succes = repo.creerFichier(parentUri, nom, typeMime)
                resultatBooleen(succes, "Fichier \"$nom\" créé dans \"$libelle\".", "Échec de la création de \"$nom\" dans \"$libelle\".")
            }
            "dossier_creer_sous_dossier" -> {
                val dossierNom = parametres.texte("dossier_nom")
                val nom = parametres.texte("nom")
                if (dossierNom == null || nom == null) {
                    return ResultatAction(false, "Paramètres manquants (dossier_nom, nom).")
                }
                val (parentUri, libelle) = resoudreEmplacement(dossierNom).getOrElse {
                    return ResultatAction(false, it.message ?: "Emplacement introuvable.")
                }
                val succes = repo.creerSousDossier(parentUri, nom)
                resultatBooleen(succes, "Sous-dossier \"$nom\" créé dans \"$libelle\".", "Échec de la création du sous-dossier \"$nom\" dans \"$libelle\".")
            }
            "dossier_renommer" -> {
                val dossierNom = parametres.texte("dossier_nom")
                val elementNom = parametres.texte("element_nom")
                val nouveauNom = parametres.texte("nouveau_nom")
                if (dossierNom == null || elementNom == null || nouveauNom == null) {
                    return ResultatAction(false, "Paramètres manquants (dossier_nom, element_nom, nouveau_nom).")
                }
                val (parentUri, libelle) = resoudreEmplacement(dossierNom).getOrElse {
                    return ResultatAction(false, it.message ?: "Emplacement introuvable.")
                }
                val element = elementParNom(parentUri, elementNom)
                    ?: return ResultatAction(false, "\"$elementNom\" introuvable dans \"$libelle\".")
                val succes = repo.renommer(element.uri, nouveauNom)
                resultatBooleen(succes, "\"$elementNom\" renommé en \"$nouveauNom\".", "Échec du renommage de \"$elementNom\".")
            }
            "dossier_supprimer" -> {
                val dossierNom = parametres.texte("dossier_nom")
                val elementNom = parametres.texte("element_nom")
                if (dossierNom == null || elementNom == null) {
                    return ResultatAction(false, "Paramètres manquants (dossier_nom, element_nom).")
                }
                val (parentUri, libelle) = resoudreEmplacement(dossierNom).getOrElse {
                    return ResultatAction(false, it.message ?: "Emplacement introuvable.")
                }
                val element = elementParNom(parentUri, elementNom)
                    ?: return ResultatAction(false, "\"$elementNom\" introuvable dans \"$libelle\".")
                val succes = repo.supprimer(element.uri)
                resultatBooleen(succes, "\"$elementNom\" supprimé de \"$libelle\".", "Échec de la suppression de \"$elementNom\".")
            }
            "dossier_deplacer" -> {
                val dossierNom = parametres.texte("dossier_nom")
                val elementNom = parametres.texte("element_nom")
                val nouveauDossierNom = parametres.texte("nouveau_dossier_nom")
                if (dossierNom == null || elementNom == null || nouveauDossierNom == null) {
                    return ResultatAction(false, "Paramètres manquants (dossier_nom, element_nom, nouveau_dossier_nom).")
                }
                val (sourceParentUri, libelleSource) = resoudreEmplacement(dossierNom, "chemin").getOrElse {
                    return ResultatAction(false, it.message ?: "Emplacement source introuvable.")
                }
                val (destinationUri, libelleDestination) = resoudreEmplacement(nouveauDossierNom, "nouveau_chemin").getOrElse {
                    return ResultatAction(false, it.message ?: "Emplacement de destination introuvable.")
                }
                val element = elementParNom(sourceParentUri, elementNom)
                    ?: return ResultatAction(false, "\"$elementNom\" introuvable dans \"$libelleSource\".")
                val succes = repo.deplacer(element.uri, sourceParentUri, destinationUri)
                resultatBooleen(succes, "\"$elementNom\" déplacé de \"$libelleSource\" vers \"$libelleDestination\".", "Échec du déplacement de \"$elementNom\".")
            }
            "accessibilite_cliquer" -> {
                val texteCible = parametres.texte("texte_cible")
                    ?: return ResultatAction(false, "Paramètre manquant (texte_cible).")
                AccessibiliteExecuteur.cliquerParTexte(texteCible)
            }
            "accessibilite_saisir" -> {
                val texteCible = parametres.texte("texte_cible")
                val valeur = parametres.texte("valeur")
                if (texteCible == null || valeur == null) {
                    return ResultatAction(false, "Paramètres manquants (texte_cible, valeur).")
                }
                AccessibiliteExecuteur.saisirTexteParCible(texteCible, valeur)
            }
            else -> ResultatAction(
                succes = false,
                resultat = "type_action \"$typeAction\" non reconnu par l'app."
            )
        }
    }

    private fun JsonObject.texte(cle: String): String? {
        val element = this[cle] ?: return null
        return try {
            element.jsonPrimitive.content
        } catch (e: Exception) {
            null
        }
    }

    // "chemin"/"nouveau_chemin" (01/09/2026) : liste de noms de
    // sous-dossiers, absente ou invalide -> null (traite comme racine
    // par resoudreEmplacement, jamais une erreur bloquante ici).
    private fun JsonObject.listeTexte(cle: String): List<String>? {
        val element = this[cle] ?: return null
        return try {
            element.jsonArray.map { it.jsonPrimitive.content }
        } catch (e: Exception) {
            null
        }
    }
}
