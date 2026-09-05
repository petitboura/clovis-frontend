// Cree le 23/08/2026, Bourama : Lot 2 Partie 3 (app mobile), fichiers/dossiers designes, iOS.
//
// UIDocumentPickerViewController (mode dossier) + security-scoped bookmarks
// pour la persistance (voir 02-fichiers-dossiers.md). Contrairement a
// Android (une permission URI persistante suffit), iOS exige de
// "start/stopAccessingSecurityScopedResource()" a CHAQUE usage -- ce n'est
// pas une permission qu'on prend une fois pour toutes cote systeme, c'est
// une session d'acces a ouvrir/fermer a chaque operation. D'ou le wrapper
// `avecAcces(...)` ci-dessous, utilise par toutes les operations.
//
// Bookmarks stockes dans UserDefaults (Data en base64 implicite via
// UserDefaults). Pas besoin d'entitlement special pour ceci -- contrairement
// a Screen Time (voir README.md), UIDocumentPickerViewController fonctionne
// sur un compte Apple Developer standard.
import Foundation
import UniformTypeIdentifiers

private let CLE_BOOKMARKS = "dossiers_designes_bookmarks"

struct DossierDesigne: Identifiable {
    let id: String // bookmark encode en base64, sert aussi de cle de retrait
    let url: URL
}

struct ElementDossier: Identifiable {
    let id: String
    let url: URL
    let nom: String
    let estDossier: Bool
    let tailleOctets: Int64
}

// Ajoute le 30/08/2026 (correctif Claude chat) : voir DossiersDesignesRepository.kt
// cote Android pour le role exact, meme structure des deux cotes.
struct ContenuFichier {
    let contenuBase64: String
    let typeMime: String
    let nomFichier: String
    let tailleOctets: Int64
}

// Ajoute le 04/09/2026 (vectorisation en masse des dossiers designes,
// voir DossiersDesignesRepository.kt cote Android pour le meme role) :
// un fichier trouve en parcourant recursivement un dossier designe, avec
// son chemin de sous-dossiers depuis la racine (jamais le nom du dossier
// designe lui-meme, ni le nom du fichier).
struct FichierAVectoriser {
    let url: URL
    let nom: String
    let chemin: [String]
    let typeMime: String
    let tailleOctets: Int64
}

enum DossiersDesignesRepository {

    // MARK: - Liste des dossiers designes

    static func listerDossiersDesignes() -> [DossierDesigne] {
        let bookmarks = UserDefaults.standard.array(forKey: CLE_BOOKMARKS) as? [Data] ?? []
        return bookmarks.compactMap { bookmark in
            var estPerime = false
            guard let url = try? URL(
                resolvingBookmarkData: bookmark,
                options: [],
                relativeTo: nil,
                bookmarkDataIsStale: &estPerime
            ) else { return nil }
            // Un bookmark perime (dossier deplace/renomme cote systeme) est quand
            // meme retourne ici -- il sera simplement retire au prochain retrait
            // manuel si l'acces echoue reellement. Ne pas le faire disparaitre
            // silencieusement de la liste, l'etudiant doit pouvoir le voir et le retirer.
            return DossierDesigne(id: bookmark.base64EncodedString(), url: url)
        }
    }

