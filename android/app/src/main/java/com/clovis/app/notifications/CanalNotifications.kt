// Cree le 23/08/2026 (Lot 3, clovis-mobile), porte tel quel le 25/08/2026
// dans le plugin Capacitor (Lot 3B).
package com.clovis.app.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build

const val CANAL_RAPPELS = "rappels"
const val CANAL_RAPPELS_URGENTS = "rappels_urgents"

// Ajoute le 12/09/2026, demande Bourama : vrai téléchargement système
// (voir com.clovis.app.telechargement.TelechargementPlugin) pour le
// contenu généré côté client (texte, PNG) qui n'a pas d'URL à donner au
// DownloadManager système -- celui-ci gère sa propre notification, mais
// pas nous quand on écrit nous-mêmes dans MediaStore.Downloads.
const val CANAL_TELECHARGEMENTS = "telechargements"

fun creerCanauxNotifications(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val gestionnaire = context.getSystemService(NotificationManager::class.java)

    val canalStandard = NotificationChannel(
        CANAL_RAPPELS,
        "Rappels Clovis",
        NotificationManager.IMPORTANCE_HIGH
    ).apply {
        description = "Rappels et notifications programmés par Clovis."
    }

    val canalUrgent = NotificationChannel(
        CANAL_RAPPELS_URGENTS,
        "Rappels prioritaires Clovis",
        NotificationManager.IMPORTANCE_HIGH
    ).apply {
        description = "Rappels importants (type alarme), affichage plein écran si autorisé."
    }

    val canalTelechargements = NotificationChannel(
        CANAL_TELECHARGEMENTS,
        "Téléchargements Clovis",
        NotificationManager.IMPORTANCE_DEFAULT
    ).apply {
        description = "Confirmation de fin de téléchargement pour les fichiers générés dans Clovis."
    }

    gestionnaire.createNotificationChannel(canalStandard)
    gestionnaire.createNotificationChannel(canalUrgent)
    gestionnaire.createNotificationChannel(canalTelechargements)
}
