// Porte depuis clovis-mobile/android-legacy-natif (Lot 2 Partie 3, 23/08/2026)
// dans le plugin Capacitor (Lot 3B, 25/08/2026). Logique inchangee, seul le
// package a change (com.clovis.app.data -> com.clovis.app.dossiers).
//
// Storage Access Framework (SAF). L'etudiant designe un dossier une seule
// fois via le selecteur systeme (ACTION_OPEN_DOCUMENT_TREE) ; on prend une
// permission URI PERSISTANTE (takePersistableUriPermission) pour ne plus
// jamais avoir a la redemander, voir 02-fichiers-dossiers.md, "Objectif".
//
// Liste des dossiers designes stockee en local (SharedPreferences, Set<String>
// d'URI serialisees) : pas besoin de synchro serveur pour ca, c'est propre a
// cet appareil (l'acces SAF lui-meme est lie a l'appareil, pas au compte).
//
// Operations CRUD via DocumentFile (creer/lire/modifier) + DocumentsContract
// pour deplacer un document a l'interieur d'un meme arbre (moveDocument,
// dispo depuis l'API 24, minSdk du projet = 26).
package com.clovis.app.dossiers

import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import android.util.Base64
import androidx.documentfile.provider.DocumentFile

private const val PREFS_NOM = "dossiers_designes"
private const val CLE_URIS = "uris"

data class DossierDesigne(val uri: Uri, val nom: String)

data class ElementDossier(
    val uri: Uri,
    val nom: String,
    val estDossier: Boolean,
    val tailleOctets: Long
)

// Ajoute le 30/08/2026 (correctif Claude chat, branchement lire_fichier /
// chercher_par_contenu, voir core/exploration_dossier_mobile.py cote
// clovis-backend et 04-lecture-contenu.md / 05-recherche-contenu-app-fermee.md
// a la racine de ce depot) : contenu brut d'un fichier, encode en base64,
// tel qu'attendu par core/lecture_fichier_mobile.py (qui applique lui-meme
// les seuils de taille par type et decide du traitement, rien a filtrer ici).
data class ContenuFichier(
    val contenuBase64: String,
    val typeMime: String,
    val nomFichier: String,
    val tailleOctets: Long
)

// Ajoute le 04/09/2026 (vectorisation en masse des dossiers designes,
// voir clovis-backend/api/dossiers_designes.py) : un fichier trouve en
// parcourant recursivement un dossier designe, avec son chemin de
// sous-dossiers depuis la racine (JAMAIS le nom du dossier designe
// lui-meme, ni le nom du fichier -- voir listerRecursif ci-dessous).
data class FichierAVectoriser(
    val uri: Uri,
    val nom: String,
    val chemin: List<String>,
    val typeMime: String,
    val tailleOctets: Long
)

class DossiersDesignesRepository(private val context: Context) {

    private val prefs = context.getSharedPreferences(PREFS_NOM, Context.MODE_PRIVATE)

    /** Dossiers designes actuellement, avec leur nom lisible. */
    fun listerDossiersDesignes(): List<DossierDesigne> {
        val uris = prefs.getStringSet(CLE_URIS, emptySet()) ?: emptySet()
        return uris.mapNotNull { brut ->
            val uri = Uri.parse(brut)
            val doc = DocumentFile.fromTreeUri(context, uri)
            if (doc != null && doc.exists()) {
                DossierDesigne(uri, doc.name ?: uri.lastPathSegment ?: "Dossier")
            } else {
                null // dossier devenu inaccessible (supprime/deplace hors de l'app), ignore silencieusement ici, nettoye au prochain ajout/retrait
            }
        }
    }

    /**
     * A appeler avec l'Uri renvoyee par le selecteur systeme
     * (ActivityResultContracts.OpenDocumentTree), apres que l'utilisateur a
     * choisi un dossier. Prend la permission persistante et l'ajoute a la liste.
     */
    fun ajouterDossierDesigne(uri: Uri) {
        context.contentResolver.takePersistableUriPermission(
            uri,
            Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        )
        val actuels = (prefs.getStringSet(CLE_URIS, emptySet()) ?: emptySet()).toMutableSet()
        actuels.add(uri.toString())
        prefs.edit().putStringSet(CLE_URIS, actuels).apply()
    }

