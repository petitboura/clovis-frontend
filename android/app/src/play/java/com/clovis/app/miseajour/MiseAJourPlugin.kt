// Cree le 25/08/2026, Bourama : flavor play.
//
// Le flavor "play" se met a jour automatiquement via le Play Store, ce
// plugin n'a pas de raison d'exister ici. Stub pour garder MainActivity.java
// (src/main, commun) compilable -- meme principe que AccessibilitePlugin.
package com.clovis.app.miseajour

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "MiseAJour")
class MiseAJourPlugin : Plugin() {

    @PluginMethod
    fun disponible(call: PluginCall) {
        call.resolve(JSObject().put("disponible", false))
    }

    @PluginMethod
    fun verifier(call: PluginCall) {
        call.reject("Verification de mise a jour indisponible sur cette version (Play Store).")
    }

    @PluginMethod
    fun ouvrirTelechargement(call: PluginCall) {
        call.reject("Verification de mise a jour indisponible sur cette version (Play Store).")
    }
}
