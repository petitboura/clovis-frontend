// Cree le 04/09/2026, Bourama : correction du bug "deux telephones Android
// du meme compte se melangent" (dossiers designes, canal temps reel,
// actions fire-and-forget -- voir clovis-backend/migrations/
// 2026_09_04_appareil_id_ciblage.sql pour le detail cote serveur).
//
// Jusqu'ici, rien ne distinguait deux telephones Android du meme
// compte : seule la plateforme ("android") etait envoyee au backend,
// donc deux appareils partageaient le meme "seau" cote serveur et
// s'ecrasaient mutuellement. Ce fichier genere un identifiant UNIQUE et
// PERSISTANT par installation de l'app (SharedPreferences, jamais
// resynchronise entre appareils : desinstaller puis reinstaller en
// genere un nouveau, ce qui est le comportement voulu -- un appareil
// physique different a chaque installation reelle).
//
// Le libelle (nom affiche pour distinguer les appareils, ex. "Cours"
// designe sur mon Pixel ET mon Galaxy) est SOIT choisi par l'etudiant
// (definirNomPersonnalise), SOIT genere par defaut a partir du modele
// du telephone (Build.MODEL, ex. "Pixel 8") si l'etudiant n'a rien
// choisi -- decide avec Bourama le 04/09/2026 : le nom d'appareil ne
// doit jamais etre obligatoire a saisir, l'app doit toujours avoir un
// libelle raisonnable a proposer sans rien demander.
package com.clovis.app.pont

import android.content.Context
import android.os.Build
import java.util.UUID

private const val PREFS = "clovis_identifiant_appareil"
private const val CLE_ID = "appareil_id"
private const val CLE_NOM_PERSONNALISE = "appareil_nom_personnalise"

object IdentifiantAppareil {

    /** UUID stable pour cette installation, genere une seule fois puis reutilise. */
    fun obtenirId(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.getString(CLE_ID, null)?.let { return it }

        val nouvelId = UUID.randomUUID().toString()
        prefs.edit().putString(CLE_ID, nouvelId).apply()
        return nouvelId
    }

    /** Modele du telephone (ex. "Pixel 8"), utilise comme libelle par defaut si l'etudiant n'en a pas choisi. */
    private fun libelleParDefaut(): String = Build.MODEL ?: "Android"

    /**
     * Libelle actuel de cet appareil : celui choisi par l'etudiant s'il
     * existe, sinon le modele du telephone. TOUJOURS non vide.
     */
    fun obtenirNom(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return prefs.getString(CLE_NOM_PERSONNALISE, null)?.takeIf { it.isNotBlank() } ?: libelleParDefaut()
    }

    /** true si l'etudiant a lui-meme choisi un nom (par opposition au nom de modele par defaut). */
    fun aUnNomPersonnalise(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return !prefs.getString(CLE_NOM_PERSONNALISE, null).isNullOrBlank()
    }

    /** Definit un libelle choisi par l'etudiant (ex. "Mon Android", "Téléphone d'Amadou"). */
    fun definirNomPersonnalise(context: Context, nom: String) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.edit().putString(CLE_NOM_PERSONNALISE, nom.trim()).apply()
    }
}