    static func ajouterDossierDesigne(url: URL) {
        guard url.startAccessingSecurityScopedResource() else { return }
        defer { url.stopAccessingSecurityScopedResource() }
        guard let bookmark = try? url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil) else { return }
        var bookmarks = UserDefaults.standard.array(forKey: CLE_BOOKMARKS) as? [Data] ?? []
        bookmarks.append(bookmark)
        UserDefaults.standard.set(bookmarks, forKey: CLE_BOOKMARKS)
    }

    static func retirerDossierDesigne(id: String) {
        var bookmarks = UserDefaults.standard.array(forKey: CLE_BOOKMARKS) as? [Data] ?? []
        bookmarks.removeAll { $0.base64EncodedString() == id }
        UserDefaults.standard.set(bookmarks, forKey: CLE_BOOKMARKS)
    }

    // MARK: - Acces securise (a ouvrir/fermer a chaque operation, voir en-tete)

    private static func avecAcces<T>(_ url: URL, _ operation: () throws -> T) -> T? {
        guard url.startAccessingSecurityScopedResource() else { return nil }
        defer { url.stopAccessingSecurityScopedResource() }
        return try? operation()
    }

    // MARK: - CRUD

    static func listerContenu(_ dossier: URL) -> [ElementDossier] {
        avecAcces(dossier) {
            let fm = FileManager.default
            let enfants = try fm.contentsOfDirectory(
                at: dossier,
                includingPropertiesForKeys: [.isDirectoryKey, .fileSizeKey],
                options: [.skipsHiddenFiles]
            )
            return enfants.map { url in
                let valeurs = try? url.resourceValues(forKeys: [.isDirectoryKey, .fileSizeKey])
                let estDossier = valeurs?.isDirectory ?? false
                let taille = Int64(valeurs?.fileSize ?? 0)
                return ElementDossier(id: url.path, url: url, nom: url.lastPathComponent, estDossier: estDossier, tailleOctets: taille)
            }.sorted {
                if $0.estDossier != $1.estDossier { return $0.estDossier && !$1.estDossier }
                return $0.nom.localizedCaseInsensitiveCompare($1.nom) == .orderedAscending
            }
        } ?? []
    }

    static func creerSousDossier(dansParent parent: URL, nom: String) -> Bool {
        avecAcces(parent) {
            let destination = parent.appendingPathComponent(nom, isDirectory: true)
            try FileManager.default.createDirectory(at: destination, withIntermediateDirectories: false)
        } != nil
    }

    // Modifie le 05/09/2026, Bourama : ajoute "typeMime" (optionnel, defaut
    // nil pour ne rien changer au chemin d'appel existant depuis
    // DossiersPlugin.creerFichier, cote UI web/JS). Corrige un ecart avec
    // Android : la-bas, DocumentFile.createFile(typeMime, nom) via SAF
    // choisit lui-meme l'extension a partir du type MIME quand "nom" n'en a
    // pas deja une. Cote iOS, FileManager n'a aucune notion de type MIME,
    // le type d'un fichier est entierement determine par l'extension dans
    // son nom -- sans ce correctif, un "nom" recu sans extension (l'agent
    // comptant sur "type_mime" pour l'implicite) donnait un fichier sans
    // extension sur iPhone alors qu'Android l'aurait complete. Voir
    // nomAvecExtension ci-dessous.
    static func creerFichier(dansParent parent: URL, nom: String, typeMime: String? = nil) -> Bool {
        avecAcces(parent) {
            let nomFinal = Self.nomAvecExtension(nom, typeMime: typeMime)
            let destination = parent.appendingPathComponent(nomFinal, isDirectory: false)
            guard FileManager.default.createFile(atPath: destination.path, contents: Data()) else {
                throw NSError(domain: "DossiersDesignesRepository", code: 1)
            }
        } != nil
    }

    // Si "nom" a deja une extension, ne jamais la toucher (meme principe
    // que le reste du projet : ne jamais deviner par-dessus ce qui est deja
    // explicite). Sinon, en deduire une a partir du type MIME recu, si
    // fourni et reconnu -- sinon "nom" reste tel quel (aucune extension
    // ajoutee), meme comportement qu'avant ce correctif.
    private static func nomAvecExtension(_ nom: String, typeMime: String?) -> String {
        guard (nom as NSString).pathExtension.isEmpty,
              let typeMime = typeMime,
              let ext = UTType(mimeType: typeMime)?.preferredFilenameExtension else {
            return nom
        }
        return "\(nom).\(ext)"
    }

    static func renommer(_ element: URL, nouveauNom: String) -> Bool {
        avecAcces(element.deletingLastPathComponent()) {
            let destination = element.deletingLastPathComponent().appendingPathComponent(nouveauNom)
            try FileManager.default.moveItem(at: element, to: destination)
        } != nil
    }

    static func supprimer(_ element: URL) -> Bool {
        avecAcces(element.deletingLastPathComponent()) {
            try FileManager.default.removeItem(at: element)
        } != nil
    }

    static func deplacer(_ element: URL, versParent nouveauParent: URL) -> Bool {
        avecAcces(nouveauParent) {
            let destination = nouveauParent.appendingPathComponent(element.lastPathComponent)
            try FileManager.default.moveItem(at: element, to: destination)
        } != nil
    }

    // MARK: - Vectorisation en masse (04/09/2026)

    // Parcourt recursivement dossier (et sous-dossiers), renvoie chaque
    // FICHIER (jamais les dossiers), video exclue -- meme role que
    // listerRecursif cote Android (DossiersDesignesRepository.kt), voir
    // ce fichier pour le contexte complet. Contrairement aux autres
    // fonctions de ce fichier, NE gere PAS elle-meme l'acces
    // security-scoped : l'appelant (DossiersPlugin, voir
    // demarrerVectorisationDossier) doit deja avoir ouvert
    // startAccessingSecurityScopedResource() sur la racine et le garder
    // ouvert pendant toute la duree du transfert (listage + lecture +
    // upload de chaque fichier) -- rouvrir/refermer l'acces a chaque
    // fichier serait inutilement couteux et fragile.
    static func listerRecursif(_ dossier: URL, chemin: [String] = []) -> [FichierAVectoriser] {
        let fm = FileManager.default
        guard let enfants = try? fm.contentsOfDirectory(
            at: dossier,
            includingPropertiesForKeys: [.isDirectoryKey, .fileSizeKey],
            options: [.skipsHiddenFiles]
        ) else { return [] }
        var resultat: [FichierAVectoriser] = []
        for url in enfants {
            let valeurs = try? url.resourceValues(forKeys: [.isDirectoryKey, .fileSizeKey])
            let estDossier = valeurs?.isDirectory ?? false
            if estDossier {
                resultat.append(contentsOf: listerRecursif(url, chemin: chemin + [url.lastPathComponent]))
            } else {
                let typeMime = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType
                    ?? "application/octet-stream"
                if !typeMime.hasPrefix("video/") {
                    let taille = Int64(valeurs?.fileSize ?? 0)
                    resultat.append(FichierAVectoriser(url: url, nom: url.lastPathComponent, chemin: chemin, typeMime: typeMime, tailleOctets: taille))
                }
            }
        }
        return resultat
    }

    // Ajoute le 30/08/2026 (correctif Claude chat, meme role que la version
    // Android, voir son en-tete) : contenu brut d'un fichier deja repere,
    // encode en base64 pour transiter par le canal temps reel WebSocket.
    static func lireFichier(_ element: URL) -> ContenuFichier? {
        avecAcces(element.deletingLastPathComponent()) {
            let data = try Data(contentsOf: element)
            let typeMime = UTType(filenameExtension: element.pathExtension)?.preferredMIMEType
                ?? "application/octet-stream"
            return ContenuFichier(
                contenuBase64: data.base64EncodedString(),
                typeMime: typeMime,
                nomFichier: element.lastPathComponent,
                tailleOctets: Int64(data.count)
            )
        }
    }
}
