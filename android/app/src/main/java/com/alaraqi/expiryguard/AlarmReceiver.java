package com.alaraqi.expiryguard;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;

public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        int id = intent.getIntExtra("id", 1);
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        String kind = intent.getStringExtra("kind");
        String itemId = intent.getStringExtra("itemId");
        if (title == null) title = "Expiry Guard";
        if (body == null) body = "";
        if (kind == null) kind = "document";
        if (itemId == null) itemId = "";

        ExpiryAlarmPlugin.ensureChannel(context);

        Intent full = new Intent(context, AlarmActivity.class);
        full.putExtra("kind", kind);
        full.putExtra("id", itemId);
        full.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent fullPi = PendingIntent.getActivity(
            context,
            id,
            full,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(context, ExpiryAlarmPlugin.CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_alarm)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(fullPi)
            .setFullScreenIntent(fullPi, true)
            .build();

        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm != null) nm.notify(id, notification);

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            context.startActivity(full);
        }
    }
}
