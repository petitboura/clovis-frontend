package com.clovis.app;

import android.os.Bundle;
import com.clovis.app.pont.PontNatifPlugin;
import com.clovis.app.dossiers.DossiersPlugin;
import com.clovis.app.controlesession.ControleSessionPlugin;
import com.clovis.app.connecteurs.ConnecteursPlugin;
import com.clovis.app.accessibilite.AccessibilitePlugin;
import com.clovis.app.miseajour.MiseAJourPlugin;
import com.clovis.app.tempsecran.TempsEcranPlugin;
import com.clovis.app.notifications.NotificationsPlugin;
import com.getcapacitor.BridgeActivity;

// Modifie le 25/08/2026, Bourama : Lot 3B (fusion Capacitor). registerPlugin
// est obligatoire ici pour un plugin LOCAL (defini dans cette app, pas
// publie sur npm) : contrairement aux plugins npm officiels, Capacitor ne
// le decouvre pas tout seul.
//
// AccessibilitePlugin et MiseAJourPlugin : meme nom qualifie complet dans
// src/play et src/externe (com.clovis.app.accessibilite.AccessibilitePlugin,
// com.clovis.app.miseajour.MiseAJourPlugin) : Gradle resout automatiquement
// vers la version du flavor compile, pas besoin de code conditionnel ici
// (meme pattern que ModuleAccessibilite/ModuleMiseAJour cote clovis-mobile).
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PontNatifPlugin.class);
        registerPlugin(DossiersPlugin.class);
        registerPlugin(ControleSessionPlugin.class);
        registerPlugin(ConnecteursPlugin.class);
        registerPlugin(AccessibilitePlugin.class);
        registerPlugin(MiseAJourPlugin.class);
        // 26/08/2026, Bourama : temps d'ecran + notifications/rappels
        // (Android n'avait pas d'equivalent au plugin iOS existant).
        registerPlugin(TempsEcranPlugin.class);
        registerPlugin(NotificationsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
