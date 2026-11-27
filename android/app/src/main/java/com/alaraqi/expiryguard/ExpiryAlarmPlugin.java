package com.alaraqi.expiryguard;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.NotificationCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ExpiryAlarm")
public class ExpiryAlarmPlugin extends Plugin {
    public static final String CHANNEL_ID = "expiry-alarms";

    @PluginMethod
    public void requestExactAlarms(PluginCall call) {
        JSObject ret = new JSObject();
        boolean granted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            granted = am == null || am.canScheduleExactAlarms();
            if (!granted) {
                try {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                } catch (Exception ignored) {
                }
            }
        }
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        Integer id = call.getInt("id");
        Long atMs = call.getLong("atMs");
        String title = call.getString("title", "Expiry Guard");
        String body = call.getString("body", "");
        JSObject extra = call.getObject("extra", new JSObject());
        if (id == null || atMs == null) {
            call.reject("id and atMs required");
            return;
        }
        Context ctx = getContext();
        ensureChannel(ctx);
        Intent intent = new Intent(ctx, AlarmReceiver.class);
        intent.putExtra("id", id);
        intent.putExtra("title", title);
        intent.putExtra("body", body);
        intent.putExtra("kind", extra.optString("kind", "document"));
        intent.putExtra("itemId", extra.optString("id", ""));
        PendingIntent pi = PendingIntent.getBroadcast(
            ctx,
            id,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) {
            call.reject("AlarmManager missing");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pi);
        } else {
            am.setExact(AlarmManager.RTC_WAKEUP, atMs, pi);
        }
        call.resolve();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        Integer id = call.getInt("id");
        if (id == null) {
            call.reject("id required");
            return;
        }
        Context ctx = getContext();
        Intent intent = new Intent(ctx, AlarmReceiver.class);
        PendingIntent pi = PendingIntent.getBroadcast(
            ctx,
            id,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(pi);
        call.resolve();
    }

    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Expiry alarms",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Full-screen alarm on the due day");
        channel.enableVibration(true);
        channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(channel);
    }
}
