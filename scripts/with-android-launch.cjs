const fs = require("node:fs/promises");
const path = require("node:path");
const {
  AndroidConfig,
  withAndroidColors,
  withAndroidColorsNight,
  withAndroidManifest,
  withAndroidStyles,
  withDangerousMod,
} = require("expo/config-plugins");

const background = "solace_launch_background";
const appTheme = { name: "AppTheme" };
const launchTheme = { name: "Theme.App.SplashScreen", parent: "AppTheme" };
const setColor = (value) => (mod) => {
  mod.modResults = AndroidConfig.Colors.setColorItem(
    AndroidConfig.Resources.buildResourceItem({ name: background, value }),
    mod.modResults,
  );
  return mod;
};

module.exports = (config) => {
  config = withAndroidColors(config, setColor("#FBF0E8"));
  config = withAndroidColorsNight(config, setColor("#000000"));
  config = withAndroidStyles(config, (mod) => {
    const set = (parent, name, value, targetApi) => {
      mod.modResults = AndroidConfig.Styles.assignStylesValue(mod.modResults, {
        add: true,
        parent,
        name,
        value,
        targetApi,
      });
    };
    // The activity switches to AppTheme before creating the React view.
    set(appTheme, "android:windowBackground", `@color/${background}`);
    set(appTheme, "android:windowLightStatusBar", "?attr/isLightTheme");
    // Older Android versions never read this optional window attribute.
    set(
      appTheme,
      "android:windowLightNavigationBar",
      "?attr/isLightTheme",
      "27",
    );
    set(
      launchTheme,
      "android:windowBackground",
      "@drawable/solace_legacy_launch",
    );
    // Android 12+ reads these system splash attributes. Earlier versions use
    // the drawable window background above.
    set(
      launchTheme,
      "android:windowSplashScreenBackground",
      `@color/${background}`,
      "31",
    );
    set(
      launchTheme,
      "android:windowSplashScreenAnimatedIcon",
      "@drawable/solace_launch_logo",
      "31",
    );
    return mod;
  });
  config = withAndroidManifest(config, (mod) => {
    const removal = mod.modResults.manifest["uses-permission"]?.find(
      ({ $ }) =>
        $["android:name"] === "android.permission.CAMERA" &&
        $["tools:node"] === "remove",
    );
    if (removal) {
      // Expo's merge directive removes CAMERA from the final manifest. Lint
      // otherwise interprets the directive itself as requiring camera hardware.
      removal.$["tools:ignore"] =
        "PermissionImpliesUnsupportedChromeOsHardware";
    }
    return mod;
  });
  return withDangerousMod(config, [
    "android",
    async (mod) => {
      const res = path.join(
        mod.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
      );
      const logoDir = path.join(res, "drawable-nodpi");
      await fs.mkdir(logoDir, { recursive: true });
      await fs.mkdir(path.join(res, "drawable"), { recursive: true });
      await fs.copyFile(
        path.join(
          mod.modRequest.projectRoot,
          "assets",
          "app-icons",
          "solace-android-foreground.png",
        ),
        path.join(logoDir, "solace_launch_logo.png"),
      );
      await fs.writeFile(
        path.join(res, "drawable", "solace_legacy_launch.xml"),
        `<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item android:drawable="@color/${background}" />
  <item android:drawable="@drawable/solace_launch_logo"
    android:width="288dp" android:height="288dp" android:gravity="center" />
</layer-list>\n`,
      );
      return mod;
    },
  ]);
};
