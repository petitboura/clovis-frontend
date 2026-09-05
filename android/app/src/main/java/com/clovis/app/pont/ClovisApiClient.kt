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
import io.ktor.client.request.forms.formData
import io.ktor.client.request.forms.submitFormWithBinaryData
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.http.ContentType
import io.ktor.http.Headers
import io.ktor.http.HttpHeaders
import io.ktor.http.append
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
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
data class CorpsTokenPush(val plateforme: String, val token: String, val appareil_id: String? = null)

// Lot 2 (suite, 26/08/2026) : miroir des dossiers designes cote backend,
// voir clovis-backend/core/dossiers_designes_mobile.py, uniquement les
// NOMS, jamais l'URI (propre a l'appareil, sans sens cote serveur).
//
// Modifie le 04/09/2026, Bourama : ajoute appareil_id + appareil_nom
// (voir IdentifiantAppareil.kt) -- avant cette date, deux telephones
// Android du meme compte partageaient le meme "seau" cote backend
// (indexe seulement par plateforme) et s'ecrasaient mutuellement.
@Serializable
data class CorpsSynchronisationDossiers(
    val plateforme: String,
    val appareil_id: String,
    val appareil_nom: String?,
    val noms: List<String>
)

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

    suspend fun enregistrerTokenPush(plateforme: String, token: String, appareilId: String): HttpResponse {
        return http.post("$BASE_URL/api/appareils-mobiles/push-token") {
            avecAuth(this)
            contentType(ContentType.Application.Json)
            setBody(CorpsTokenPush(plateforme, token, appareilId))
        }
    }

    suspend fun synchroniserDossiers(appareilId: String, appareilNom: String?, noms: List<String>): HttpResponse {
        return http.post("$BASE_URL/api/appareils-mobiles/dossiers") {
            avecAuth(this)
            contentType(ContentType.Application.Json)
            setBody(CorpsSynchronisationDossiers("android", appareilId, appareilNom, noms))
        }
    }

    // Ajoute le 04/09/2026, Bourama : vectorisation en masse des dossiers
    // designes -- transfert brut de chaque fichier (multipart), voir
    // clovis-backend/api/dossiers_designes.py. `chemin` (sous-dossiers
    // traverses, jamais le nom du fichier) est envoye en JSON, tel
    // qu'attendu cote serveur (Form(...), decode avec json.loads).
    suspend fun uploaderFichierDossierDesigne(
        dossierNom: String,
        chemin: List<String>,
        nomFichier: String,
        typeMime: String,
        contenu: ByteArray
    ): HttpResponse {
        return http.submitFormWithBinaryData(
            url = "$BASE_URL/api/dossiers-designes/upload",
            formData = formData {
                append("dossier_nom", dossierNom)
                append("plateforme", "android")
                append("chemin", Json.encodeToString(chemin))
                append("fichier", contenu, Headers.build {
                    append(HttpHeaders.ContentType, typeMime)
                    append(HttpHeaders.ContentDisposition, "filename=\"$nomFichier\"")
                })
            }
        ) {
            avecAuth(this)
        }
    }

    suspend fun obtenirActionsEnAttente(appareilId: String): ReponseActionsEnAttente {
        val reponse: HttpResponse = http.get("$BASE_URL/api/appareils-mobiles/actions/en-attente") {
            avecAuth(this)
            parameter("appareil_id", appareilId)
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
