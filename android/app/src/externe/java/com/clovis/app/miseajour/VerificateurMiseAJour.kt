// Porte depuis clovis-mobile/android-legacy-natif (Lot 8, 23/08/2026) dans le
// plugin Capacitor (Lot 3B, 25/08/2026). Logique inchangee.
//
// Puisque "externe" n'est jamais sur le Play Store, pas de mise a jour
// automatique, ce module la remplace. Interroge l'API PUBLIQUE de GitHub
// Releases (pas besoin de token, le depot est public), compare a la version
// installee, et si plus recent, propose d'ouvrir le lien de telechargement.
//
// Ne fait PAS de telechargement/installation silencieux : ouvre simplement
// le navigateur vers la page de la release, l'etudiant garde la main.
package com.clovis.app.miseajour

import android.content.Context
import android.content.Intent
import android.net.Uri
import com.clovis.app.BuildConfig
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class ReleaseGitHub(
    val tag_name: String,
    val html_url: String,
    val assets: List<AssetGitHub> = emptyList()
)

@Serializable
data class AssetGitHub(
    val name: String,
    val browser_download_url: String
)

data class InfoMiseAJour(val version: String, val urlTelechargement: String, val urlPage: String)

object VerificateurMiseAJour {

    private const val URL_DERNIERE_RELEASE =
        "https://api.github.com/repos/petitboura/clovis-mobile/releases/latest"

    private val http = HttpClient(Android) {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
    }

    /** Renvoie les infos de mise a jour si une version plus recente existe, sinon null. */
    suspend fun verifier(): InfoMiseAJour? {
        val release: ReleaseGitHub = http.get(URL_DERNIERE_RELEASE).body()

        val versionDistante = release.tag_name.removePrefix("v")
        val versionInstallee = BuildConfig.VERSION_NAME.removeSuffix("-externe")

        if (!estPlusRecente(versionDistante, versionInstallee)) return null

        val apk = release.assets.firstOrNull { it.name.endsWith(".apk") } ?: return null

        return InfoMiseAJour(
            version = versionDistante,
            urlTelechargement = apk.browser_download_url,
            urlPage = release.html_url
        )
    }

    /** Compare deux versions "x.y.z" numeriquement (pas juste une egalite de chaines). */
    private fun estPlusRecente(distante: String, installee: String): Boolean {
        val partiesDistantes = distante.split(".").mapNotNull { it.toIntOrNull() }
        val partiesInstallees = installee.split(".").mapNotNull { it.toIntOrNull() }
        val taille = maxOf(partiesDistantes.size, partiesInstallees.size)
        for (i in 0 until taille) {
            val d = partiesDistantes.getOrElse(i) { 0 }
            val inst = partiesInstallees.getOrElse(i) { 0 }
            if (d != inst) return d > inst
        }
        return false
    }

    fun ouvrirTelechargement(context: Context, info: InfoMiseAJour) {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(info.urlTelechargement)))
    }
}
