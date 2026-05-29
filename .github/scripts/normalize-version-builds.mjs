import fs from 'node:fs';

const [, , inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  console.error('Usage: normalize-version-builds.mjs <input-json> <output-json>');
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const candidates = Array.isArray(payload)
  ? payload
  : payload.versions
    || payload.activeVersions
    || payload.releases
    || payload.items
    || [];

if (!Array.isArray(candidates) || !candidates.length) {
  console.error('Version endpoint must return an array, or an object with versions/activeVersions/releases/items.');
  process.exit(1);
}

const normalizeSegment = (value, label) => {
  const segment = String(value || '').trim().replace(/^\/+|\/+$/g, '');

  if (!segment) {
    console.error(`Missing ${label} in version endpoint response.`);
    process.exit(1);
  }

  if (segment.includes('..') || !/^[A-Za-z0-9._-]+$/.test(segment)) {
    console.error(`Invalid ${label} "${segment}". Use only letters, numbers, dots, underscores, and hyphens.`);
    process.exit(1);
  }

  return segment;
};

const versions = candidates.map((item) => {
  const entry = typeof item === 'string' ? { version: item } : item;
  const version = normalizeSegment(entry.version || entry.name || entry.path || entry.ref || entry.tag, 'version');
  const build = normalizeSegment(entry.path || entry.build || entry.version || version, 'path/build');
  const ref = String(entry.ref || entry.tag || entry.version || version).trim();

  if (!ref) {
    console.error(`Missing git ref for version "${version}".`);
    process.exit(1);
  }

  return {
    version,
    build,
    ref,
    default: Boolean(entry.default || entry.latest || entry.current)
  };
});

const seen = new Set();
for (const entry of versions) {
  if (seen.has(entry.build)) {
    console.error(`Duplicate build path "${entry.build}" in version endpoint response.`);
    process.exit(1);
  }
  seen.add(entry.build);
}

const defaultVersion = payload.defaultVersion || payload.latestVersion || payload.currentVersion;
if (defaultVersion && !versions.some((entry) => entry.default)) {
  const match = versions.find((entry) => entry.version === defaultVersion || entry.build === defaultVersion || entry.ref === defaultVersion);
  if (match) match.default = true;
}

if (!versions.some((entry) => entry.default)) {
  versions[versions.length - 1].default = true;
}

fs.writeFileSync(outputPath, `${JSON.stringify(versions, null, 2)}\n`);
