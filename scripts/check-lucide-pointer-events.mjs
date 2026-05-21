import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['app', 'components'];
const failures = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walk(path);
    } else if (path.endsWith('.tsx')) {
      checkFile(path);
    }
  }
}

function checkFile(path) {
  const source = readFileSync(path, 'utf8');
  const icons = [...source.matchAll(/import\s+\{([^}]+)\}\s+from\s+'lucide-react-native';/g)]
    .flatMap((match) => match[1].split(','))
    .map((name) => name.trim())
    .filter(Boolean);

  if (!icons.length) return;

  for (const icon of icons) {
    const regex = new RegExp(`<${icon}\\b(?![^>]*pointerEvents=["']none["'])`, 'g');
    let match;
    while ((match = regex.exec(source))) {
      const line = source.slice(0, match.index).split('\n').length;
      failures.push(`${path}:${line} <${icon}> missing pointerEvents="none"`);
    }
  }
}

for (const root of roots) {
  walk(root);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
