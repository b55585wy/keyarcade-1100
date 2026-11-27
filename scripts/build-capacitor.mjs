import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const apiDir = path.join(rootDir, "src", "app", "api");
const stashRoot = path.join(rootDir, ".cap-tmp-api");
const stashApiDir = path.join(stashRoot, "api");
const nextDir = path.join(rootDir, ".next");
const wantApk = process.argv.includes("--apk");

function findJavaHome() {
  if (process.env.JAVA_HOME && fs.existsSync(path.join(process.env.JAVA_HOME, "bin", "java.exe"))) {
    return process.env.JAVA_HOME;
  }
  const localAppData = process.env.LOCALAPPDATA || "";
  const candidates = [
    localAppData ? path.join(localAppData, "Android", "jdk-21") : "",
    localAppData ? path.join(localAppData, "Android", "jdk-17") : "",
    "C:\\Program Files\\Eclipse Adoptium\\jdk-21",
    "C:\\Program Files\\Java\\jdk-21",
    "C:\\Program Files\\Java\\jdk-17",
    "C:\\Program Files\\Android\\Android Studio\\jbr",
    "C:\\Program Files\\JetBrains\\PyCharm 2026.2.3\\jbr",
  ].filter(Boolean);
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "bin", "java.exe")) || fs.existsSync(path.join(dir, "bin", "java"))) {
      return dir;
    }
  }
  return process.env.JAVA_HOME || "";
}

function findAndroidSdk() {
  if (process.env.ANDROID_HOME && fs.existsSync(process.env.ANDROID_HOME)) {
    return process.env.ANDROID_HOME;
  }
  const localAppData = process.env.LOCALAPPDATA || "";
  const candidates = [
    localAppData ? path.join(localAppData, "Android", "Sdk") : "",
    "C:\\Android\\Sdk",
  ].filter(Boolean);
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return "";
}

// Recover if a prior interrupted build left .cap-tmp-api/api behind
if (!fs.existsSync(apiDir) && fs.existsSync(stashApiDir)) {
  fs.renameSync(stashApiDir, apiDir);
}

let stashed = false;
try {
  if (fs.existsSync(apiDir)) {
    fs.mkdirSync(stashRoot, { recursive: true });
    fs.renameSync(apiDir, stashApiDir);
    stashed = true;
  }

  // Clear .next cache so Next.js doesn't retain stale server API route types
  if (fs.existsSync(nextDir)) {
    fs.rmSync(nextDir, { recursive: true, force: true });
  }

  console.log("[CAPACITOR] Building static Next.js bundle (out/)...");
  execSync("pnpm exec next build", {
    cwd: rootDir,
    stdio: "inherit",
    env: { ...process.env, CAPACITOR_BUILD: "1" },
  });
} finally {
  if (stashed && fs.existsSync(stashApiDir)) {
    fs.renameSync(stashApiDir, apiDir);
    try {
      fs.rmdirSync(stashRoot);
    } catch {
      // ignore if non-empty
    }
  }
}

const androidDir = path.join(rootDir, "android");
if (fs.existsSync(androidDir)) {
  console.log("[CAPACITOR] Syncing web assets into android/...");
  execSync("pnpm exec cap sync android", { cwd: rootDir, stdio: "inherit" });

  const sdkDir = findAndroidSdk();
  if (sdkDir) {
    const escapedSdk = sdkDir.replace(/\\/g, "/");
    fs.writeFileSync(path.join(androidDir, "local.properties"), `sdk.dir=${escapedSdk}\n`);
  }

  if (wantApk) {
    const javaHome = findJavaHome();
    if (!javaHome) {
      throw new Error("未找到 JDK (JAVA_HOME)，请安装 JDK 17/21/25 或配置 JAVA_HOME。");
    }
    if (!sdkDir) {
      throw new Error("未找到 Android SDK (ANDROID_HOME)，请配置 Android SDK 路径。");
    }
    const gradlew = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
    console.log(`[CAPACITOR] Compiling Android Debug APK (JAVA_HOME=${javaHome})...`);
    execSync(`${gradlew} assembleDebug --no-daemon`, {
      cwd: androidDir,
      stdio: "inherit",
      env: {
        ...process.env,
        JAVA_HOME: javaHome,
        ANDROID_HOME: sdkDir,
        ANDROID_SDK_ROOT: sdkDir,
      },
    });
    const apkPath = path.join(androidDir, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
    if (fs.existsSync(apkPath)) {
      const sizeMb = (fs.statSync(apkPath).size / (1024 * 1024)).toFixed(2);
      console.log(`[CAPACITOR] APK READY (${sizeMb} MB): ${apkPath}`);
    }
  }
}
