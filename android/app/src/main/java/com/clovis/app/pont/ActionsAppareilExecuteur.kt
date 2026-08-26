// Cree le 24/08/2026 (Lot 1B, clovis-mobile), porte tel quel le 25/08/2026
// dans le plugin Capacitor (Lot 3B). Etendu le 26/08/2026 : brancher le
// cerveau -- voir clovis-backend/core/serveur_mcp_generation.py::
// executer_action_mobile pour la liste exacte des type_action et la
// forme de `parametres` attendue par l'agent. CE FICHIER DOIT RESTER EN
// MIROIR EXACT de TYPES_ACTION_MOBILE_VALIDES cote backend : aucun
// type_action ne doit exister d'un cote sans l'autre.
package com.clovis.app.pont

import android.content.Context
import android.net.Uri
import android.util.Log
import com.clovis.app.accessibilite.AccessibiliteExecuteur
import com.clovis.app.dossiers.DossiersDesignesRepository
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive

object ActionsAppareilExecuteur {

    private const val TAG = "ActionsAppareil"

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

        fun dossierParNom(nom: String) =
            repo.listerDossiersDesignes().firstOrNull { it.nom == nom }

        fun elementParNom(dossierUri: Uri, nom: String) =
            repo.listerContenu(dossierUri).firstOrNull { it.nom == nom }

        fun resultatBooleen(succes: Boolean, messageSucces: String, messageEchec: String) =
            ResultatAction(succes, if (succes) messageSucces else messageEchec)

        return when (typeAction) {
            "dossier_creer_fichier" -> {
                val dossierNom = parametres.texte("dossier_nom")
                val nom = parametres.texte("nom")
                if (dossierNom == null || nom == null) {
                    return ResultatAction(false, "Paramètres manquants (dossier_nom, nom).")
                }
                val dossier = dossierParNom(dossierNom)
                    ?: return ResultatAction(false, "Dossier \"$dossierNom\" introuvable (a peut-être été retiré).")
                val typeMime = parametres.texte("type_mime") ?: "text/plain"
                val succes = repo.creerFichier(dossier.uri, nom, typeMime)
                resultatBooleen(succes, "Fichier \"$nom\" créé dans \"$dossierNom\".", "Échec de la création de \"$nom\" dans \"$dossierNom\".")
            }
            "dossier_creer_sous_dossier" -> {
                val dossierNom = parametres.texte("dossier_nom")
                val nom = parametres.texte("nom")
                if (dossierNom == null || nom == null) {
                    return ResultatAction(false, "Paramètres manquants (dossier_nom, nom).")
                }
                val dossier = dossierParNom(dossierNom)
                    ?: return ResultatAction(false, "Dossier \"$dossierNom\" introuvable (a peut-être été retiré).")
                val succes = repo.creerSousDossier(dossier.uri, nom)
                resultatBooleen(succes, "Sous-dossier \"$nom\" créé dans \"$dossierNom\".", "Échec de la création du sous-dossier \"$nom\" dans \"$dossierNom\".")
            }
            "dossier_renommer" -> {
                val dossierNom = parametres.texte("dossier_nom")
                val elementNom = parametres.texte("element_nom")
                val nouveauNom = parametres.texte("nouveau_nom")
                if (dossierNom == null || elementNom == null || nouveauNom == null) {
                    return ResultatAction(false, "Paramètres manquants (dossier_nom, element_nom, nouveau_nom).")
                }
                val dossier = dossierParNom(dossierNom)
                    ?: return ResultatAction(false, "Dossier \"$dossierNom\" introuvable (a peut-être été retiré).")
                val element = elementParNom(dossier.uri, elementNom)
                    ?: return ResultatAction(false, "\"$elementNom\" introuvable dans \"$dossierNom\".")
                val succes = repo.renommer(element.uri, nouveauNom)
                resultatBooleen(succes, "\"$elementNom\" renommé en \"$nouveauNom\".", "Échec du renommage de \"$elementNom\".")
            }
            "dossier_supprimer" -> {
                val dossierNom = parametres.texte("dossier_nom")
                val elementNom = parametres.texte("element_nom")
                if (dossierNom == null || elementNom == null) {
                    return ResultatAction(false, "Paramètres manquants (dossier_nom, element_nom).")
                }
                val dossier = dossierParNom(dossierNom)
                    ?: return ResultatAction(false, "Dossier \"$dossierNom\" introuvable (a peut-être été retiré).")
                val element = elementParNom(dossier.uri, elementNom)
                    ?: return ResultatAction(false, "\"$elementNom\" introuvable dans \"$dossierNom\".")
                val succes = repo.supprimer(element.uri)
                resultatBooleen(succes, "\"$elementNom\" supprimé de \"$dossierNom\".", "Échec de la suppression de \"$elementNom\".")
            }
            "dossier_deplacer" -> {
                val dossierNom = parametres.texte("dossier_nom")
                val elementNom = parametres.texte("element_nom")
                val nouveauDossierNom = parametres.texte("nouveau_dossier_nom")
                if (dossierNom == null || elementNom == null || nouveauDossierNom == null) {
                    return ResultatAction(false, "Paramètres manquants (dossier_nom, element_nom, nouveau_dossier_nom).")
                }
                val dossier = dossierParNom(dossierNom)
                    ?: return ResultatAction(false, "Dossier \"$dossierNom\" introuvable (a peut-être été retiré).")
                val nouveauDossier = dossierParNom(nouveauDossierNom)
                    ?: return ResultatAction(false, "Dossier de destination \"$nouveauDossierNom\" introuvable.")
                val element = elementParNom(dossier.uri, elementNom)
                    ?: return ResultatAction(false, "\"$elementNom\" introuvable dans \"$dossierNom\".")
                val succes = repo.deplacer(element.uri, dossier.uri, nouveauDossier.uri)
                resultatBooleen(succes, "\"$elementNom\" déplacé de \"$dossierNom\" vers \"$nouveauDossierNom\".", "Échec du déplacement de \"$elementNom\".")
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
}
