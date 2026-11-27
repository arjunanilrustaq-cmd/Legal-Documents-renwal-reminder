import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.alaraqi.expiryguard",
  appName: "Expiry Guard",
  webDir: "dist",
  android: {
    backgroundColor: "#1b3d66",
  },
  plugins: {
    StatusBar: {
      style: "DARK",
      backgroundColor: "#1b3d66",
      overlaysWebView: true,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_alarm",
      iconColor: "#1b3d66",
    },
  },
};

export default config;
