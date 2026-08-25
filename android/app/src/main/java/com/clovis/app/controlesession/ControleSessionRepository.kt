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
package com.clovis.app.controlesession

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.provider.Settings

data class EtatInitialSession(
    val filtreInterruptionInitial: Int,
    val volumeSonnerieInitial: Int,
    val volumeNotificationInitial: Int
)

class ControleSessionRepository(private val context: Context) {

    private val notificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    private val audioManager =
        context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    fun permissionAccordee(): Boolean = notificationManager.isNotificationPolicyAccessGranted

    fun ouvrirReglagesPermission() {
        val intent = Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    fun capturerEtatInitial(): EtatInitialSession = EtatInitialSession(
        filtreInterruptionInitial = notificationManager.currentInterruptionFilter,
        volumeSonnerieInitial = audioManager.getStreamVolume(AudioManager.STREAM_RING),
        volumeNotificationInitial = audioManager.getStreamVolume(AudioManager.STREAM_NOTIFICATION)
    )

    fun activerNePasDeranger() {
        if (!permissionAccordee()) return
        notificationManager.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALARMS)
    }

    fun couperSonnerieEtNotifications() {
        if (!permissionAccordee()) return
        audioManager.setStreamVolume(AudioManager.STREAM_RING, 0, 0)
        audioManager.setStreamVolume(AudioManager.STREAM_NOTIFICATION, 0, 0)
    }

    fun restaurerEtatInitial(etat: EtatInitialSession) {
        if (!permissionAccordee()) return
        notificationManager.setInterruptionFilter(etat.filtreInterruptionInitial)
        audioManager.setStreamVolume(AudioManager.STREAM_RING, etat.volumeSonnerieInitial, 0)
        audioManager.setStreamVolume(
            AudioManager.STREAM_NOTIFICATION,
            etat.volumeNotificationInitial,
            0
        )
    }
}
