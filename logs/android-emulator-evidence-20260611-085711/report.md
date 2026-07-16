# Android Emulator Evidence Report

Date: 2026-06-11 08:57:14 +02:00
Workspace: D:\madkontrol-app
SDK: D:\Android\Sdk

## Reproduction status
Blocked before app launch. ADB is installed and usable from D:\Android\Sdk\platform-tools\adb.exe, but no emulator/device is attached. emulator -list-avds returned no configured AVDs. The workspace android directory is empty, and the repo scan found no Gradle Android project files, manifest, wrapper, or APK.

## Evidence captured
- adb-version.txt: ADB version and install path.
- adb-devices.txt: Connected device list; currently empty.
- avd-list.txt: Configured AVD list; currently empty.
- sdk-layout.txt: Installed SDK folder overview.
- android-dir-tree.txt: Empty android directory confirmation.
- android-target-scan.txt: Android project/APK scan result.
- screenshot-not-captured.txt: Screenshot capture blocker.
- ui-state-not-captured.txt: UIAutomator capture blocker.
- logcat-not-captured.txt: Logcat capture blocker.
- performance-not-captured.txt: Perfetto/gfxinfo/simpleperf capture blocker.

## Next required inputs
To reproduce an actual emulator issue, provide or configure one of:
- a connected/running emulator or physical device visible in adb devices -l,
- a local AVD that emulator -list-avds can see,
- an APK/package name to install and launch,
- or a Gradle Android project/variant in this workspace.

Once that exists, the focused capture flow should be: install/launch package, clear logcat, drive the exact issue flow, save screenshot, dump UIAutomator XML, save logcat/crash buffer, capture gfxinfo framestats, and then take Perfetto or Simpleperf for the narrow flow.
