// Cree le 04/09/2026, Bourama : equivalent iOS de IdentifiantAppareil.kt
// (Android) -- meme correction du bug "deux telephones du meme compte se
// melangent", voir clovis-backend/migrations/2026_09_04_appareil_id_ciblage.sql
// pour le detail cote serveur et IdentifiantAppareil.kt pour le
// raisonnement complet (identique ici).
//
// UserDefaults plutot que Keychain (comme StockageToken.swift) : cet
// identifiant n'est pas un secret, seulement une valeur stable a
// reutiliser tant que l'app reste installee -- pas besoin de la
// protection additionnelle du Keychain.
import Foundation
import UIKit

private let cleId = "clovis_appareil_id"
private let cleNomPersonnalise = "clovis_appareil_nom_personnalise"

enum IdentifiantAppareil {

    /// UUID stable pour cette installation, genere une seule fois puis reutilise.
    static func obtenirId() -> String {
        let defaults = UserDefaults.standard
        if let existant = defaults.string(forKey: cleId) {
            return existant
        }
        let nouvelId = UUID().uuidString
        defaults.set(nouvelId, forKey: cleId)
        return nouvelId
    }

    /// Nom du modele (ex. "iPhone"), utilise comme libelle par defaut si l'etudiant n'en a pas choisi.
    private static func libelleParDefaut() -> String {
        UIDevice.current.name
    }

    /// Libelle actuel de cet appareil : celui choisi par l'etudiant s'il existe, sinon le nom du telephone.
    static func obtenirNom() -> String {
        let defaults = UserDefaults.standard
        if let personnalise = defaults.string(forKey: cleNomPersonnalise), !personnalise.trimmingCharacters(in: .whitespaces).isEmpty {
            return personnalise
        }
        return libelleParDefaut()
    }

    /// true si l'etudiant a lui-meme choisi un nom (par opposition au nom par defaut).
    static func aUnNomPersonnalise() -> Bool {
        let defaults = UserDefaults.standard
        guard let personnalise = defaults.string(forKey: cleNomPersonnalise) else { return false }
        return !personnalise.trimmingCharacters(in: .whitespaces).isEmpty
    }

    /// Definit un libelle choisi par l'etudiant (ex. "Mon iPhone", "iPad d'Amadou").
    static func definirNomPersonnalise(_ nom: String) {
        UserDefaults.standard.set(nom.trimmingCharacters(in: .whitespaces), forKey: cleNomPersonnalise)
    }
}
