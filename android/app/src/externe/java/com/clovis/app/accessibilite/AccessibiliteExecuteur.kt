// Cree le 26/08/2026, Bourama : brancher le cerveau sur l'accessibilite
// (suite Lot 7). Adaptateur plat (pas un Plugin Capacitor, pas de
// PluginCall) pour qu'ActionsAppareilExecuteur.kt (src/main, COMMUN aux
// deux flavors) puisse appeler l'accessibilite sans jamais referencer
// ExecuteurActions/ServiceAccessibiliteClovis directement -- meme nom de
// classe/package que la version "play" ci-dessous (stub), c'est ce qui
// rend l'appel depuis le code commun possible sans rompre la compilation
// du flavor play (voir 00-commun.md, isolation au niveau des sources).
package com.clovis.app.accessibilite

import com.clovis.app.pont.ResultatAction

object AccessibiliteExecuteur {

    fun cliquerParTexte(texteCible: String): ResultatAction {
        val r = ExecuteurActions.cliquerParTexte(texteCible)
        return ResultatAction(r.succes, r.message)
    }

    fun saisirTexteParCible(texteCible: String, valeur: String): ResultatAction {
        val r = ExecuteurActions.saisirTexteParCible(texteCible, valeur)
        return ResultatAction(r.succes, r.message)
    }
}
