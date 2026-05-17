const fs = require('fs');
const path = require('path');

const mobileRoot = path.resolve(__dirname, '..');
const agentsRoot = path.resolve(mobileRoot, '..', '..', 'agents', 'kids', 'logicopicolo');
const resultsDir = path.join(agentsRoot, 'results');
const buttonsDir = path.join(agentsRoot, 'visual', 'buttons');
const outputDir = path.join(mobileRoot, 'app', 'modules', 'logicopiccolo', 'generated');

const colorPalette = [
  '#ef4444',
  '#16a34a',
  '#2563eb',
  '#f59e0b',
  '#f97316',
  '#ef4444',
  '#16a34a',
  '#2563eb',
  '#f59e0b',
  '#f97316',
];

function escapeForTemplateLiteral(value) {
  return value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

function normalizeTitle(raw) {
  return raw
    .replace(/^WS_[A-Z0-9]+_/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getWorksheetPairs() {
  const files = fs.readdirSync(resultsDir);
  const buttonDataUriMap = buildButtonDataUriMap();

  const frontFiles = files
    .filter((name) => name.endsWith('_front.html'))
    .sort((a, b) => a.localeCompare(b));

  return frontFiles
    .map((frontFile) => {
      const id = frontFile.replace('_front.html', '');
      const flipFile = `${id}_flip.html`;
      if (!files.includes(flipFile)) {
        return null;
      }

      const frontHtml = replaceButtonImageSrcs(
        fs.readFileSync(path.join(resultsDir, frontFile), 'utf8'),
        buttonDataUriMap,
      );
      const backHtml = replaceButtonImageSrcs(
        fs.readFileSync(path.join(resultsDir, flipFile), 'utf8'),
        buttonDataUriMap,
      );

      return {
        id: id.toLowerCase(),
        title: normalizeTitle(id),
        color: colorPalette[Math.abs(hashCode(id)) % colorPalette.length],
        frontHtml,
        backHtml,
      };
    })
    .filter(Boolean);
}

function buildButtonDataUriMap() {
  const files = fs
    .readdirSync(buttonsDir)
    .filter((name) => name.endsWith('.svg'));

  const map = new Map();
  for (const fileName of files) {
    const svg = fs.readFileSync(path.join(buttonsDir, fileName), 'utf8');
    const encodedSvg = encodeURIComponent(svg)
      .replace(/'/g, '%27')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29');

    map.set(fileName, `data:image/svg+xml;charset=utf-8,${encodedSvg}`);
  }

  return map;
}

function replaceButtonImageSrcs(html, buttonDataUriMap) {
  let next = html;

  next = next.replace(
    /(<img[^>]*\ssrc=["'])([^"']+)(["'][^>]*>)/gi,
    (fullMatch, prefix, src, suffix) => {
      const fileName = path.basename(src);
      const dataUri = buttonDataUriMap.get(fileName);
      if (!dataUri) {
        return fullMatch;
      }
      return `${prefix}${dataUri}${suffix}`;
    },
  );

  next = next.replace(/url\((['"]?)(\.{1,2}\/[^'"\)]+\.svg)\1\)/gi, (fullMatch, quote, src) => {
    const fileName = path.basename(src);
    const dataUri = buttonDataUriMap.get(fileName);
    if (!dataUri) {
      return fullMatch;
    }

    const wrappedUri = quote ? `${quote}${dataUri}${quote}` : dataUri;
    return `url(${wrappedUri})`;
  });

  return next;
}

function getButtonAssets() {
  const files = fs
    .readdirSync(buttonsDir)
    .filter((name) => name.endsWith('.svg'))
    .sort((a, b) => a.localeCompare(b));

  return files.map((fileName, index) => {
    const svg = fs.readFileSync(path.join(buttonsDir, fileName), 'utf8');
    return {
      id: `B${index + 1}`,
      label: `${(index + 1) % 10}`,
      color: colorPalette[index % colorPalette.length],
      svg,
      fileName,
    };
  });
}

function hashCode(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    hash = (hash << 5) - hash + code;
    hash |= 0;
  }
  return hash;
}

function writeWorksheetsModule(pairs) {
  const body = pairs
    .map((pair) => {
      return `  {\n    id: '${pair.id}',\n    title: '${pair.title}',\n    color: '${pair.color}',\n    frontHtml: \`${escapeForTemplateLiteral(pair.frontHtml)}\`,\n    backHtml: \`${escapeForTemplateLiteral(pair.backHtml)}\`,\n  }`;
    })
    .join(',\n');

  const content = `export type WorksheetModel = {\n  id: string;\n  title: string;\n  color: string;\n  frontHtml: string;\n  backHtml: string;\n};\n\nexport const worksheetModels: WorksheetModel[] = [\n${body}\n];\n`;

  fs.writeFileSync(path.join(outputDir, 'worksheets.ts'), content, 'utf8');
}

function writeButtonsModule(buttons) {
  const body = buttons
    .map((button) => {
      return `  {\n    id: '${button.id}',\n    label: '${button.label}',\n    color: '${button.color}',\n    svgXml: \`${escapeForTemplateLiteral(button.svg)}\`,\n  }`;
    })
    .join(',\n');

  const content = `export type ButtonAsset = {\n  id: string;\n  label: string;\n  color: string;\n  svgXml: string;\n};\n\nexport const frameButtons: ButtonAsset[] = [\n${body}\n];\n`;

  fs.writeFileSync(path.join(outputDir, 'buttons.ts'), content, 'utf8');
}

function main() {
  if (!fs.existsSync(resultsDir) || !fs.existsSync(buttonsDir)) {
    throw new Error('Source logicopicolo assets not found in agents folder.');
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const worksheets = getWorksheetPairs();
  const buttons = getButtonAssets();

  if (!worksheets.length) {
    throw new Error('No worksheet front/flip pairs found in results folder.');
  }

  if (!buttons.length) {
    throw new Error('No SVG button files found in visual/buttons folder.');
  }

  writeWorksheetsModule(worksheets);
  writeButtonsModule(buttons);

  // eslint-disable-next-line no-console
  console.log(`Generated ${worksheets.length} worksheet pairs and ${buttons.length} buttons.`);
}

main();
