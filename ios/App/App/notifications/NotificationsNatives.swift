// Cree le 23/08/2026, Bourama : Lot 3 Partie 3 (app mobile), notifications & rappels.
//
// IMPORTANT (confirme en recherche avant de coder ce lot) : iOS n'a AUCUN
// equivalent de l'alerte plein ecran par-dessus le verrouillage pour une
// app tierce classique -- capacite historiquement reservee aux apps
// telephonie/VoIP via CallKit (PKPushRegistry + CXProvider), un cadre
// totalement different (concu pour simuler un appel entrant, pas pour un
// rappel d'etude). Utiliser CallKit pour un simple rappel serait un
// detournement que Apple rejette en review App Store. Consequence :
// AUCUNE alerte "plein ecran" cote iOS dans ce lot, seulement des
// notifications locales/push standards (banner + son), meme en priorite
// "time sensitive" (UNNotificationInterruptionLevel.timeSensitive, ce qui
// reste une simple notification qui traverse le mode Ne pas deranger, PAS
// un ecran plein comme sur Android). A confirmer explicitement aupres de
// Bourama que cette limite est acceptee (voir 03-notifications-rappels.md,
// qui demandait deja de "documenter ce qui est reellement atteignable").
import UserNotifications

enum NotificationsNatives {

    static func demanderAutorisation() async -> Bool {
        let centre = UNUserNotificationCenter.current()
        do {
            return try await centre.requestAuthorization(options: [.alert, .sound, .badge])
        } catch {
            return false
        }
    }

    static func autorisationAccordee() async -> Bool {
        let parametres = await UNUserNotificationCenter.current().notificationSettings()
        return parametres.authorizationStatus == .authorized
    }

    /// Notification locale de test (voir RappelsScreen.swift). `prioritaire`
    /// utilise time-sensitive (traverse Ne pas deranger) -- PAS un ecran
    /// plein, voir note en tete de fichier.
    static func afficherNotificationTest(titre: String, corps: String, prioritaire: Bool) {
        let contenu = UNMutableNotificationContent()
        contenu.title = titre
        contenu.body = corps
        contenu.sound = .default
        if prioritaire {
            contenu.interruptionLevel = .timeSensitive
        }
        let requete = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: contenu,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        )
        UNUserNotificationCenter.current().add(requete)
    }

    /// Equivalent iOS d'une alarme Android (voir 03-notifications-rappels.md :
    /// "iOS : notifications programmées via UNUserNotificationCenter, pas
    /// d'app Horloge pilotable de l'exterieur comme sur Android"). Declenche
    /// a `date` precise, pas de repli si l'app est fermee -- gere nativement
    /// par iOS, contrairement au Lot 1 usage qui necessitait une extension.
    static func programmerRappel(titre: String, corps: String, date: Date) {
        let contenu = UNMutableNotificationContent()
        contenu.title = titre
        contenu.body = corps
        contenu.sound = .default

        let composants = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute], from: date
        )
        let declencheur = UNCalendarNotificationTrigger(dateMatching: composants, repeats: false)
        let requete = UNNotificationRequest(
            identifier: UUID().uuidString, content: contenu, trigger: declencheur
        )
        UNUserNotificationCenter.current().add(requete)
    }
}
