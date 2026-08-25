// Cree le 23/08/2026 (Lot 1, clovis-mobile), porte le 25/08/2026 dans le
// plugin Capacitor (Lot 3B). Meme canal dedie que cote Android, voir
// clovis-backend/api/appareils_mobiles.py. Difference avec la version
// legacy : requeteAuthentifiee lit le token via StockageToken (Keychain,
// alimente par PontNatifPlugin.enregistrerToken depuis le JS) au lieu de
// SupabaseAuthClient.accessTokenCourant() (auth native supprimee, voir
// StockageToken.swift).
import Foundation

struct EntreeUsage: Codable {
    let nom_app: String
    let date: String
    let duree_secondes: Int
}

struct SynchronisationUsage: Codable {
    let plateforme: String
    let entrees: [EntreeUsage]
}

struct LigneUsage: Codable {
    let plateforme: String
    let nom_app: String
    let date: String
    let duree_secondes: Int
}

struct ReponseUsage: Codable {
    let usage: [LigneUsage]
}

// MARK: Lot 5, connecteurs tiers (Notion)

struct UrlAutorisationNotion: Codable {
    let url_autorisation: String
}

struct FinalisationNotion: Codable {
    let code: String
    let state: String
}

struct ReponseFinalisationNotion: Codable {
    let connecte: Bool
    let espace: String?
}

struct StatutNotion: Codable {
    let connecte: Bool
}

struct ResultatNotion: Codable, Identifiable {
    let id: String
    let type: String
    let url: String?
}

struct ReponseRechercheNotion: Codable {
    let resultats: [ResultatNotion]
}

// MARK: Lot 3, notifications push natives

struct TokenPush: Codable {
    let plateforme: String
    let token: String
}

// MARK: Lot 1B, recepteur d'actions

struct ActionAppareil: Codable {
    let id: String
    let type_action: String
}

struct ReponseActionsEnAttente: Codable {
    let actions: [ActionAppareil]
}

struct ResultatAction: Codable {
    let succes: Bool
    let resultat: String
}

enum ClovisApiClient {
    static let baseURL = "https://clovis-backend-production.up.railway.app"

    enum ErreurClient: Error {
        case pasDeSession
    }

    private static func requeteAuthentifiee(_ url: URL, methode: String) throws -> URLRequest {
        guard let token = StockageToken.lire() else {
            throw ErreurClient.pasDeSession
        }
        var requete = URLRequest(url: url)
        requete.httpMethod = methode
        requete.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        requete.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return requete
    }

    static func synchroniserUsage(_ payload: SynchronisationUsage) async throws {
        let url = URL(string: "\(baseURL)/api/appareils-mobiles/usage")!
        var requete = try requeteAuthentifiee(url, methode: "POST")
        requete.httpBody = try JSONEncoder().encode(payload)
        _ = try await URLSession.shared.data(for: requete)
    }

    static func obtenirUsage(jours: Int = 7) async throws -> ReponseUsage {
        let url = URL(string: "\(baseURL)/api/appareils-mobiles/usage?jours=\(jours)")!
        let requete = try requeteAuthentifiee(url, methode: "GET")
        let (data, _) = try await URLSession.shared.data(for: requete)
        return try JSONDecoder().decode(ReponseUsage.self, from: data)
    }

    static func demarrerConnexionNotion() async throws -> UrlAutorisationNotion {
        let url = URL(string: "\(baseURL)/api/appareils-mobiles/connecteurs/notion/demarrer")!
        let requete = try requeteAuthentifiee(url, methode: "POST")
        let (data, _) = try await URLSession.shared.data(for: requete)
        return try JSONDecoder().decode(UrlAutorisationNotion.self, from: data)
    }

    static func finaliserConnexionNotion(code: String, state: String) async throws -> ReponseFinalisationNotion {
        let url = URL(string: "\(baseURL)/api/appareils-mobiles/connecteurs/notion/finaliser")!
        var requete = try requeteAuthentifiee(url, methode: "POST")
        requete.httpBody = try JSONEncoder().encode(FinalisationNotion(code: code, state: state))
        let (data, _) = try await URLSession.shared.data(for: requete)
        return try JSONDecoder().decode(ReponseFinalisationNotion.self, from: data)
    }

    static func statutNotion() async throws -> StatutNotion {
        let url = URL(string: "\(baseURL)/api/appareils-mobiles/connecteurs/notion/statut")!
        let requete = try requeteAuthentifiee(url, methode: "GET")
        let (data, _) = try await URLSession.shared.data(for: requete)
        return try JSONDecoder().decode(StatutNotion.self, from: data)
    }

    static func rechercherNotion(_ requeteTexte: String) async throws -> ReponseRechercheNotion {
        var composants = URLComponents(string: "\(baseURL)/api/appareils-mobiles/connecteurs/notion/rechercher")!
        composants.queryItems = [URLQueryItem(name: "q", value: requeteTexte)]
        let requete = try requeteAuthentifiee(composants.url!, methode: "GET")
        let (data, _) = try await URLSession.shared.data(for: requete)
        return try JSONDecoder().decode(ReponseRechercheNotion.self, from: data)
    }

    static func enregistrerPushToken(_ payload: TokenPush) async throws {
        let url = URL(string: "\(baseURL)/api/appareils-mobiles/push-token")!
        var requete = try requeteAuthentifiee(url, methode: "POST")
        requete.httpBody = try JSONEncoder().encode(payload)
        _ = try await URLSession.shared.data(for: requete)
    }

    // Ajoute le 25/08/2026, Lot 1B porte : recepteur d'actions distantes,
    // meme role qu'ActionsAppareilExecuteur.kt (Android).
    static func obtenirActionsEnAttente() async throws -> ReponseActionsEnAttente {
        let url = URL(string: "\(baseURL)/api/appareils-mobiles/actions/en-attente")!
        let requete = try requeteAuthentifiee(url, methode: "GET")
        let (data, _) = try await URLSession.shared.data(for: requete)
        return try JSONDecoder().decode(ReponseActionsEnAttente.self, from: data)
    }

    static func obtenirAction(_ actionId: String) async throws -> ActionAppareil {
        let url = URL(string: "\(baseURL)/api/appareils-mobiles/actions/\(actionId)")!
        let requete = try requeteAuthentifiee(url, methode: "GET")
        let (data, _) = try await URLSession.shared.data(for: requete)
        return try JSONDecoder().decode(ActionAppareil.self, from: data)
    }

    static func rapporterResultatAction(_ actionId: String, resultat: ResultatAction) async throws {
        let url = URL(string: "\(baseURL)/api/appareils-mobiles/actions/\(actionId)/resultat")!
        var requete = try requeteAuthentifiee(url, methode: "POST")
        requete.httpBody = try JSONEncoder().encode(resultat)
        _ = try await URLSession.shared.data(for: requete)
    }
}
