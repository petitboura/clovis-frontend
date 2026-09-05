// Cree le 24/08/2026 (Lot 1B, clovis-mobile), porte le 25/08/2026 dans le
// plugin Capacitor (Lot 3B), iOS. Etendu le 26/08/2026 : brancher le
// cerveau, voir clovis-backend/core/serveur_mcp_generation.py::
// executer_action_mobile pour la liste exacte des type_action et la
// forme de `parametres` attendue par l'agent. CE FICHIER DOIT RESTER EN
// MIROIR EXACT de TYPES_ACTION_MOBILE_VALIDES cote backend (a l'exception
// des "accessibilite_*", qui n'ont AUCUN equivalent sur iOS, Apple
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

    private enum ResolutionEmplacement {
        case succes(URL, String)
        case echec(String)
    }

    /// Un seul essai, jamais de boucle de reessai a l'aveugle (meme regle
    /// que cote Android).
    private static func dispatcher(typeAction: String, parametres: [String: ValeurParametre]) -> ResultatAction {
        func texte(_ cle: String) -> String? { parametres[cle]?.commeTexte }
        func liste(_ cle: String) -> [String] { parametres[cle]?.commeListe ?? [] }

        // Correctif 05/09/2026 (Bourama) : filet de securite si le modele
        // laisse malgre tout trainer un suffixe de plateforme du type
        // " (android)"/" (ios)" dans dossier_nom (ne devrait plus arriver
        // depuis le nouveau format de lister_dossiers cote backend, mais on
        // ne fait jamais confiance aveuglement a un texte genere par le
        // modele). Egalite stricte d'abord, retente sans le suffixe ensuite.
        let suffixesPlateforme = [" (android)", " (ios)"]
        func dossierParNom(_ nom: String) -> DossierDesigne? {
            let dossiers = DossiersDesignesRepository.listerDossiersDesignes()
            if let exact = dossiers.first(where: { $0.url.lastPathComponent == nom }) {
                return exact
            }
            guard let suffixe = suffixesPlateforme.first(where: { nom.lowercased().hasSuffix($0) }) else {
                return nil
            }
            let nomSansSuffixe = String(nom.dropLast(suffixe.count))
            return dossiers.first { $0.url.lastPathComponent == nomSansSuffixe }
        }
        // Descend "chemin" (sous-dossiers PARENTS uniquement) depuis
        // racine, niveau par niveau -- miroir exact de dossierParChemin
        // cote Android. Profondeur illimitee, chemin vide -> racine.
        func dossierParChemin(_ racine: URL, _ chemin: [String]) -> URL? {
            var courant = racine
            for segment in chemin {
                guard let enfant = DossiersDesignesRepository.listerContenu(courant).first(where: { $0.estDossier && $0.nom == segment }) else {
                    return nil
                }
                courant = enfant.url
            }
            return courant
        }
        func elementParNom(_ dossier: URL, _ nom: String) -> ElementDossier? {
            DossiersDesignesRepository.listerContenu(dossier).first { $0.nom == nom }
        }
        func resultatBooleen(_ succes: Bool, _ messageSucces: String, _ messageEchec: String) -> ResultatAction {
            ResultatAction(succes: succes, resultat: succes ? messageSucces : messageEchec)
        }
        // Resout dossierNom + chemin (cleChemin, optionnel) en une URL et
        // un libelle lisible ("Cours/Maths") pour les messages. Enum dedie
        // (pas Result<_, String>, String n'est pas conforme a Error).
        func resoudreEmplacement(_ dossierNom: String, _ cleChemin: String) -> ResolutionEmplacement {
            guard let dossier = dossierParNom(dossierNom) else {
                return .echec("Dossier \"\(dossierNom)\" introuvable (a peut-être été retiré).")
            }
            let chemin = liste(cleChemin)
            if chemin.isEmpty { return .succes(dossier.url, dossierNom) }
            guard let url = dossierParChemin(dossier.url, chemin) else {
                return .echec("Sous-dossier introuvable dans \"\(dossierNom)/\(chemin.joined(separator: "/"))\".")
            }
            return .succes(url, "\(dossierNom)/\(chemin.joined(separator: "/"))")
        }

        switch typeAction {
        case "dossier_creer_fichier":
            guard let dossierNom = texte("dossier_nom"), let nom = texte("nom") else {
                return ResultatAction(succes: false, resultat: "Paramètres manquants (dossier_nom, nom).")
            }
            let resoluParenturl = resoudreEmplacement(dossierNom, "chemin")
            guard case .succes(let parentUrl, let libelle) = resoluParenturl else {
                if case .echec(let msg) = resoluParenturl { return ResultatAction(succes: false, resultat: msg) }
                return ResultatAction(succes: false, resultat: "Emplacement introuvable.")
            }
            // Corrige le 05/09/2026, Bourama : "type_mime" est desormais transmis
            // a DossiersDesignesRepository.creerFichier, qui s'en sert pour
            // completer l'extension quand "nom" n'en a pas deja une (voir son
            // en-tete). Avant ce correctif, "type_mime" etait recu ici mais
            // jamais lu, un ecart avec Android silencieux jusqu'a ce que
            // l'agent cree un fichier sans extension explicite.
            let typeMime = texte("type_mime")
            let succes = DossiersDesignesRepository.creerFichier(dansParent: parentUrl, nom: nom, typeMime: typeMime)
            return resultatBooleen(succes, "Fichier \"\(nom)\" créé dans \"\(libelle)\".", "Échec de la création de \"\(nom)\" dans \"\(libelle)\".")

        case "dossier_creer_sous_dossier":
            guard let dossierNom = texte("dossier_nom"), let nom = texte("nom") else {
                return ResultatAction(succes: false, resultat: "Paramètres manquants (dossier_nom, nom).")
            }
            let resoluParenturl = resoudreEmplacement(dossierNom, "chemin")
            guard case .succes(let parentUrl, let libelle) = resoluParenturl else {
                if case .echec(let msg) = resoluParenturl { return ResultatAction(succes: false, resultat: msg) }
                return ResultatAction(succes: false, resultat: "Emplacement introuvable.")
            }
            let succes = DossiersDesignesRepository.creerSousDossier(dansParent: parentUrl, nom: nom)
            return resultatBooleen(succes, "Sous-dossier \"\(nom)\" créé dans \"\(libelle)\".", "Échec de la création du sous-dossier \"\(nom)\" dans \"\(libelle)\".")

        case "dossier_renommer":
            guard let dossierNom = texte("dossier_nom"), let elementNom = texte("element_nom"), let nouveauNom = texte("nouveau_nom") else {
                return ResultatAction(succes: false, resultat: "Paramètres manquants (dossier_nom, element_nom, nouveau_nom).")
            }
            let resoluParenturl = resoudreEmplacement(dossierNom, "chemin")
            guard case .succes(let parentUrl, let libelle) = resoluParenturl else {
                if case .echec(let msg) = resoluParenturl { return ResultatAction(succes: false, resultat: msg) }
                return ResultatAction(succes: false, resultat: "Emplacement introuvable.")
            }
            guard let element = elementParNom(parentUrl, elementNom) else {
                return ResultatAction(succes: false, resultat: "\"\(elementNom)\" introuvable dans \"\(libelle)\".")
            }
            let succes = DossiersDesignesRepository.renommer(element.url, nouveauNom: nouveauNom)
            return resultatBooleen(succes, "\"\(elementNom)\" renommé en \"\(nouveauNom)\".", "Échec du renommage de \"\(elementNom)\".")

        case "dossier_supprimer":
            guard let dossierNom = texte("dossier_nom"), let elementNom = texte("element_nom") else {
                return ResultatAction(succes: false, resultat: "Paramètres manquants (dossier_nom, element_nom).")
            }
            let resoluParenturl = resoudreEmplacement(dossierNom, "chemin")
            guard case .succes(let parentUrl, let libelle) = resoluParenturl else {
                if case .echec(let msg) = resoluParenturl { return ResultatAction(succes: false, resultat: msg) }
                return ResultatAction(succes: false, resultat: "Emplacement introuvable.")
            }
            guard let element = elementParNom(parentUrl, elementNom) else {
                return ResultatAction(succes: false, resultat: "\"\(elementNom)\" introuvable dans \"\(libelle)\".")
            }
            let succes = DossiersDesignesRepository.supprimer(element.url)
            return resultatBooleen(succes, "\"\(elementNom)\" supprimé de \"\(libelle)\".", "Échec de la suppression de \"\(elementNom)\".")

        case "dossier_deplacer":
            guard let dossierNom = texte("dossier_nom"), let elementNom = texte("element_nom"), let nouveauDossierNom = texte("nouveau_dossier_nom") else {
                return ResultatAction(succes: false, resultat: "Paramètres manquants (dossier_nom, element_nom, nouveau_dossier_nom).")
            }
            let resoluSourceparenturl = resoudreEmplacement(dossierNom, "chemin")
            guard case .succes(let sourceParentUrl, let libelleSource) = resoluSourceparenturl else {
                if case .echec(let msg) = resoluSourceparenturl { return ResultatAction(succes: false, resultat: msg) }
                return ResultatAction(succes: false, resultat: "Emplacement source introuvable.")
            }
            let resoluDestinationurl = resoudreEmplacement(nouveauDossierNom, "nouveau_chemin")
            guard case .succes(let destinationUrl, let libelleDestination) = resoluDestinationurl else {
                if case .echec(let msg) = resoluDestinationurl { return ResultatAction(succes: false, resultat: msg) }
                return ResultatAction(succes: false, resultat: "Emplacement de destination introuvable.")
            }
            guard let element = elementParNom(sourceParentUrl, elementNom) else {
                return ResultatAction(succes: false, resultat: "\"\(elementNom)\" introuvable dans \"\(libelleSource)\".")
            }
            let succes = DossiersDesignesRepository.deplacer(element.url, versParent: destinationUrl)
            return resultatBooleen(succes, "\"\(elementNom)\" déplacé de \"\(libelleSource)\" vers \"\(libelleDestination)\".", "Échec du déplacement de \"\(elementNom)\".")

        case "accessibilite_cliquer", "accessibilite_saisir":
            return ResultatAction(succes: false, resultat: "Accessibilité non disponible sur iOS (pas d'équivalent à l'AccessibilityService Android).")

        default:
            return ResultatAction(succes: false, resultat: "type_action \"\(typeAction)\" non reconnu par l'app.")
        }
    }
}
