import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const appName = process.env.APP_NAME ?? "ExcaliApp";
const pkgPath = resolve(process.env.MAS_PKG_PATH ?? `dist/mas/${appName}.pkg`);
const apiKey = process.env.APPLE_API_KEY_ID ?? process.env.APPLE_API_KEY;
const apiIssuer = process.env.APPLE_API_ISSUER;

if (!apiKey) {
  throw new Error("APPLE_API_KEY_ID or APPLE_API_KEY is required for App Store Connect upload.");
}

if (!apiIssuer) {
  throw new Error("APPLE_API_ISSUER is required for App Store Connect upload.");
}

execFileSync(
  "xcrun",
  ["altool", "--upload-app", "--type", "macos", "--file", pkgPath, "--apiKey", apiKey, "--apiIssuer", apiIssuer],
  { stdio: "inherit" },
);
