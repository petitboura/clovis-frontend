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

// MARK: Lot 2 (suite, 26/08/2026), miroir des dossiers designes

struct SynchronisationDossiers: Codable {
    let plateforme: String
    let noms: [String]
}

// MARK: Lot 1B, recepteur d'actions

// "chemin"/"nouveau_chemin" (01/09/2026) envoient une liste de chaines,
// alors que tous les autres parametres restent de simples chaines --
// remplace le [String:String] d'origine (voir commentaire historique
// ci-dessous) par ce type generique, plutot que d'avaler l'erreur en
// silence comme avant.
enum ValeurParametre: Codable {
    case texte(String)
    case liste([String])

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let s = try? c.decode(String.self) {
            self = .texte(s)
        } else {
            self = .liste(try c.decode([String].self))
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .texte(let s): try c.encode(s)
        case .liste(let l): try c.encode(l)
        }
    }

    var commeTexte: String? {
        if case .texte(let s) = self { return s }
        return nil
    }

    var commeListe: [String]? {
        if case .liste(let l) = self { return l }
        return nil
    }
}

struct ActionAppareil: Codable {
    let id: String
    let type_action: String
    // Ajoute le 26/08/2026 : brancher le cerveau, toutes les valeurs de
    // parametres etaient des chaines pour les type_action d'alors
    // (dossier_*, accessibilite_*). Etendu le 01/09/2026 (voir
    // ValeurParametre) : "chemin"/"nouveau_chemin" ajoutent des listes.
    var parametres: [String: ValeurParametre] = [:]

    private enum CodingKeys: String, CodingKey {
        case id, type_action, parametres
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        type_action = try c.decode(String.self, forKey: .type_action)
        parametres = (try? c.decode([String: ValeurParametre].self, forKey: .parametres)) ?? [:]
    }
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

    // Ajoute le 26/08/2026 : miroir cote backend des dossiers designes,
    // voir clovis-backend/core/dossiers_designes_mobile.py, uniquement
    // les noms, jamais le bookmark reel.
    static func synchroniserDossiers(_ noms: [String]) async throws {
        let url = URL(string: "\(baseURL)/api/appareils-mobiles/dossiers")!
        var requete = try requeteAuthentifiee(url, methode: "POST")
        requete.httpBody = try JSONEncoder().encode(SynchronisationDossiers(plateforme: "ios", noms: noms))
        _ = try await URLSession.shared.data(for: requete)
    }

    // Ajoute le 04/09/2026, Bourama : vectorisation en masse des dossiers
    // designes -- transfert brut de chaque fichier (multipart construit a
    // la main, URLSession n'a pas d'equivalent de submitFormWithBinaryData
    // de Ktor cote Android), voir clovis-backend/api/dossiers_designes.py.
    // `chemin` (sous-dossiers traverses, jamais le nom du fichier) est
    // envoye en JSON, tel qu'attendu cote serveur (Form(...), decode avec
    // json.loads).
    static func uploaderFichierDossierDesigne(
        dossierNom: String,
        chemin: [String],
        nomFichier: String,
        typeMime: String,
        contenu: Data
    ) async throws {
        let url = URL(string: "\(baseURL)/api/dossiers-designes/upload")!
        var requete = try requeteAuthentifiee(url, methode: "POST")
        let frontiere = "Boundary-\(UUID().uuidString)"
        requete.setValue("multipart/form-data; boundary=\(frontiere)", forHTTPHeaderField: "Content-Type")

        var corps = Data()
        func ajouterChamp(_ nom: String, _ valeur: String) {
            corps.append("--\(frontiere)\r\n".data(using: .utf8)!)
            corps.append("Content-Disposition: form-data; name=\"\(nom)\"\r\n\r\n".data(using: .utf8)!)
            corps.append("\(valeur)\r\n".data(using: .utf8)!)
        }
        ajouterChamp("dossier_nom", dossierNom)
        ajouterChamp("plateforme", "ios")
        let cheminJson = (try? JSONEncoder().encode(chemin)).flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
        ajouterChamp("chemin", cheminJson)

        corps.append("--\(frontiere)\r\n".data(using: .utf8)!)
        corps.append("Content-Disposition: form-data; name=\"fichier\"; filename=\"\(nomFichier)\"\r\n".data(using: .utf8)!)
        corps.append("Content-Type: \(typeMime)\r\n\r\n".data(using: .utf8)!)
        corps.append(contenu)
        corps.append("\r\n".data(using: .utf8)!)
        corps.append("--\(frontiere)--\r\n".data(using: .utf8)!)

        requete.httpBody = corps
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
