# Publishing Guide

This guide is for maintainers who publish ExcaliApp builds.

## Windows Installer

### Prerequisites

Install Rust via [rustup](https://rustup.rs/), then add the MSVC toolchain:

```bash
rustup target add x86_64-pc-windows-msvc
```

Visual Studio Build Tools (C++ workload) are also required. Install them from
the [Visual Studio downloads page](https://visualstudio.microsoft.com/downloads/) or via winget:

```bash
winget install Microsoft.VisualStudio.2022.BuildTools
```

### NSIS installer (.exe)

Produces a user-friendly wizard-style installer.

```bash
npm run tauri build -- --bundles nsis
```

Output: `src-tauri/target/release/bundle/nsis/ExcaliApp_<version>_x64-setup.exe`

### MSI installer (.msi)

Produces a Windows Installer package suitable for enterprise deployment and Group Policy.

```bash
npm run tauri build -- --bundles msi
```

Output: `src-tauri/target/release/bundle/msi/ExcaliApp_<version>_x64_en-US.msi`

### Both formats at once

```bash
npm run tauri build -- --bundles nsis,msi
```

### Notes

- The `--bundles` flag overrides the `targets` array in `tauri.conf.json` for that run, so the macOS config is unaffected.
- Windows builds must be run on a Windows machine; cross-compilation is not supported by Tauri.
- The installer is unsigned by default. Windows SmartScreen will warn end users. To suppress the warning, sign the output with a code-signing certificate:
  ```bash
  signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /f cert.pfx /p <password> ExcaliApp_*_x64-setup.exe
  ```

---

## GitHub Release

Every pushed `v*` tag, such as `v0.3.0`, triggers `.github/workflows/release.yml`.

The workflow builds:

- macOS Apple Silicon DMG (`aarch64-apple-darwin`)
- Linux x86_64 AppImage

It then creates a GitHub Release and uploads both assets.

Publish a GitHub Release:

```bash
git checkout master
git pull --ff-only origin master
git tag -a v0.3.0 -m "Release v0.3.0"
git push origin v0.3.0
```

Notes:

- macOS builds require macOS 12 or newer and target Apple Silicon only.
- The DMG is not App Store signed or notarized. macOS Gatekeeper may show an unsigned-app warning until Developer ID signing and notarization are added.
- Keep `package-lock.json` and `src-tauri/Cargo.lock` committed for reproducible release builds.
- If the release workflow changes after a tag is pushed, use a new tag or intentionally move the existing tag after verifying the impact.

## Manual Mac App Store Release

The Mac App Store workflow is separate from GitHub Releases and only runs when manually triggered from GitHub Actions.

The workflow:

- builds the signed MAS `.pkg`
- uploads it to App Store Connect
- stores the package as a workflow artifact

Configure these repository secrets before running `.github/workflows/app-store-release.yml`:

```text
APPLE_TEAM_ID
APPLE_CERTIFICATE_BASE64
APPLE_CERTIFICATE_PASSWORD
APPLE_INSTALLER_CERTIFICATE_BASE64
APPLE_INSTALLER_CERTIFICATE_PASSWORD
APPLE_API_KEY_ID
APPLE_API_ISSUER
APPLE_API_PRIVATE_KEY_BASE64
KEYCHAIN_PASSWORD
MAS_PROVISION_PROFILE_BASE64
```

Generate the base64 values locally:

```bash
base64 -i AppleDistribution.p12 | pbcopy
base64 -i AppleInstaller.p12 | pbcopy
base64 -i AuthKey_XXXXXXXXXX.p8 | pbcopy
base64 -i ExcaliApp.provisionprofile | pbcopy
```

Run the workflow manually from GitHub Actions:

1. Open **Actions**.
2. Select **App Store Release**.
3. Click **Run workflow**.
4. Enter the version label, such as `v0.3.0`.

Notes:

- The Mac App Store build uses `src-tauri/tauri.appstore.conf.json`, `src-tauri/Entitlements.mas.plist.template`, and a generated local `embedded.provisionprofile`.
- Generated signing/provisioning files are intentionally ignored by git.
- The app is sandboxed and uses user-selected read/write access. If persistent access to the last opened folder after app restart is required, implement security-scoped bookmarks before relying on automatic folder restore in the store build.
