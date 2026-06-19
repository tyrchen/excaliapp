import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appName = process.env.APP_NAME ?? "ExcaliApp";
const targetDir = process.env.MAS_TARGET_DIR ?? "aarch64-apple-darwin";
const signingIdentity = process.env.APPLE_INSTALLER_SIGNING_IDENTITY;
const cargoTargetRoot = process.env.CARGO_TARGET_DIR
  ? resolve(process.env.CARGO_TARGET_DIR)
  : resolve(root, "src-tauri", "target");
const appPath = resolve(cargoTargetRoot, targetDir, "release", "bundle", "macos", `${appName}.app`);
const outputPath = resolve(root, process.env.MAS_PKG_PATH ?? `dist/mas/${appName}.pkg`);

if (!signingIdentity) {
  throw new Error('APPLE_INSTALLER_SIGNING_IDENTITY is required, for example "3rd Party Mac Developer Installer: Name (TEAMID)".');
}

mkdirSync(dirname(outputPath), { recursive: true });

execFileSync(
  "xcrun",
  ["productbuild", "--sign", signingIdentity, "--component", appPath, "/Applications", outputPath],
  { stdio: "inherit" },
);

console.log(`Created ${outputPath}`);
