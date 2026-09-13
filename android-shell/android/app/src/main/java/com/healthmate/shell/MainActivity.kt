package com.healthmate.shell

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Capacitor requires registerPlugin() to run BEFORE super.onCreate(),
        // which is where the bridge is constructed and plugins are loaded.
        registerPlugin(HealthConnectPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
