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

// Lot 2 (suite, 26/08/2026) : miroir des dossiers designes cote backend,
// voir clovis-backend/core/dossiers_designes_mobile.py, uniquement les
// NOMS, jamais l'URI (propre a l'appareil, sans sens cote serveur).
@Serializable
data class CorpsSynchronisationDossiers(val plateforme: String, val noms: List<String>)

// : Lot 5 : connecteurs tiers (Notion), porte le 25/08/2026 
@Serializable
data class UrlAutorisationNotion(val url_autorisation: String)
@Serializable
data class FinalisationNotion(val code: String, val state: String)
@Serializable
data class ReponseFinalisationNotion(val connecte: Boolean, val espace: String? = null)
@Serializable
data class StatutNotion(val connecte: Boolean)
@Serializable
data class ResultatNotion(val id: String, val type: String, val url: String? = null)
@Serializable
data class ReponseRechercheNotion(val resultats: List<ResultatNotion>)

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

    suspend fun synchroniserDossiers(noms: List<String>): HttpResponse {
        return http.post("$BASE_URL/api/appareils-mobiles/dossiers") {
            avecAuth(this)
            contentType(ContentType.Application.Json)
            setBody(CorpsSynchronisationDossiers("android", noms))
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

    // : Lot 5 : connecteurs tiers (Notion), porte le 25/08/2026 

    suspend fun demarrerConnexionNotion(): UrlAutorisationNotion {
        val reponse: HttpResponse = http.post("$BASE_URL/api/appareils-mobiles/connecteurs/notion/demarrer") {
            avecAuth(this)
        }
        return reponse.body()
    }

    suspend fun finaliserConnexionNotion(code: String, state: String): ReponseFinalisationNotion {
        val reponse: HttpResponse = http.post("$BASE_URL/api/appareils-mobiles/connecteurs/notion/finaliser") {
            avecAuth(this)
            contentType(ContentType.Application.Json)
            setBody(FinalisationNotion(code, state))
        }
        return reponse.body()
    }

    suspend fun statutNotion(): StatutNotion {
        val reponse: HttpResponse = http.get("$BASE_URL/api/appareils-mobiles/connecteurs/notion/statut") {
            avecAuth(this)
        }
        return reponse.body()
    }

    suspend fun rechercherNotion(requete: String): ReponseRechercheNotion {
        val reponse: HttpResponse = http.get("$BASE_URL/api/appareils-mobiles/connecteurs/notion/rechercher?q=$requete") {
            avecAuth(this)
        }
        return reponse.body()
    }
}
