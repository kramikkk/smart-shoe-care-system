# Application

Android kiosk launcher for the Smart Shoe Care System. The app locks a tablet into a full-screen WebView that loads the Next.js kiosk UI, preventing customers from exiting or using the device for anything else.

---

## What It Does

- Opens the Next.js kiosk web app in a full-screen, kiosk-mode WebView
- Locks the device using Android Device Policy Manager (Device Admin)
- Hides the navigation bar, status bar, and back gesture
- Automatically restarts and reloads the web app on network loss and screen-on events
- Starts automatically on device boot via a `BootReceiver`
- Requires a PIN to exit kiosk mode (for service/maintenance access)
- Persists the backend URL and PIN in encrypted `SharedPreferences`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Kotlin |
| Platform | Android |
| Min SDK | 27 (Android 8.1) |
| Target SDK | 36 |
| Build System | Gradle 9.1.1 (AGP) |
| Credential Storage | `androidx.security:security-crypto` |
| UI | WebView + DrawerLayout (Material 3) |

---

## Project Structure

```
application/
├── build.gradle.kts                    # Top-level Gradle config
├── gradle/
│   └── libs.versions.toml             # Dependency version catalog
└── app/
    ├── build.gradle.kts               # App module config (min/target SDK, versions)
    └── src/main/java/com/example/application/
        ├── MainActivity.kt            # Entry point — kiosk mode, WebView, network handling
        ├── KioskWebView.kt            # WebView subclass with kiosk-specific settings
        ├── KioskApplication.kt        # Application class
        ├── KioskAccessibilityService.kt # Prevents back/home navigation
        ├── KioskDeviceAdminReceiver.kt  # Device Admin policy receiver
        ├── KioskPrefs.kt              # SharedPreferences keys
        ├── PinPreferences.kt          # Encrypted PIN storage
        └── BootReceiver.kt            # Auto-start on device boot
```

---

## Build

### Requirements

- Android Studio Meerkat or later
- Android SDK with API 36 platform tools
- JDK 11+

### Debug build

```bash
cd application
./gradlew assembleDebug
```

The APK is output to `app/build/outputs/apk/debug/app-debug.apk`.

### Release build

```bash
./gradlew assembleRelease
```

Configure signing in `app/build.gradle.kts` or via an Android Studio signing config before building for production deployment.

---

## Device Setup

1. Install the APK on the tablet.
2. Grant **Device Admin** permission when prompted (required for kiosk lock).
3. Open the app — a setup drawer will appear on first launch.
4. Enter the backend URL (e.g. `http://192.168.1.x:3000`) and a PIN.
5. The app locks into kiosk mode and loads the kiosk UI.
6. To exit kiosk mode, swipe open the hidden drawer and enter the PIN.

### Connecting to the Backend

The app connects to the Next.js fullstack server over the local network. The tablet and the ESP32 main board must be on the same network as the backend. Set the backend URL to the machine's local IP or a public domain if hosted remotely.
