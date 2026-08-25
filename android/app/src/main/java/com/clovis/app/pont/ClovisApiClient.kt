// Cree le 25/08/2026, Bourama : Lot 3B Partie 3 mobile (fusion Capacitor).
// Porte depuis clovis-mobile/android/.../data/ClovisApiClient.kt (Lot 1,
// etendu Lot 1A/3/5) : MEME BASE_URL, meme contrat de routes cote
// clovis-backend, seule la source du token change (StockageToken, pas
// SupabaseAuthClient natif ; voir ce fichier pour le pourquoi).
package com.clovis.app.pont

import android.content.Context
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

private const val BASE_URL = "https://clovis-backend-production.up.railway.app"

@Serializable
data class ActionAppareil(
    val id: String,
    val type_action: String,
    val parametres: JsonObject = JsonObject(emptyMap())
)

@Serializable
data class ReponseActionsEnAttente(val actions: List<ActionAppareil>)

@Serializable
data class ResultatAction(val succes: Boolean, val resultat: String = "")

@Serializable
data class CorpsTokenPush(val plateforme: String, val token: String)

class ClovisApiClient(private val context: Context) {

    private val http = HttpClient(Android) {
        install(ContentNegotiation) { json() }
    }

    private fun avecAuth(builder: io.ktor.client.request.HttpRequestBuilder) {
        StockageToken.lire(context)?.let { token ->
            builder.header("Authorization", "Bearer $token")
        }
    }

    suspend fun enregistrerTokenPush(plateforme: String, token: String): HttpResponse {
        return http.post("$BASE_URL/api/appareils-mobiles/push-token") {
            avecAuth(this)
            contentType(ContentType.Application.Json)
            setBody(CorpsTokenPush(plateforme, token))
        }
    }

    suspend fun obtenirActionsEnAttente(): ReponseActionsEnAttente {
        val reponse: HttpResponse = http.get("$BASE_URL/api/appareils-mobiles/actions/en-attente") {
            avecAuth(this)
        }
        return reponse.body()
    }

    suspend fun obtenirAction(actionId: String): ActionAppareil {
        val reponse: HttpResponse = http.get("$BASE_URL/api/appareils-mobiles/actions/$actionId") {
            avecAuth(this)
        }
        return reponse.body()
    }

    suspend fun rapporterResultatAction(actionId: String, resultat: ResultatAction): HttpResponse {
        return http.post("$BASE_URL/api/appareils-mobiles/actions/$actionId/resultat") {
            avecAuth(this)
            contentType(ContentType.Application.Json)
            setBody(resultat)
        }
    }
}
