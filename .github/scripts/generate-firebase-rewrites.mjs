import fs from 'node:fs';

const [, , firebasePath, versionsPath] = process.argv;

if (!firebasePath || !versionsPath) {
  console.error('Usage: generate-firebase-rewrites.mjs <firebase-json> <versions-json>');
  process.exit(1);
}

const firebaseConfig = JSON.parse(fs.readFileSync(firebasePath, 'utf8'));
const versions = JSON.parse(fs.readFileSync(versionsPath, 'utf8'));

if (!Array.isArray(versions) || !versions.length) {
  console.error('No versions found for Firebase rewrites.');
  process.exit(1);
}

const defaultVersion = versions.find((entry) => entry.default) || versions[versions.length - 1];
const rewrites = [
  ...versions.map((entry) => ({
    source: `/${entry.build}{,/**}`,
    destination: `/${entry.build}/index.html`
  })),
  {
    source: '**',
    destination: `/${defaultVersion.build}/index.html`
  }
];

const hostingEntries = Array.isArray(firebaseConfig.hosting)
  ? firebaseConfig.hosting
  : [firebaseConfig.hosting];

if (!hostingEntries.length || hostingEntries.some((entry) => !entry)) {
  console.error('firebase.json must contain a hosting object or hosting array.');
  process.exit(1);
}

for (const hosting of hostingEntries) {
  hosting.rewrites = rewrites;
}

fs.writeFileSync(firebasePath, `${JSON.stringify(firebaseConfig, null, 2)}\n`);
