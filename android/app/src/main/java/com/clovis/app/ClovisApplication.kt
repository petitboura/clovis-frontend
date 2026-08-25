// Cree le 23/08/2026 (Lot 3, clovis-mobile), porte le 25/08/2026 dans le
// plugin Capacitor (Lot 3B).
package com.clovis.app

import android.app.Application
import com.clovis.app.notifications.creerCanauxNotifications
import com.clovis.app.notifications.firebaseConfigure

class ClovisApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        firebaseConfigure(this)
        creerCanauxNotifications(this)
    }
}
