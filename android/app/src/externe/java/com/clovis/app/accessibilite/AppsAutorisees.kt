// Cree le 23/08/2026, Bourama : Lot 7 (actions pilotees), flavor externe uniquement.
//
// Portee du Lot 7 : "uniquement celles explicitement autorisees par
// l'utilisateur, une par une -- pas d'action generique sur n'importe quelle
// app" (voir 07-actions-pilotees.md). Cette liste est le point de controle
// unique verifie par ExecuteurActions.kt avant toute action : aucune action
// n'est tentee si le paquet actif n'y figure pas.
//
// Persistee via SharedPreferences (pas de base de donnees necessaire pour
// une liste de noms de paquets) -- survit au redemarrage de l'app.
package com.clovis.app.accessibilite

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

private const val PREFS_NOM = "clovis_apps_autorisees"
private const val CLE_PAQUETS = "paquets_autorises"

object AppsAutorisees {
    private var prefs: SharedPreferences? = null
    private val _autorisees = MutableStateFlow<Set<String>>(emptySet())
    val autorisees: StateFlow<Set<String>> = _autorisees

    fun initialiser(context: Context) {
        if (prefs != null) return
        val p = context.applicationContext.getSharedPreferences(PREFS_NOM, Context.MODE_PRIVATE)
        prefs = p
        _autorisees.value = p.getStringSet(CLE_PAQUETS, emptySet()) ?: emptySet()
    }

    fun estAutorisee(nomPaquet: String): Boolean = _autorisees.value.contains(nomPaquet)

    fun autoriser(nomPaquet: String) {
        val nouvelle = _autorisees.value + nomPaquet
        _autorisees.value = nouvelle
        prefs?.edit()?.putStringSet(CLE_PAQUETS, nouvelle)?.apply()
    }

    fun revoquer(nomPaquet: String) {
        val nouvelle = _autorisees.value - nomPaquet
        _autorisees.value = nouvelle
        prefs?.edit()?.putStringSet(CLE_PAQUETS, nouvelle)?.apply()
    }
}
