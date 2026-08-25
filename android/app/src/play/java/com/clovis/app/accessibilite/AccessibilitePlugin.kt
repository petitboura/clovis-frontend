// Cree le 25/08/2026, Bourama : flavor play.
//
// Le service d'accessibilite (lots 6-8) n'existe PAS dans cette variante,
// volontairement -- voir 00-commun.md. Ce stub garde MainActivity.java
// (src/main, commun) compilable pour "play" sans jamais inclure la moindre
// ligne de code d'accessibilite dans l'APK Play Store : aucune classe
// AccessibilityService, aucun accessibility_service_config.xml, rien.
package com.clovis.app.accessibilite

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "Accessibilite")
class AccessibilitePlugin : Plugin() {

    @PluginMethod
    fun disponible(call: PluginCall) {
        call.resolve(JSObject().put("disponible", false))
    }

    // Toute autre methode appelee sur ce flavor est un bug cote JS (devrait
    // toujours verifier disponible() avant) -- rejet explicite plutot que
    // silencieux, pour que l'erreur soit visible tout de suite.
    @PluginMethod
    fun serviceActif(call: PluginCall) = refuser(call)
    @PluginMethod
    fun ouvrirReglagesService(call: PluginCall) = refuser(call)
    @PluginMethod
    fun listerAppsAutorisees(call: PluginCall) = refuser(call)
    @PluginMethod
    fun autoriserApp(call: PluginCall) = refuser(call)
    @PluginMethod
    fun revoquerApp(call: PluginCall) = refuser(call)
    @PluginMethod
    fun journalAccessibilite(call: PluginCall) = refuser(call)
    @PluginMethod
    fun journalActions(call: PluginCall) = refuser(call)
    @PluginMethod
    fun cliquerParTexte(call: PluginCall) = refuser(call)
    @PluginMethod
    fun saisirTexteParCible(call: PluginCall) = refuser(call)

    private fun refuser(call: PluginCall) {
        call.reject("Accessibilite indisponible sur cette version (Play Store).")
    }
}
