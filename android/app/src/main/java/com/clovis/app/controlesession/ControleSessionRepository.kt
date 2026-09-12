// Porte depuis clovis-mobile/android-legacy-natif (Lot 4 Partie 3, 23/08/2026)
// dans le plugin Capacitor (Lot 3B, 25/08/2026). Logique inchangee, seul le
// package a change (com.clovis.app.data -> com.clovis.app.controlesession).
//
// Portee : DND et volume sonnerie/notifications pendant une session,
// restauration exacte de l'etat initial a la fin.
//
// Necessite la permission speciale "Acces a la Politique de Notification"
// pour les DEUX capacites : basculer le filtre d'interruption ET ajuster le
// volume des flux RING/NOTIFICATION. Pas de popup standard, redirection vers
// Reglages (ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS).
//
// DND de session : INTERRUPTION_FILTER_ALARMS (seules les alarmes passent).
//
// 09/09/2026, Bourama (session basee sur une duree, pilotable par l'IA en
// plus du bouton manuel) : etat initial desormais persiste en
// SharedPreferences (meme convention que DossiersDesignesRepository.kt,
// PREFS_NOM ci-dessous), pas seulement garde en memoire -- necessaire pour
// que ControleSessionAlarmReceiver (declenche par AlarmManager, peut
// tourner sans que le plugin/l'app soit en vie) puisse retrouver l'etat a
// restaurer. `demarrer`/`arreter` regroupent ici TOUTE la logique
// (capture/persistance d'etat + programmation/annulation de l'alarme),
// reutilisee telle quelle par ControleSessionPlugin.kt (bouton manuel,
// cote JS) ET par ActionsAppareilExecuteur.kt (declenchee par l'IA,
// entierement native) -- une seule version de cette logique, jamais deux
// copies a maintenir en parallele.
package com.clovis.app.controlesession

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.provider.Settings

data class EtatInitialSession(
    val filtreInterruptionInitial: Int,
    val volumeSonnerieInitial: Int,
    val volumeNotificationInitial: Int
)

private const val PREFS_NOM = "controle_session"
private const val CLE_FILTRE = "filtre_interruption_initial"
private const val CLE_VOLUME_SONNERIE = "volume_sonnerie_initial"
private const val CLE_VOLUME_NOTIFICATION = "volume_notification_initial"
private const val REQUEST_CODE_ALARME_FIN_SESSION = 4821

class ControleSessionRepository(private val context: Context) {

    private val notificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    private val audioManager =
        context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val prefs = context.getSharedPreferences(PREFS_NOM, Context.MODE_PRIVATE)

    fun permissionAccordee(): Boolean = notificationManager.isNotificationPolicyAccessGranted

    fun ouvrirReglagesPermission() {
        val intent = Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    /**
     * Démarre une session pour `dureeMinutes` : capture l'état, active
     * DND/coupe le son, programme l'auto-arrêt. Échec (`Result.failure`)
     * si la permission n'est pas accordée.
     */
    fun demarrer(dureeMinutes: Int): Result<Unit> {
        if (!permissionAccordee()) {
            return Result.failure(Exception("Permission 'Accès à la Politique de notification' non accordée."))
        }
        val etat = EtatInitialSession(
            filtreInterruptionInitial = notificationManager.currentInterruptionFilter,
            volumeSonnerieInitial = audioManager.getStreamVolume(AudioManager.STREAM_RING),
            volumeNotificationInitial = audioManager.getStreamVolume(AudioManager.STREAM_NOTIFICATION)
        )
        sauvegarderEtatInitial(etat)
        notificationManager.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALARMS)
        audioManager.setStreamVolume(AudioManager.STREAM_RING, 0, 0)
        audioManager.setStreamVolume(AudioManager.STREAM_NOTIFICATION, 0, 0)
        programmerAutoArret(dureeMinutes)
        return Result.success(Unit)
    }

    /**
     * Arrête la session en cours (manuellement, avant la fin de la
     * durée) : restaure l'état, annule l'alarme programmée. Échec si
     * aucune session n'est en cours.
     */
    fun arreter(): Result<Unit> {
        val etat = lireEtatInitialSauvegarde()
            ?: return Result.failure(Exception("Aucune session en cours."))
        restaurerEtatInitial(etat)
        effacerEtatInitialSauvegarde()
        annulerAutoArret()
        return Result.success(Unit)
    }

    private fun restaurerEtatInitial(etat: EtatInitialSession) {
        if (!permissionAccordee()) return
        notificationManager.setInterruptionFilter(etat.filtreInterruptionInitial)
        audioManager.setStreamVolume(AudioManager.STREAM_RING, etat.volumeSonnerieInitial, 0)
        audioManager.setStreamVolume(
            AudioManager.STREAM_NOTIFICATION,
            etat.volumeNotificationInitial,
            0
        )
    }

    private fun sauvegarderEtatInitial(etat: EtatInitialSession) {
        prefs.edit()
            .putInt(CLE_FILTRE, etat.filtreInterruptionInitial)
            .putInt(CLE_VOLUME_SONNERIE, etat.volumeSonnerieInitial)
            .putInt(CLE_VOLUME_NOTIFICATION, etat.volumeNotificationInitial)
            .apply()
    }

    /** null si aucune session n'a d'etat sauvegarde (rien en cours). */
    private fun lireEtatInitialSauvegarde(): EtatInitialSession? {
        if (!prefs.contains(CLE_FILTRE)) return null
        return EtatInitialSession(
            filtreInterruptionInitial = prefs.getInt(CLE_FILTRE, NotificationManager.INTERRUPTION_FILTER_ALL),
            volumeSonnerieInitial = prefs.getInt(CLE_VOLUME_SONNERIE, 0),
            volumeNotificationInitial = prefs.getInt(CLE_VOLUME_NOTIFICATION, 0)
        )
    }

    private fun effacerEtatInitialSauvegarde() {
        prefs.edit().clear().apply()
    }

    private fun pendingIntentAlarme(): PendingIntent {
        val intent = Intent(context, ControleSessionAlarmReceiver::class.java)
        return PendingIntent.getBroadcast(
            context,
            REQUEST_CODE_ALARME_FIN_SESSION,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun programmerAutoArret(dureeMinutes: Int) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val declenchementMillis = System.currentTimeMillis() + dureeMinutes * 60_000L
        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, declenchementMillis, pendingIntentAlarme())
    }

    private fun annulerAutoArret() {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.cancel(pendingIntentAlarme())
    }

    /** Utilisé uniquement par ControleSessionAlarmReceiver (l'alarme elle-même, à l'échéance). */
    fun restaurerEtatALaFinDeLaSession() {
        val etat = lireEtatInitialSauvegarde() ?: return
        restaurerEtatInitial(etat)
        effacerEtatInitialSauvegarde()
    }
}
