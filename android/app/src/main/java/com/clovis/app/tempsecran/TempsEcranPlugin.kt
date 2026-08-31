// Cree le 26/08/2026, Bourama : construction des interfaces manquantes,
// Partie 3 mobile. Porte depuis clovis-mobile/android-legacy-natif
// (Lot 1, UsageStatsRepository.kt + UsageScreen.kt) : meme logique
// UsageStatsManager, l'ecran Compose est retire (a construire cote
// clovis-frontend web qui appelle ce plugin, meme principe que Dossiers/
// ControleSession/Connecteurs/Accessibilite/MiseAJour).
//
// Cote JS :
//   const TempsEcran = registerPlugin<any>('TempsEcran');
//   await TempsEcran.permissionAccordee();      // { accordee: bool }
//   await TempsEcran.ouvrirReglagesPermission(); // ouvre les Reglages systeme (PACKAGE_USAGE_STATS)
//   await TempsEcran.usageAujourdhui();          // { apps: [{ nomPaquet, nomAffiche, icone, dureeSecondes }] }
//   await TempsEcran.appActuellementActive();    // { nomPaquet: string | null }
//
// La synchronisation vers clovis-backend (POST /api/appareils-mobiles/usage)
// n'est PAS faite ici : ce plugin ne renvoie que les chiffres bruts lus sur
// le telephone, c'est au code web (lib/api.ts) d'appeler le backend, comme
// pour le reste de l'app : pas de client HTTP duplique cote Kotlin pour
// une capacite qui n'a besoin de fonctionner que quand l'app est ouverte
// (contrairement au pont PontNatif, qui doit fonctionner app fermee).
//
// Pas d'equivalent iOS pour l'instant : Screen Time necessite l'entitlement
// Family Controls (compte Apple Developer Program actif, que Bourama n'a
// pas encore) + un target d'extension Xcode separe : voir
// clovis-mobile/ios-legacy-natif/.../UsageScreen.swift pour le detail deja
// documente. Signale a Bourama plutot que devine/simule.
//
// 31/08/2026 : usageAujourdhui() renvoyait seulement nomPaquet (package
// brut, ex. "com.whatsapp"), affiche tel quel cote web. Ajout de
// nomAffiche + icone via ResolveurApps (util partage, voir
// com.clovis.app.util.ResolveurApps), nomPaquet garde en plus pour la
// synchronisation backend (lib/api.ts) qui continue de cle sur le nom de
// paquet, inchangee.
package com.clovis.app.tempsecran

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Process
import android.provider.Settings
import com.clovis.app.util.ResolveurApps
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.util.Calendar

@CapacitorPlugin(name = "TempsEcran")
class TempsEcranPlugin : Plugin() {

    private fun permissionAccordeeReel(): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = appOps.unsafeCheckOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            context.packageName
        )
        return mode == AppOpsManager.MODE_ALLOWED
    }

    @PluginMethod
    fun permissionAccordee(call: PluginCall) {
        call.resolve(JSObject().put("accordee", permissionAccordeeReel()))
    }

    @PluginMethod
    fun ouvrirReglagesPermission(call: PluginCall) {
        context.startActivity(
            Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        )
        call.resolve()
    }

    @PluginMethod
    fun usageAujourdhui(call: PluginCall) {
        if (!permissionAccordeeReel()) {
            call.reject("Permission d'acces a l'usage des apps non accordee.")
            return
        }
        val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val debutJour = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis
        val maintenant = System.currentTimeMillis()

        val stats = manager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, debutJour, maintenant)
        val tableau = JSArray()
        stats
            .filter { it.totalTimeInForeground > 0 }
            .sortedByDescending { it.totalTimeInForeground }
            .forEach {
                val resolue = ResolveurApps.resoudre(context, it.packageName)
                tableau.put(
                    JSObject()
                        .put("nomPaquet", it.packageName)
                        .put("nomAffiche", resolue.nomAffiche)
                        .put("icone", resolue.icone)
                        .put("dureeSecondes", it.totalTimeInForeground / 1000)
                )
            }
        call.resolve(JSObject().put("apps", tableau))
    }

    @PluginMethod
    fun appActuellementActive(call: PluginCall) {
        if (!permissionAccordeeReel()) {
            call.reject("Permission d'acces a l'usage des apps non accordee.")
            return
        }
        val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val maintenant = System.currentTimeMillis()
        val events = manager.queryEvents(maintenant - 60_000, maintenant)
        var dernierPaquetActif: String? = null
        val event = UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            if (event.eventType == UsageEvents.Event.ACTIVITY_RESUMED) {
                dernierPaquetActif = event.packageName
            }
        }
        call.resolve(JSObject().put("nomPaquet", dernierPaquetActif))
    }
}
