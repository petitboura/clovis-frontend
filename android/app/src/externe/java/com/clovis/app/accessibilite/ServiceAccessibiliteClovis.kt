// Cree le 23/08/2026, Bourama : Lot 6 (service d'accessibilite, flavor externe uniquement).
// Modifie 23/08/2026, Lot 7 : le service expose maintenant son instance active
// (companion object) pour qu'ExecuteurActions.kt puisse lire rootInActiveWindow
// et y executer des actions. Portee des actions elle-meme geree entierement
// dans ExecuteurActions.kt, pas ici -- ce fichier reste la lecture/le cycle
// de vie du service, rien de plus.
package com.clovis.app.accessibilite

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class ServiceAccessibiliteClovis : AccessibilityService() {

    companion object {
        var instance: ServiceAccessibiliteClovis? = null
            private set
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        journaliser(nomPaquet = "-", typeEvenement = "SERVICE_CONNECTE", nombreNoeudsLus = 0)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val nomPaquet = event.packageName?.toString() ?: return

        // Lecture complete de l'arbre uniquement au changement de fenetre
        // (ouverture d'une nouvelle app/ecran) : parcourir tout l'arbre sur
        // CHAQUE evenement de contenu serait couteux en performance (voir
        // le skill djiguigne-standards-dev, regle performance). Pour les
        // autres types d'evenements, on journalise juste l'evenement lui-meme.
        val nombreNoeuds = if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            rootInActiveWindow?.let { compterNoeuds(it) } ?: 0
        } else {
            0
        }

        journaliser(
            nomPaquet = nomPaquet,
            typeEvenement = AccessibilityEvent.eventTypeToString(event.eventType),
            nombreNoeudsLus = nombreNoeuds
        )
    }

    override fun onInterrupt() {
        journaliser(nomPaquet = "-", typeEvenement = "SERVICE_INTERROMPU", nombreNoeudsLus = 0)
    }

    override fun onDestroy() {
        if (instance === this) instance = null
        super.onDestroy()
    }

    /** Parcours en lecture seule, profondeur plafonnee pour eviter un arbre pathologique. */
    private fun compterNoeuds(noeud: AccessibilityNodeInfo, profondeur: Int = 0): Int {
        if (profondeur > 40) return 1
        var total = 1
        for (i in 0 until noeud.childCount) {
            noeud.getChild(i)?.let { enfant ->
                total += compterNoeuds(enfant, profondeur + 1)
                enfant.recycle()
            }
        }
        return total
    }

    private fun journaliser(nomPaquet: String, typeEvenement: String, nombreNoeudsLus: Int) {
        JournalAccessibilite.ajouter(
            EntreeJournal(
                nomPaquet = nomPaquet,
                typeEvenement = typeEvenement,
                nombreNoeudsLus = nombreNoeudsLus,
                horodatage = System.currentTimeMillis()
            )
        )
    }
}
