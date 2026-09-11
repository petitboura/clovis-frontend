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
    // Ajoute le 12/09/2026 : voir StockageToken.kt (Android, meme date) pour
    // le contexte complet du correctif.
    private static let compteTokenPush = "dernier_token_push_apns"

    private static func enregistrer(_ valeur: String, compte: String) {
        let donnees = Data(valeur.utf8)
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

    private static func lire(compte: String) -> String? {
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

    private static func effacer(compte: String) {
        let requete: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: compte
        ]
        SecItemDelete(requete as CFDictionary)
    }

    static func enregistrer(_ token: String) {
        enregistrer(token, compte: compte)
    }

    static func lire() -> String? {
        lire(compte: compte)
    }

    static func effacer() {
        effacer(compte: compte)
    }

    static func enregistrerTokenPush(_ tokenPush: String) {
        enregistrer(tokenPush, compte: compteTokenPush)
    }

    static func lireTokenPush() -> String? {
        lire(compte: compteTokenPush)
    }
}
