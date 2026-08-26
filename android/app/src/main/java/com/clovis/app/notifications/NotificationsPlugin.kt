// Cree le 26/08/2026, Bourama : construction des interfaces manquantes,
// Partie 3 mobile : Android n'avait AUCUN plugin Capacitor pour les
// rappels/notifications (verifie : seul iOS avait NotificationsPlugin.swift
// dans ios/App/App/notifications/, MainActivity.java n'enregistrait que
// Pont/Dossiers/ControleSession/Connecteurs/Accessibilite/MiseAJour). Ce
// fichier comble cette asymetrie : meme nom de plugin JS ("Notifications")
// et memes methodes que la version iOS, pour qu'un seul composant web
// fonctionne sur les deux plateformes.
//
// Cote JS (identique a iOS) :
//   const Notifications = registerPlugin<any>('Notifications');
//   await Notifications.demanderAutorisation();       // { accordee: bool }
//   await Notifications.autorisationAccordee();        // { accordee: bool }
//   await Notifications.afficherNotificationTest({ titre, corps, prioritaire });
//   await Notifications.programmerRappel({ titre, corps, dateEpochMs });
//   await Notifications.creerEvenementCalendrier({ titre, debutEpochMs, finEpochMs }); // { sauvegarde: bool }
//   await Notifications.ouvrirApp({ nomPaquet, schema }); // Android lit nomPaquet, iOS lit schema
//
// programmerRappel : utilise AlarmManager.setAndAllowWhileIdle (pas
// setExactAndAllowWhileIdle) : inexact de quelques minutes possible en
// veille profonde (Doze), volontaire pour NE PAS avoir a demander la
// permission speciale SCHEDULE_EXACT_ALARM (API 31+, justificatif Play
// Store exige), disproportionnee pour un rappel qui n'a pas besoin de la
// seconde pres. A revoir avec Bourama si une precision exacte s'avere
// necessaire.
package com.clovis.app.notifications

import android.Manifest
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.PermissionState
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import kotlin.random.Random

@CapacitorPlugin(
    name = "Notifications",
    permissions = [
        Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS])
    ]
)
class NotificationsPlugin : Plugin() {

    @PluginMethod
    fun demanderAutorisation(call: PluginCall) {
        // POST_NOTIFICATIONS n'est une permission runtime qu'a partir
        // d'Android 13 (API 33) : avant, deja accordee d'office.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            call.resolve(JSObject().put("accordee", NotificationsNatives.permissionNotificationsAccordee(context)))
            return
        }
        if (getPermissionState("notifications") == PermissionState.GRANTED) {
            call.resolve(JSObject().put("accordee", true))
            return
        }
        requestPermissionForAlias("notifications", call, "surResultatPermission")
    }

    @PermissionCallback
    private fun surResultatPermission(call: PluginCall) {
        call.resolve(JSObject().put("accordee", getPermissionState("notifications") == PermissionState.GRANTED))
    }

    @PluginMethod
    fun autorisationAccordee(call: PluginCall) {
        call.resolve(JSObject().put("accordee", NotificationsNatives.permissionNotificationsAccordee(context)))
    }

    @PluginMethod
    fun afficherNotificationTest(call: PluginCall) {
        val titre = call.getString("titre")
        val corps = call.getString("corps")
        if (titre == null || corps == null) {
            call.reject("Parametres 'titre' et 'corps' requis.")
            return
        }
        val prioritaire = call.getBoolean("prioritaire") ?: false
        NotificationsNatives.afficherRappel(context, titre, corps, prioritaire)
        call.resolve()
    }

    @PluginMethod
    fun programmerRappel(call: PluginCall) {
        val titre = call.getString("titre")
        val corps = call.getString("corps")
        val dateEpochMs = call.getDouble("dateEpochMs")
        if (titre == null || corps == null || dateEpochMs == null) {
            call.reject("Parametres 'titre', 'corps' et 'dateEpochMs' requis.")
            return
        }
        val intent = Intent(context, RappelAlarmReceiver::class.java).apply {
            putExtra(EXTRA_TITRE_RAPPEL, titre)
            putExtra(EXTRA_CORPS_RAPPEL, corps)
        }
        val pending = PendingIntent.getBroadcast(
            context,
            Random.nextInt(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, dateEpochMs.toLong(), pending)
        call.resolve()
    }

    @PluginMethod
    fun creerEvenementCalendrier(call: PluginCall) {
        val titre = call.getString("titre")
        val debutEpochMs = call.getDouble("debutEpochMs")
        val finEpochMs = call.getDouble("finEpochMs")
        if (titre == null || debutEpochMs == null || finEpochMs == null) {
            call.reject("Parametres 'titre', 'debutEpochMs' et 'finEpochMs' requis.")
            return
        }
        val ouvert = RappelsNatifs.ajouterEvenementCalendrier(context, titre, "", debutEpochMs.toLong(), finEpochMs.toLong())
        if (!ouvert) {
            call.reject("Aucune application Calendrier trouvee sur cet appareil.")
            return
        }
        // Contrairement a iOS (EventKitUI donne un vrai callback de
        // sauvegarde), Android delegue a une app externe via un simple
        // Intent, sans retour possible : impossible de savoir si
        // l'etudiant a reellement enregistre l'evenement une fois l'app
        // Calendrier ouverte. `sauvegarde` vaut donc `true` des que l'app
        // s'est ouverte (pas une vraie confirmation) : difference de
        // plateforme documentee ici plutot que masquee.
        call.resolve(JSObject().put("sauvegarde", true))
    }

    @PluginMethod
    fun ouvrirApp(call: PluginCall) {
        // Asymetrie de plateforme volontaire : iOS adresse une app par
        // schema d'URL (`schema`), Android par nom de paquet (`nomPaquet`)
        // : aucun terrain commun. Le code web envoie les deux parametres,
        // chaque plateforme lit celui qui la concerne (voir
        // NotificationsPlugin.swift cote iOS pour le miroir).
        val nomPaquet = call.getString("nomPaquet")
        if (nomPaquet == null) {
            call.reject("Parametre 'nomPaquet' manquant (requis sur Android, voir 'schema' cote iOS).")
            return
        }
        val ouverte = RappelsNatifs.ouvrirApp(context, nomPaquet)
        if (ouverte) {
            call.resolve()
        } else {
            call.reject("App introuvable ou paquet non declare dans <queries> (AndroidManifest.xml).")
        }
    }
}