    /** Retire un dossier de la liste designee et libere la permission persistante. */
    fun retirerDossierDesigne(uri: Uri) {
        try {
            context.contentResolver.releasePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            )
        } catch (e: SecurityException) {
            // Permission deja perdue (dossier supprime cote systeme), rien a liberer.
        }
        val actuels = (prefs.getStringSet(CLE_URIS, emptySet()) ?: emptySet()).toMutableSet()
        actuels.remove(uri.toString())
        prefs.edit().putStringSet(CLE_URIS, actuels).apply()
    }

    /** Contenu direct d'un dossier (designe ou sous-dossier), trie dossiers puis fichiers, alphabetique. */
    fun listerContenu(dossierUri: Uri): List<ElementDossier> {
        val doc = DocumentFile.fromTreeUri(context, dossierUri) ?: DocumentFile.fromSingleUri(context, dossierUri)
        val enfants = doc?.listFiles() ?: emptyArray()
        return enfants
            .filter { it.name != null }
            .map { ElementDossier(it.uri, it.name!!, it.isDirectory, if (it.isDirectory) 0L else it.length()) }
            .sortedWith(compareBy({ !it.estDossier }, { it.nom.lowercase() }))
    }

    fun creerSousDossier(parentUri: Uri, nom: String): Boolean {
        val parent = DocumentFile.fromTreeUri(context, parentUri) ?: return false
        return parent.createDirectory(nom) != null
    }

    fun creerFichier(parentUri: Uri, nom: String, typeMime: String = "text/plain"): Boolean {
        val parent = DocumentFile.fromTreeUri(context, parentUri) ?: return false
        return parent.createFile(typeMime, nom) != null
    }

    /**
     * Lit le contenu brut d'un fichier deja repere (via listerContenu ou
     * une recherche), encode en base64 pour transiter par le canal temps
     * reel WebSocket (JSON, pas de binaire brut). Renvoie null si le
     * fichier est introuvable/illisible (deplace/supprime entre-temps,
     * permission perdue) : l'appelant traduit ca en erreur explicite,
     * jamais de silence.
     */
    fun lireFichier(elementUri: Uri): ContenuFichier? {
        val doc = DocumentFile.fromSingleUri(context, elementUri) ?: return null
        if (!doc.exists() || !doc.isFile) return null
        val nom = doc.name ?: return null
        val typeMime = doc.type ?: "application/octet-stream"
        val octets = lireOctets(elementUri) ?: return null
        return ContenuFichier(
            contenuBase64 = Base64.encodeToString(octets, Base64.NO_WRAP),
            typeMime = typeMime,
            nomFichier = nom,
            tailleOctets = octets.size.toLong()
        )
    }

    // Ajoute le 04/09/2026 : contenu brut d'un fichier (pas de base64,
    // contrairement a lireFichier ci-dessus qui l'encode pour le canal
    // temps reel WebSocket) -- utilise par la vectorisation en masse, qui
    // envoie les octets tels quels en multipart HTTP. lireFichier
    // reutilise maintenant cette meme fonction (aucune logique dupliquee).
    fun lireOctets(elementUri: Uri): ByteArray? {
        return try {
            context.contentResolver.openInputStream(elementUri)?.use { it.readBytes() }
        } catch (e: Exception) {
            null
        }
    }

    // Ajoute le 04/09/2026, Bourama : "apres avoir choisi un dossier, tout
    // ce qu'il contient hormis video est vectorise" -- parcourt
    // recursivement TOUS les sous-dossiers d'un dossier designe et
    // renvoie chaque FICHIER trouve (jamais les dossiers eux-memes), en
    // excluant la video (trop couteuse a vectoriser, decision explicite
    // de Bourama). `chemin` porte la liste ordonnee des noms de
    // sous-dossiers traverses pour atteindre ce fichier, PAS le nom du
    // dossier designe racine ni celui du fichier -- voir
    // clovis-backend/migrations/2026_09_04_dossiers_designes_vectorisation.sql.
    // Reutilise directement les DocumentFile enfants renvoyes par
    // listFiles() pour recurser (pas besoin de refaire fromTreeUri a
    // chaque niveau, l'URI enfant est deja valide dans l'arbre accorde).
    fun listerRecursif(dossierUri: Uri): List<FichierAVectoriser> {
        val racine = DocumentFile.fromTreeUri(context, dossierUri) ?: return emptyList()
        return parcourirRecursivement(racine, emptyList())
    }

    private fun parcourirRecursivement(dossier: DocumentFile, chemin: List<String>): List<FichierAVectoriser> {
        val resultat = mutableListOf<FichierAVectoriser>()
        dossier.listFiles().forEach { enfant ->
            val nom = enfant.name ?: return@forEach
            if (enfant.isDirectory) {
                resultat.addAll(parcourirRecursivement(enfant, chemin + nom))
            } else {
                val typeMime = enfant.type ?: "application/octet-stream"
                if (!typeMime.startsWith("video/")) {
                    resultat.add(FichierAVectoriser(enfant.uri, nom, chemin, typeMime, enfant.length()))
                }
            }
        }
        return resultat
    }

    fun renommer(elementUri: Uri, nouveauNom: String): Boolean {
        val doc = DocumentFile.fromSingleUri(context, elementUri) ?: return false
        return doc.renameTo(nouveauNom)
    }

    fun supprimer(elementUri: Uri): Boolean {
        val doc = DocumentFile.fromSingleUri(context, elementUri) ?: return false
        return doc.delete()
    }

    /**
     * Deplace un document vers un autre dossier PARENT, a l'interieur du meme
     * arbre designe (DocumentsContract.moveDocument ne fonctionne qu'au sein
     * d'un meme fournisseur de documents). anciensParentUri et nouveauParentUri
     * sont les Uri des dossiers source/destination (pas du document lui-meme).
     */
    fun deplacer(elementUri: Uri, ancienParentUri: Uri, nouveauParentUri: Uri): Boolean {
        return try {
            val resolver: ContentResolver = context.contentResolver
            val ancienParentDocId = DocumentsContract.getTreeDocumentId(ancienParentUri)
                .let { DocumentsContract.buildDocumentUriUsingTree(ancienParentUri, it) }
            val nouveauParentDocId = DocumentsContract.getTreeDocumentId(nouveauParentUri)
                .let { DocumentsContract.buildDocumentUriUsingTree(nouveauParentUri, it) }
            DocumentsContract.moveDocument(resolver, elementUri, ancienParentDocId, nouveauParentDocId) != null
        } catch (e: Exception) {
            false
        }
    }
}
