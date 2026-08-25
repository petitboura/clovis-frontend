package com.clovis.app;

import android.os.Bundle;
import com.clovis.app.pont.PontNatifPlugin;
import com.getcapacitor.BridgeActivity;

// Modifie le 25/08/2026, Bourama : Lot 3B (fusion Capacitor) -- registerPlugin
// est obligatoire ici pour un plugin LOCAL (defini dans cette app, pas
// publie sur npm) : contrairement aux plugins npm officiels, Capacitor ne
// le decouvre pas tout seul.
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PontNatifPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
