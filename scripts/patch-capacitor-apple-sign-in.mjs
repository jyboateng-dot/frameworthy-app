import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// @capacitor-community/apple-sign-in@7 currently declares Capacitor 7's
// Swift package, while this app is on Capacitor 8. Keep the JS plugin and
// native API unchanged, but widen its local Swift dependency so the generated
// Capacitor package can resolve against the app's Capacitor 8 toolchain.
const packagePath = 'node_modules/@capacitor-community/apple-sign-in/Package.swift';

if (!existsSync(packagePath)) process.exit(0);

const source = readFileSync(packagePath, 'utf8');
const patched = source.replace(
  '.package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "7.0.0")',
  '.package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")',
);

if (patched !== source) {
  writeFileSync(packagePath, patched);
  console.log('[postinstall] aligned Apple Sign In Swift dependency with Capacitor 8');
}
