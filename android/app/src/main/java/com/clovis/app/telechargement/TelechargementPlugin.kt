// Créé le 12/09/2026, demande Bourama : "les boutons téléchargement
// partout où ils sont doivent déclencher un vrai téléchargement... comme
// si tu télécharges une musique ou une vidéo". Deux méthodes :
//
//   depuisUrl({ url, nom })          -- délègue à l'API système
//     DownloadManager (identique à un téléchargement de musique/vidéo :
//     notification de progression, son à la fin, fichier rangé dans
//     Téléchargements/Fichiers). Utilisé pour tout ce qui a déjà une URL
//     (bibliothèque, PDF, fichiers/images/médias du chat).
//
//   depuisContenuLocal({ base64, nom, typeMime }) -- pour le contenu qui
//     n'existe QUE côté client (texte déjà en mémoire, PNG généré) : pas
//     d'URL à donner à DownloadManager, donc écriture directe dans la
//     collection MediaStore.Downloads (API 29+, aucune permission de
//     stockage requise -- DownloadManager.addCompletedDownload est
//     dépréciée au profit de MediaStore depuis Android 10) puis
//     notification de fin manuelle (canal "telechargements", voir
//     CanalNotifications.kt) pour le même rendu perçu qu'un vrai
//     téléchargement. Sur API < 29 (rare, minSdk 26), rejette : le côté
//     JS (lib/telecharger.ts) se rabat alors sur le partage natif
//     existant.
//
// Côté JS : voir lib/telecharger.ts (point d'entrée unique, gère aussi le
// repli web/iOS).
package com.clovis.app.telechargement

import android.app.DownloadManager
import android.app.PendingIntent
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.clovis.app.notifications.CANAL_TELECHARGEMENTS
import com.clovis.app.notifications.NotificationsNatives
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlin.random.Random

@CapacitorPlugin(name = "Telechargement")
class TelechargementPlugin : Plugin() {

    @PluginMethod
    fun depuisUrl(call: PluginCall) {
        val url = call.getString("url")
        val nom = call.getString("nom")
        if (url == null || nom == null) {
            call.reject("Paramètres 'url' et 'nom' requis.")
            return
        }
        try {
            val gestionnaire = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val requete = DownloadManager.Request(Uri.parse(url))
                .setTitle(nom)
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, nom)
                .setAllowedOverMetered(true)
                .setAllowedOverRoaming(true)
            val id = gestionnaire.enqueue(requete)
            call.resolve(JSObject().put("id", id.toString()))
        } catch (e: Exception) {
            call.reject("Échec du téléchargement : ${e.message}", e)
        }
    }

    @PluginMethod
    fun depuisContenuLocal(call: PluginCall) {
        val base64 = call.getString("base64")
        val nom = call.getString("nom")
        val typeMime = call.getString("typeMime") ?: "application/octet-stream"
        if (base64 == null || nom == null) {
            call.reject("Paramètres 'base64' et 'nom' requis.")
            return
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.reject("MediaStore.Downloads indisponible avant Android 10.")
            return
        }
        try {
            val octets = Base64.decode(base64, Base64.DEFAULT)
            val resolveur = context.contentResolver
            val valeurs = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, nom)
                put(MediaStore.Downloads.MIME_TYPE, typeMime)
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
            val uri = resolveur.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, valeurs)
                ?: throw IllegalStateException("Échec de la création de l'entrée MediaStore.")
            resolveur.openOutputStream(uri)?.use { it.write(octets) }
                ?: throw IllegalStateException("Impossible d'ouvrir le flux d'écriture.")
            valeurs.clear()
            valeurs.put(MediaStore.Downloads.IS_PENDING, 0)
            resolveur.update(uri, valeurs, null, null)

            afficherNotificationTerminee(nom, uri)
            call.resolve(JSObject().put("succes", true))
        } catch (e: Exception) {
            call.reject("Échec de l'écriture MediaStore : ${e.message}", e)
        }
    }

    // Notification manuelle (pas celle de DownloadManager, inutilisé ici
    // puisqu'il n'y a pas d'URL réseau à télécharger) -- tap pour rouvrir
    // le fichier directement, même geste qu'un téléchargement système.
    private fun afficherNotificationTerminee(nom: String, uri: Uri) {
        if (!NotificationsNatives.permissionNotificationsAccordee(context)) return

        val intentOuverture = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, context.contentResolver.getType(uri))
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        val pending = PendingIntent.getActivity(
            context, Random.nextInt(), intentOuverture,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CANAL_TELECHARGEMENTS)
            .setContentTitle("Téléchargement terminé")
            .setContentText(nom)
            .setSmallIcon(com.clovis.app.R.drawable.ic_clovis_notification)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build()

        NotificationManagerCompat.from(context).notify(Random.nextInt(), notification)
    }
}
