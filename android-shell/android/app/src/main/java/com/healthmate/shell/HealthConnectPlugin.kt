package com.healthmate.shell

import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContract
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.lifecycle.lifecycleScope
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.launch
import java.time.Instant

private val READ_HEART_RATE = HealthPermission.getReadPermission(HeartRateRecord::class)

/** Runaway guard on readRecords() pagination — 20 pages x 1000 records is far past any real window. */
private const val MAX_PAGES = 20

/**
 * Native side of the `HealthConnect` bridge consumed by `lib/nativeHealthConnect.ts`.
 *
 * The plugin name and the three method names below are part of that contract and must
 * stay in sync with the TypeScript interface:
 *   isAvailable()                       -> { available: boolean }
 *   requestPermissions()                -> { granted: boolean }
 *   readRecentHeartRate({ since })      -> { samples: [{ measuredAt, heartRate }] }
 */
@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {

    private var permissionLauncher: ActivityResultLauncher<Set<String>>? = null
    private var pendingPermissionCall: PluginCall? = null

    override fun load() {
        try {
            val contract: ActivityResultContract<Set<String>, Set<String>> =
                PermissionController.createRequestPermissionResultContract()

            // The 3-arg ActivityResultRegistry.register(key, contract, callback) overload is
            // used deliberately: the LifecycleOwner overload throws IllegalStateException when
            // registered after the Activity is STARTED, and Capacitor calls Plugin.load() from
            // the bridge init that runs inside BridgeActivity.onCreate()'s super call chain.
            permissionLauncher = activity.activityResultRegistry.register(
                "healthConnectPermissionRequest",
                contract
            ) { granted ->
                val call = pendingPermissionCall
                pendingPermissionCall = null
                val ret = JSObject()
                ret.put("granted", granted.contains(READ_HEART_RATE))
                call?.resolve(ret)
            }
        } catch (e: Exception) {
            // Never let a launcher-registration failure take the whole plugin down —
            // isAvailable()/readRecentHeartRate() should still be callable.
            permissionLauncher = null
        }
    }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val ret = JSObject()
        try {
            val status = HealthConnectClient.getSdkStatus(context)
            ret.put("available", status == HealthConnectClient.SDK_AVAILABLE)
        } catch (e: Exception) {
            ret.put("available", false)
        }
        call.resolve(ret)
    }

    /**
     * NOTE: `Plugin` already declares a `requestPermissions(PluginCall)` @PluginMethod, so this
     * must be an `override` (Kotlin refuses to merely hide it) and must carry its own
     * @PluginMethod annotation (Java method annotations are not inherited by overrides).
     * Capacitor's own internal permission flows use requestAllPermissions()/
     * requestPermissionForAlias(), not this method, so replacing it is safe.
     */
    @PluginMethod
    override fun requestPermissions(call: PluginCall) {
        val launcher = permissionLauncher
        if (launcher == null) {
            call.reject("Health Connect 권한 요청을 시작할 수 없어요.")
            return
        }
        pendingPermissionCall = call
        try {
            launcher.launch(setOf(READ_HEART_RATE))
        } catch (e: Exception) {
            pendingPermissionCall = null
            call.reject("Health Connect 권한 요청을 시작할 수 없어요: ${e.message}")
        }
    }

    @PluginMethod
    fun readRecentHeartRate(call: PluginCall) {
        val sinceStr = call.getString("since")
        val startTime = try {
            if (sinceStr != null) Instant.parse(sinceStr)
            else Instant.now().minusSeconds(7L * 24 * 3600)
        } catch (e: Exception) {
            Instant.now().minusSeconds(7L * 24 * 3600)
        }
        val endTime = Instant.now()

        if (!startTime.isBefore(endTime)) {
            // Health Connect rejects an empty/inverted range; nothing new to report.
            val ret = JSObject()
            ret.put("samples", JSArray())
            call.resolve(ret)
            return
        }

        activity.lifecycleScope.launch {
            try {
                val client = HealthConnectClient.getOrCreate(context)
                val granted = client.permissionController.getGrantedPermissions()
                if (!granted.contains(READ_HEART_RATE)) {
                    call.reject("Health Connect 권한이 없어요.")
                    return@launch
                }

                // readRecords() pages at 1000 records. `ascendingOrder = false` is load-bearing:
                // with the default ascending order, hitting the page limit silently drops the
                // NEWEST records — the exact data this feature exists to surface. Newest-first
                // means any truncation costs old data instead. A continuously-worn watch can
                // plausibly exceed one page over the 7-day default first-sync window, so we also
                // follow pageToken, bounded by MAX_PAGES as a runaway guard.
                val samples = JSArray()
                var pageToken: String? = null
                var page = 0
                do {
                    val response = client.readRecords(
                        ReadRecordsRequest(
                            recordType = HeartRateRecord::class,
                            timeRangeFilter = TimeRangeFilter.between(startTime, endTime),
                            ascendingOrder = false,
                            pageToken = pageToken
                        )
                    )

                    for (record in response.records) {
                        for (sample in record.samples) {
                            val item = JSObject()
                            item.put("measuredAt", sample.time.toString())
                            item.put("heartRate", sample.beatsPerMinute)
                            samples.put(item)
                        }
                    }

                    pageToken = response.pageToken
                    page++
                } while (pageToken != null && page < MAX_PAGES)

                val ret = JSObject()
                ret.put("samples", samples)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject("Health Connect에서 데이터를 읽지 못했어요: ${e.message}")
            }
        }
    }
}
