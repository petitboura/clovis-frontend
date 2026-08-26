// Cree le 24/08/2026 (Lot 1B, clovis-mobile), porte le 25/08/2026 dans le
// plugin Capacitor (Lot 3B), iOS. Etendu le 26/08/2026 : brancher le
// cerveau -- voir clovis-backend/core/serveur_mcp_generation.py::
// executer_action_mobile pour la liste exacte des type_action et la
// forme de `parametres` attendue par l'agent. CE FICHIER DOIT RESTER EN
// MIROIR EXACT de TYPES_ACTION_MOBILE_VALIDES cote backend (a l'exception
// des "accessibilite_*", qui n'ont AUCUN equivalent sur iOS -- Apple
// n'autorise pas l'automatisation arbitraire d'UI tierce comme
// l'AccessibilityService Android, ce n'est pas un oubli).
import Foundation
import os.log

enum ActionsAppareilExecuteur {

    private static let log = OSLog(subsystem: "ai.clovis.pont", category: "ActionsAppareil")

    static func executerAction(actionId: String) async {
        let action: ActionAppareil
        do {
            action = try await ClovisApiClient.obtenirAction(actionId)
        } catch {
            os_log("Echec recuperation action %{public}@, abandon (pas de retry ici).", log: log, type: .default, actionId)
            return
        }

        let resultat = dispatcher(typeAction: action.type_action, parametres: action.parametres)

        do {
            try await ClovisApiClient.rapporterResultatAction(actionId, resultat: resultat)
        } catch {
            os_log("Echec rapport resultat pour action %{public}@ (pas de retry ici).", log: log, type: .default, actionId)
        }
    }

    /// Un seul essai, jamais de boucle de reessai a l'aveugle (meme regle
    /// que cote Android).
    private static func dispatcher(typeAction: String, parametres: [String: String]) -> ResultatAction {
        func dossierParNom(_ nom: String) -> DossierDesigne? {
            DossiersDesignesRepository.listerDossiersDesignes().first { $0.url.lastPathComponent == nom }
        }
        func elementParNom(_ dossier: URL, _ nom: String) -> ElementDossier? {
            DossiersDesignesRepository.listerContenu(dossier).first { $0.nom == nom }
        }
        func resultatBooleen(_ succes: Bool, _ messageSucces: String, _ messageEchec: String) -> ResultatAction {
            ResultatAction(succes: succes, resultat: succes ? messageSucces : messageEchec)
        }

        switch typeAction {
        case "dossier_creer_fichier":
            guard let dossierNom = parametres["dossier_nom"], let nom = parametres["nom"] else {
                return ResultatAction(succes: false, resultat: "Paramètres manquants (dossier_nom, nom).")
            }
            guard let dossier = dossierParNom(dossierNom) else {
                return ResultatAction(succes: false, resultat: "Dossier \"\(dossierNom)\" introuvable (a peut-être été retiré).")
            }
            // Note : pas de gestion de type_mime cote iOS (limite existante de
            // DossiersDesignesRepository.creerFichier, pas ajoutee par ce lot).
            let succes = DossiersDesignesRepository.creerFichier(dansParent: dossier.url, nom: nom)
            return resultatBooleen(succes, "Fichier \"\(nom)\" créé dans \"\(dossierNom)\".", "Échec de la création de \"\(nom)\" dans \"\(dossierNom)\".")

        case "dossier_creer_sous_dossier":
            guard let dossierNom = parametres["dossier_nom"], let nom = parametres["nom"] else {
                return ResultatAction(succes: false, resultat: "Paramètres manquants (dossier_nom, nom).")
            }
            guard let dossier = dossierParNom(dossierNom) else {
                return ResultatAction(succes: false, resultat: "Dossier \"\(dossierNom)\" introuvable (a peut-être été retiré).")
            }
            let succes = DossiersDesignesRepository.creerSousDossier(dansParent: dossier.url, nom: nom)
            return resultatBooleen(succes, "Sous-dossier \"\(nom)\" créé dans \"\(dossierNom)\".", "Échec de la création du sous-dossier \"\(nom)\" dans \"\(dossierNom)\".")

        case "dossier_renommer":
            guard let dossierNom = parametres["dossier_nom"], let elementNom = parametres["element_nom"], let nouveauNom = parametres["nouveau_nom"] else {
                return ResultatAction(succes: false, resultat: "Paramètres manquants (dossier_nom, element_nom, nouveau_nom).")
            }
            guard let dossier = dossierParNom(dossierNom) else {
                return ResultatAction(succes: false, resultat: "Dossier \"\(dossierNom)\" introuvable (a peut-être été retiré).")
            }
            guard let element = elementParNom(dossier.url, elementNom) else {
                return ResultatAction(succes: false, resultat: "\"\(elementNom)\" introuvable dans \"\(dossierNom)\".")
            }
            let succes = DossiersDesignesRepository.renommer(element.url, nouveauNom: nouveauNom)
            return resultatBooleen(succes, "\"\(elementNom)\" renommé en \"\(nouveauNom)\".", "Échec du renommage de \"\(elementNom)\".")

        case "dossier_supprimer":
            guard let dossierNom = parametres["dossier_nom"], let elementNom = parametres["element_nom"] else {
                return ResultatAction(succes: false, resultat: "Paramètres manquants (dossier_nom, element_nom).")
            }
            guard let dossier = dossierParNom(dossierNom) else {
                return ResultatAction(succes: false, resultat: "Dossier \"\(dossierNom)\" introuvable (a peut-être été retiré).")
            }
            guard let element = elementParNom(dossier.url, elementNom) else {
                return ResultatAction(succes: false, resultat: "\"\(elementNom)\" introuvable dans \"\(dossierNom)\".")
            }
            let succes = DossiersDesignesRepository.supprimer(element.url)
            return resultatBooleen(succes, "\"\(elementNom)\" supprimé de \"\(dossierNom)\".", "Échec de la suppression de \"\(elementNom)\".")

        case "dossier_deplacer":
            guard let dossierNom = parametres["dossier_nom"], let elementNom = parametres["element_nom"], let nouveauDossierNom = parametres["nouveau_dossier_nom"] else {
                return ResultatAction(succes: false, resultat: "Paramètres manquants (dossier_nom, element_nom, nouveau_dossier_nom).")
            }
            guard let dossier = dossierParNom(dossierNom) else {
                return ResultatAction(succes: false, resultat: "Dossier \"\(dossierNom)\" introuvable (a peut-être été retiré).")
            }
            guard let nouveauDossier = dossierParNom(nouveauDossierNom) else {
                return ResultatAction(succes: false, resultat: "Dossier de destination \"\(nouveauDossierNom)\" introuvable.")
            }
            guard let element = elementParNom(dossier.url, elementNom) else {
                return ResultatAction(succes: false, resultat: "\"\(elementNom)\" introuvable dans \"\(dossierNom)\".")
            }
            let succes = DossiersDesignesRepository.deplacer(element.url, versParent: nouveauDossier.url)
            return resultatBooleen(succes, "\"\(elementNom)\" déplacé de \"\(dossierNom)\" vers \"\(nouveauDossierNom)\".", "Échec du déplacement de \"\(elementNom)\".")

        case "accessibilite_cliquer", "accessibilite_saisir":
            return ResultatAction(succes: false, resultat: "Accessibilité non disponible sur iOS (pas d'équivalent à l'AccessibilityService Android).")

        default:
            return ResultatAction(succes: false, resultat: "type_action \"\(typeAction)\" non reconnu par l'app.")
        }
    }
}
