// Cree le 31/08/2026, Bourama : correction demandee - Temps d'ecran et
// Accessibilite affichaient le nom de paquet technique brut (ex.
// "com.whatsapp") a la place du vrai nom de l'app. Utilitaire partage
// (source set main, donc disponible sur les deux flavors play/externe)
// pour resoudre un nom de paquet vers { nomAffiche, icone } via
// PackageManager, et pour lister les apps installees utilisables par
// l'utilisateur (sert a construire un vrai selecteur d'apps cote
// Accessibilite, a la place de la saisie manuelle du nom de paquet).
package com.clovis.app.util

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import android.util.Base64
import java.io.ByteArrayOutputStream

object ResolveurApps {

    private const val TAILLE_ICONE_PX = 96

    data class AppResolue(val nomAffiche: String, val icone: String?)
    data class InfoApp(val nomPaquet: String, val nomAffiche: String, val icone: String?)

    /**
     * Resout un nom de paquet vers { nomAffiche, icone } (icone en data URI
     * PNG base64, ou null si le rendu de l'icone echoue). Si l'app n'est
     * plus installee (desinstallee depuis la mesure, cas frequent pour
     * l'historique de Temps d'ecran), on replie proprement sur le nom de
     * paquet lui-meme plutot que de faire planter l'appel.
     */
    fun resoudre(context: Context, nomPaquet: String): AppResolue {
        val pm = context.packageManager
        return try {
            val infos = pm.getApplicationInfo(nomPaquet, 0)
            AppResolue(
                nomAffiche = pm.getApplicationLabel(infos).toString(),
                icone = iconeEnBase64(pm.getApplicationIcon(infos))
            )
        } catch (e: PackageManager.NameNotFoundException) {
            AppResolue(nomAffiche = nomPaquet, icone = null)
        }
    }

    /**
     * Liste les apps installees "visibles" par l'utilisateur (celles avec
     * une icone de lancement, exclut donc les composants systeme internes
     * sans interface), triees par nom affiche, Clovis elle-meme exclue.
     * Necessite la declaration <queries> ACTION_MAIN/CATEGORY_LAUNCHER dans
     * le manifest du flavor "externe" (visibilite des paquets, Android 11+).
     */
    fun listerAppsInstallees(context: Context): List<InfoApp> {
        val pm = context.packageManager
        val intentLanceur = Intent(Intent.ACTION_MAIN, null).apply {
            addCategory(Intent.CATEGORY_LAUNCHER)
        }
        return pm.queryIntentActivities(intentLanceur, 0)
            .mapNotNull { resolveInfo ->
                val nomPaquet = resolveInfo.activityInfo?.packageName ?: return@mapNotNull null
                if (nomPaquet == context.packageName) return@mapNotNull null
                InfoApp(
                    nomPaquet = nomPaquet,
                    nomAffiche = resolveInfo.loadLabel(pm).toString(),
                    icone = iconeEnBase64(resolveInfo.loadIcon(pm))
                )
            }
            .distinctBy { it.nomPaquet }
            .sortedBy { it.nomAffiche.lowercase() }
    }

    private fun iconeEnBase64(drawable: Drawable): String? {
        return try {
            val bitmap = Bitmap.createBitmap(TAILLE_ICONE_PX, TAILLE_ICONE_PX, Bitmap.Config.ARGB_8888)
            val canevas = Canvas(bitmap)
            drawable.setBounds(0, 0, TAILLE_ICONE_PX, TAILLE_ICONE_PX)
            drawable.draw(canevas)
            val flux = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, flux)
            "data:image/png;base64," + Base64.encodeToString(flux.toByteArray(), Base64.NO_WRAP)
        } catch (e: Exception) {
            null
        }
    }
}
