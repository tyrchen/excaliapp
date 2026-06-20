import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

const appName = process.env.APP_NAME ?? "ExcaliApp";
const teamId = process.env.APPLE_TEAM_ID ?? "P5YL2MWHJ8";
const signingIdentity =
  process.env.APPLE_SIGNING_IDENTITY ?? `Developer ID Application: Tian Chen (${teamId})`;
const target = process.env.MACOS_TARGET ?? "aarch64-apple-darwin";
const archLabel = process.env.MACOS_ARCH_LABEL ?? "arm64";
const version = process.env.VERSION ?? process.env.GITHUB_REF_NAME ?? packageJson.version;

function resolveCargoTargetRoot() {
  if (process.env.CARGO_TARGET_DIR) {
    return resolve(process.env.CARGO_TARGET_DIR);
  }

  const metadata = execFileSync("cargo", ["metadata", "--format-version", "1", "--no-deps"], {
    cwd: resolve(root, "src-tauri"),
    encoding: "utf8",
  });
  return JSON.parse(metadata).target_directory;
}

const cargoTargetRoot = resolveCargoTargetRoot();
const targetReleaseRoot = resolve(cargoTargetRoot, target, "release");
const appPath = resolve(targetReleaseRoot, "bundle", "macos", `${appName}.app`);
const dmgSourceDir = resolve(targetReleaseRoot, "bundle", "dmg");
const releaseDir = resolve(root, process.env.RELEASE_DIR ?? `dist/releases/macos/${appName}-${version}`);
const releaseDmg = resolve(releaseDir, `${appName}-${version}-macos-${archLabel}.dmg`);
const releaseManifest = resolve(releaseDir, "release.json");

const args = new Set(process.argv.slice(2));
const shouldBuild = !args.has("--skip-build");
const shouldNotarize = args.has("--notarize") || process.env.NOTARIZE === "1";

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: root,
    env: {
      ...process.env,
      APPLE_SIGNING_IDENTITY: signingIdentity,
    },
    stdio: "inherit",
    ...options,
  });
}

function output(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: root,
    env: {
      ...process.env,
      APPLE_SIGNING_IDENTITY: signingIdentity,
    },
    encoding: "utf8",
    ...options,
  }).trim();
}

function combinedOutput(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: {
      ...process.env,
      APPLE_SIGNING_IDENTITY: signingIdentity,
    },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }
  return `${result.stdout}${result.stderr}`.trim();
}

function optionalOutput(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return "";
  }
  return result.stdout.trim();
}

function findDmg() {
  const listing = output("find", [dmgSourceDir, "-maxdepth", "1", "-name", "*.dmg", "-print"]);
  const matches = listing.split("\n").filter(Boolean);
  if (matches.length === 0) {
    throw new Error(`No DMG found in ${dmgSourceDir}`);
  }
  if (matches.length > 1) {
    throw new Error(`Expected one DMG in ${dmgSourceDir}, found: ${matches.join(", ")}`);
  }
  return matches[0];
}

function requireNotaryArgs() {
  if (process.env.NOTARY_PROFILE) {
    return ["--keychain-profile", process.env.NOTARY_PROFILE];
  }

  const apiKeyPath = process.env.APPLE_API_KEY_PATH;
  const apiKeyId = process.env.APPLE_API_KEY_ID ?? process.env.APPLE_API_KEY;
  const issuer = process.env.APPLE_API_ISSUER;
  if (apiKeyPath && apiKeyId && issuer) {
    return ["--key", apiKeyPath, "--key-id", apiKeyId, "--issuer", issuer];
  }

  throw new Error(
    "Notarization requires NOTARY_PROFILE, or APPLE_API_KEY_PATH + APPLE_API_KEY_ID + APPLE_API_ISSUER.",
  );
}

function verifySignedApp() {
  if (!existsSync(appPath)) {
    throw new Error(`Missing app bundle: ${appPath}. Run without --skip-build or build the macOS DMG first.`);
  }

  run("codesign", ["--verify", "--deep", "--strict", "--verbose=4", appPath]);
  const signature = combinedOutput("codesign", ["-dvvv", appPath]);

  if (!signature.includes("Authority=Developer ID Application")) {
    throw new Error(`${appPath} is not signed with a Developer ID Application identity.`);
  }
  if (!signature.includes("Timestamp=")) {
    throw new Error(`${appPath} is missing a secure timestamp.`);
  }

  const entitlements = output("codesign", ["-d", "--entitlements", ":-", appPath], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (entitlements.includes("get-task-allow")) {
    throw new Error(`${appPath} contains get-task-allow; refusing to release a Developer ID build.`);
  }
}

function notarizeDmg(dmgPath) {
  const credentials = requireNotaryArgs();
  run("xcrun", ["notarytool", "submit", dmgPath, "--wait", ...credentials]);
  run("xcrun", ["stapler", "staple", dmgPath]);
  run("xcrun", ["stapler", "validate", dmgPath]);
  run("spctl", ["--assess", "--type", "open", "--context", "context:primary-signature", "--verbose=4", dmgPath]);
}

function sha256(filePath) {
  return output("shasum", ["-a", "256", filePath]).split(/\s+/)[0];
}

function writeManifest(dmgPath, checksum) {
  const createdAt = output("date", ["-u", "+%Y-%m-%dT%H:%M:%SZ"]);
  const gitCommit = optionalOutput("git", ["rev-parse", "HEAD"]) || "unknown";
  const sizeBytes = Number(output("stat", ["-f", "%z", dmgPath]));
  const manifest = {
    product: appName,
    artifactType: "developer-id-dmg",
    version,
    gitCommit,
    createdAt,
    minimumMacOSVersion: "12.0",
    supportedArchitectures: [archLabel],
    bundleIdentifier: "com.tchen.excaliapp",
    developerTeamId: teamId,
    signingIdentity,
    download: {
      fileName: basename(dmgPath),
      sha256: checksum,
      sizeBytes,
      contentType: "application/x-apple-diskimage",
    },
    verification: {
      developerIdSigned: true,
      notarizedAndStapled: shouldNotarize,
      checksumAlgorithm: "sha256",
    },
  };

  writeFileSync(releaseManifest, `${JSON.stringify(manifest, null, 2)}\n`);
}

if (args.size > 0) {
  for (const arg of args) {
    if (!["--skip-build", "--notarize"].includes(arg)) {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
}

if (shouldBuild) {
  run("npm", ["run", "tauri", "--", "build", "--bundles", "app,dmg", "--target", target]);
}

verifySignedApp();

const sourceDmg = findDmg();
run("hdiutil", ["verify", sourceDmg]);

rmSync(releaseDir, { recursive: true, force: true });
mkdirSync(releaseDir, { recursive: true });
copyFileSync(sourceDmg, releaseDmg);

if (shouldNotarize) {
  notarizeDmg(releaseDmg);
} else {
  console.warn("Warning: built a signed but unnotarized DMG. Use --notarize for external distribution.");
}

const checksum = sha256(releaseDmg);
writeFileSync(`${releaseDmg}.sha256`, `${checksum}  ${basename(releaseDmg)}\n`);
writeManifest(releaseDmg, checksum);

console.log(`release_dmg=${releaseDmg}`);
console.log(`release_manifest=${releaseManifest}`);
