import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tauriDir = resolve(root, "src-tauri");
const tauriConfig = JSON.parse(readFileSync(resolve(tauriDir, "tauri.conf.json"), "utf8"));

const bundleIdentifier = process.env.BUNDLE_IDENTIFIER ?? tauriConfig.identifier;
const teamId = process.env.APPLE_TEAM_ID;
const provisioningProfile = process.env.MAS_PROVISION_PROFILE;

if (!teamId) {
  throw new Error("APPLE_TEAM_ID is required to generate Mac App Store entitlements.");
}

if (!provisioningProfile) {
  throw new Error("MAS_PROVISION_PROFILE must point to your Mac App Store Connect .provisionprofile file.");
}

const templatePath = resolve(tauriDir, "Entitlements.mas.plist.template");
const generatedEntitlementsPath = resolve(tauriDir, "Entitlements.mas.generated.plist");
const embeddedProfilePath = resolve(tauriDir, "embedded.provisionprofile");

const entitlements = readFileSync(templatePath, "utf8")
  .replaceAll("__APPLE_TEAM_ID__", teamId)
  .replaceAll("__BUNDLE_IDENTIFIER__", bundleIdentifier);

mkdirSync(dirname(generatedEntitlementsPath), { recursive: true });
writeFileSync(generatedEntitlementsPath, entitlements);
copyFileSync(resolve(provisioningProfile), embeddedProfilePath);

console.log(`Generated ${generatedEntitlementsPath}`);
console.log(`Copied provisioning profile to ${embeddedProfilePath}`);
