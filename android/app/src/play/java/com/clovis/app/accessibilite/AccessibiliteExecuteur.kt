// Cree le 26/08/2026, Bourama : flavor play.
//
// Stub miroir de AccessibiliteExecuteur (flavor externe) : meme
// package/nom de classe pour qu'ActionsAppareilExecuteur.kt (src/main,
// commun) compile sur les deux flavors sans jamais inclure la moindre
// ligne de code d'accessibilite dans l'APK Play Store -- meme principe
// que AccessibilitePlugin.kt (flavor play) pour le cote Capacitor/JS.
package com.clovis.app.accessibilite

import com.clovis.app.pont.ResultatAction

object AccessibiliteExecuteur {

    fun cliquerParTexte(texteCible: String): ResultatAction =
        indisponible()

    fun saisirTexteParCible(texteCible: String, valeur: String): ResultatAction =
        indisponible()

    private fun indisponible(): ResultatAction =
        ResultatAction(false, "Accessibilité indisponible sur cette version (Play Store).")
}
