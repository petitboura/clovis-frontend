// Cree le 25/08/2026, Bourama : Lot 3B Partie 3 mobile (fusion Capacitor).
// Porte depuis clovis-mobile/android-legacy-natif (Lot 6-7, EcranAccessibilite.kt
// + ModuleAccessibilite.kt) : meme logique (AppsAutorisees, ExecuteurActions,
// JournalAccessibilite/Actions, ServiceAccessibiliteClovis, copies telles
// quelles a cote de ce fichier), l'ecran Compose est retire.
//
// Flavor "externe" UNIQUEMENT (voir 00-commun.md, isolation au niveau des
// sources compilees) -- ce fichier n'existe pas dans le flavor "play", voir
// src/play/.../accessibilite/AccessibilitePlugin.kt (stub).
//
// Cote JS :
//   const Accessibilite = registerPlugin<any>('Accessibilite');
//   await Accessibilite.disponible();                    // { disponible: true } (toujours, ce flavor)
//   await Accessibilite.serviceActif();                   // { actif: bool }
//   await Accessibilite.ouvrirReglagesService();
//   await Accessibilite.listerAppsAutorisees();
//   await Accessibilite.autoriserApp({ nomPaquet });
//   await Accessibilite.revoquerApp({ nomPaquet });
//   await Accessibilite.journalAccessibilite();            // dernieres lectures passives
//   await Accessibilite.journalActions();                  // dernieres tentatives d'action
//   await Accessibilite.cliquerParTexte({ texteCible });
//   await Accessibilite.saisirTexteParCible({ texteCible, valeur });
package com.clovis.app.accessibilite

import android.content.Intent
import android.provider.Settings
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "Accessibilite")
class AccessibilitePlugin : Plugin() {

    init {
        AppsAutorisees.initialiser(context)
    }

    @PluginMethod
    fun disponible(call: PluginCall) {
        call.resolve(JSObject().put("disponible", true))
    }

    @PluginMethod
    fun serviceActif(call: PluginCall) {
        call.resolve(JSObject().put("actif", ServiceAccessibiliteClovis.instance != null))
    }

    @PluginMethod
    fun ouvrirReglagesService(call: PluginCall) {
        context.startActivity(
            Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        )
        call.resolve()
    }

    @PluginMethod
    fun listerAppsAutorisees(call: PluginCall) {
        val tableau = JSArray()
        AppsAutorisees.autorisees.value.forEach { tableau.put(it) }
        call.resolve(JSObject().put("paquets", tableau))
    }

    @PluginMethod
    fun autoriserApp(call: PluginCall) {
        val nomPaquet = call.getString("nomPaquet")
        if (nomPaquet == null) {
            call.reject("Parametre 'nomPaquet' manquant.")
            return
        }
        AppsAutorisees.autoriser(nomPaquet)
        call.resolve()
    }

    @PluginMethod
    fun revoquerApp(call: PluginCall) {
        val nomPaquet = call.getString("nomPaquet")
        if (nomPaquet == null) {
            call.reject("Parametre 'nomPaquet' manquant.")
            return
        }
        AppsAutorisees.revoquer(nomPaquet)
        call.resolve()
    }

    @PluginMethod
    fun journalAccessibilite(call: PluginCall) {
        val tableau = JSArray()
        JournalAccessibilite.entrees.value.forEach {
            tableau.put(
                JSObject()
                    .put("nomPaquet", it.nomPaquet)
                    .put("typeEvenement", it.typeEvenement)
                    .put("nombreNoeudsLus", it.nombreNoeudsLus)
                    .put("horodatage", it.horodatage)
            )
        }
        call.resolve(JSObject().put("entrees", tableau))
    }

    @PluginMethod
    fun journalActions(call: PluginCall) {
        val tableau = JSArray()
        JournalActions.entrees.value.forEach {
            tableau.put(
                JSObject()
                    .put("nomPaquet", it.nomPaquet)
                    .put("cible", it.cible)
                    .put("succes", it.succes)
                    .put("message", it.message)
                    .put("horodatage", it.horodatage)
            )
        }
        call.resolve(JSObject().put("entrees", tableau))
    }

    @PluginMethod
    fun cliquerParTexte(call: PluginCall) {
        val texteCible = call.getString("texteCible")
        if (texteCible == null) {
            call.reject("Parametre 'texteCible' manquant.")
            return
        }
        val resultat = ExecuteurActions.cliquerParTexte(texteCible)
        call.resolve(JSObject().put("succes", resultat.succes).put("message", resultat.message))
    }

    @PluginMethod
    fun saisirTexteParCible(call: PluginCall) {
        val texteCible = call.getString("texteCible")
        val valeur = call.getString("valeur")
        if (texteCible == null || valeur == null) {
            call.reject("Parametres 'texteCible' et 'valeur' requis.")
            return
        }
        val resultat = ExecuteurActions.saisirTexteParCible(texteCible, valeur)
        call.resolve(JSObject().put("succes", resultat.succes).put("message", resultat.message))
    }
}
