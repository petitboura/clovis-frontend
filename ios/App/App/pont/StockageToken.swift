// Cree le 25/08/2026, Bourama : Lot 3B Partie 3 mobile (fusion Capacitor), iOS.
// Equivalent exact de StockageToken.kt (Android, meme lot) : Keychain plutot
// que EncryptedSharedPreferences, meme role.
//
// Choix d'architecture (identique Android) : contrairement au socle natif
// clovis-mobile (SupabaseAuthClient.swift, sa PROPRE auth Supabase native),
// ce plugin n'authentifie plus rien lui-meme, l'utilisateur est deja
// connecte cote WEB (clovis-frontend, dans la WKWebView Capacitor). Le pont
// recoit le token d'acces directement du JS et le garde dans le Keychain
// (chiffre par le systeme), necessaire pour que les notifications push
// puissent appeler clovis-backend meme app fermee.
import Foundation
import Security

enum StockageToken {

    private static let service = "ai.clovis.pont"
    private static let compte = "supabase_access_token"

    static func enregistrer(_ token: String) {
        let donnees = Data(token.utf8)
        let requeteSuppression: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: compte
        ]
        SecItemDelete(requeteSuppression as CFDictionary)

        let requeteAjout: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: compte,
            kSecValueData as String: donnees,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock
        ]
        SecItemAdd(requeteAjout as CFDictionary, nil)
    }

    static func lire() -> String? {
        let requete: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: compte,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var resultat: AnyObject?
        let statut = SecItemCopyMatching(requete as CFDictionary, &resultat)
        guard statut == errSecSuccess, let donnees = resultat as? Data else { return nil }
        return String(data: donnees, encoding: .utf8)
    }

    static func effacer() {
        let requete: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: compte
        ]
        SecItemDelete(requete as CFDictionary)
    }
}
