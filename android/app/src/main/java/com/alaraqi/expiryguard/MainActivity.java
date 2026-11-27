package com.alaraqi.expiryguard;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ExpiryAlarmPlugin.class);
        super.onCreate(savedInstanceState);
        handleAlarmIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleAlarmIntent(intent);
    }

    private void handleAlarmIntent(Intent intent) {
        if (intent == null) return;
        String kind = intent.getStringExtra("kind");
        String id = intent.getStringExtra("id");
        if (kind == null || id == null || kind.isEmpty() || id.isEmpty()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            );
        }
        if (getBridge() == null) return;
        String safeKind = kind.replace("'", "");
        String safeId = id.replace("'", "");
        getBridge().eval(
            "window.__pendingAlarm={kind:'" + safeKind + "',id:'" + safeId + "'};"
                + "window.dispatchEvent(new CustomEvent('expiry-alarm',{detail:window.__pendingAlarm}));",
            null
        );
    }
}
