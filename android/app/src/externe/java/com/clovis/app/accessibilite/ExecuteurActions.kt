// Cree le 23/08/2026, Bourama : Lot 7 (actions pilotees), flavor externe uniquement.
//
// Portee (voir 07-actions-pilotees.md) :
// - Actions a partir de l'arbre d'UI (pas de gestes tactiles bruts)
// - Verifie systematiquement l'autorisation de l'app active (AppsAutorisees)
//   AVANT toute recherche/action -- aucune exception, aucune app par defaut
// - Un seul essai par appel : jamais de boucle de reessai a l'aveugle (regle
//   "ne jamais deviner" du document commun, appliquee au comportement de
//   l'agent). Si l'element est introuvable ou l'action refusee, on retourne
//   un echec clair immediatement.
// - Chaque tentative (succes ou echec) est journalisee via JournalActions,
//   pour permettre de casser volontairement un scenario et verifier le
//   comportement de repli (critere de fin du lot).
package com.clovis.app.accessibilite

import android.os.Bundle
import android.view.accessibility.AccessibilityNodeInfo

data class ResultatAction(val succes: Boolean, val message: String)

object ExecuteurActions {

    private const val PROFONDEUR_MAX = 40

    fun cliquerParTexte(texteCible: String): ResultatAction =
        executerSurNoeudTrouve(texteCible) { noeud ->
            if (!noeud.isClickable) {
                ResultatAction(false, "\"$texteCible\" trouvé mais n'est pas cliquable.")
            } else {
                val fait = noeud.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                if (fait) ResultatAction(true, "Clic effectué sur \"$texteCible\".")
                else ResultatAction(false, "Le clic sur \"$texteCible\" a été refusé par l'app.")
            }
        }

    fun saisirTexteParCible(texteCible: String, valeur: String): ResultatAction =
        executerSurNoeudTrouve(texteCible) { noeud ->
            if (!noeud.isEditable) {
                ResultatAction(false, "\"$texteCible\" trouvé mais ce n'est pas un champ de saisie.")
            } else {
                val args = Bundle().apply {
                    putCharSequence(
                        AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                        valeur
                    )
                }
                val fait = noeud.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
                if (fait) ResultatAction(true, "Texte saisi dans \"$texteCible\".")
                else ResultatAction(false, "La saisie dans \"$texteCible\" a échoué.")
            }
        }

    private fun executerSurNoeudTrouve(
        texteCible: String,
        action: (AccessibilityNodeInfo) -> ResultatAction
    ): ResultatAction {
        val service = ServiceAccessibiliteClovis.instance
            ?: return echouer("-", texteCible, "Service d'accessibilité non actif.")

        val racine = service.rootInActiveWindow
            ?: return echouer("-", texteCible, "Impossible de lire l'écran actuel.")

        val paquetActif = racine.packageName?.toString()
            ?: return echouer("-", texteCible, "Impossible de déterminer l'app active.")

        if (!AppsAutorisees.estAutorisee(paquetActif)) {
            return echouer(
                paquetActif,
                texteCible,
                "\"$paquetActif\" n'est pas dans la liste des apps autorisées -- action refusée."
            )
        }

        val noeud = chercherNoeud(racine, texteCible)
            ?: return echouer(
                paquetActif,
                texteCible,
                "Élément \"$texteCible\" introuvable à l'écran -- l'app a peut-être changé d'interface."
            )

        val resultat = action(noeud)
        JournalActions.ajouter(
            EntreeAction(paquetActif, texteCible, resultat.succes, resultat.message, System.currentTimeMillis())
        )
        return resultat
    }

    private fun echouer(paquet: String, cible: String, message: String): ResultatAction {
        JournalActions.ajouter(EntreeAction(paquet, cible, false, message, System.currentTimeMillis()))
        return ResultatAction(false, message)
    }

    /**
     * Un seul parcours, profondeur plafonnee (meme limite que compterNoeuds
     * au Lot 6). Ne recycle jamais un noeud qui fait partie du chemin
     * retourne -- recycler un ancetre du noeud trouve invaliderait la
     * reference qu'on renvoie.
     */
    private fun chercherNoeud(
        noeud: AccessibilityNodeInfo,
        texteCible: String,
        profondeur: Int = 0
    ): AccessibilityNodeInfo? {
        if (profondeur > PROFONDEUR_MAX) return null

        val texte = noeud.text?.toString() ?: noeud.contentDescription?.toString()
        if (texte != null && texte.contains(texteCible, ignoreCase = true)) {
            return noeud
        }

        for (i in 0 until noeud.childCount) {
            val enfant = noeud.getChild(i) ?: continue
            val trouve = chercherNoeud(enfant, texteCible, profondeur + 1)
            if (trouve != null) return trouve
            enfant.recycle()
        }
        return null
    }
}
