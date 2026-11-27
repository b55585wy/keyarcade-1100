import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.keyarcade.app1100",
  appName: "KEYARCADE 1100",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SystemBars: {
      insetsHandling: "disable",
      style: "DARK",
    },
  },
};

export default config;
