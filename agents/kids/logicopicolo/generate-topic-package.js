const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CONTENT_DIR = path.join(ROOT, 'content');
const RESULTS_DIR = path.join(ROOT, 'results');

const buttonBySlot = {
  S1: 'btn-01-red.svg',
  S2: 'btn-02-green.svg',
  S3: 'btn-03-blue.svg',
  S4: 'btn-04-yellow.svg',
  S5: 'btn-05-orange.svg',
  S6: 'btn-06-red-white-top.svg',
  S7: 'btn-07-green-white-top.svg',
  S8: 'btn-08-blue-white-top.svg',
  S9: 'btn-09-yellow-white-top.svg',
  S10: 'btn-10-orange-white-top.svg'
};

const slotIds = Object.keys(buttonBySlot);

const iconByKey = {
  root: '🌱', stem: '🪴', leaf: '🍃', flower: '🌸', fruit: '🍎', seed: '🌰', bud: '🌿', bark: '🪵', vein: '🧬', petal: '🌺', sepal: '🌼', stomata: '🍃',
  dog: '🐶', cat: '🐱', cow: '🐄', horse: '🐴', goat: '🐐', lion: '🦁', hen: '🐔', frog: '🐸', sheep: '🐑', deer: '🦌',
  hammer: '🔨', screwdriver: '🪛', scissors: '✂️', spanner: '🔧', paint_brush: '🖌️', ruler: '📏', magnifying_glass: '🔍', thermometer: '🌡️', compass: '🧭', glue_gun: '🧴'
};

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function parseMeta(lines) {
  const meta = {};
  for (const line of lines) {
    const match = line.match(/^\-\s*(package_id|student_id|grade|topic|language|generated_for_cycle)\s*:\s*(.+)$/);
    if (match) meta[match[1]] = match[2].trim();
  }
  return meta;
}

function parseCount(lines, key) {
  const line = lines.find((entry) => entry.trim().startsWith(`- ${key}:`));
  if (!line) return 0;
  const match = line.match(/:\s*(\d+)/);
  return match ? Number(match[1]) : 0;
}

function parseMarkdownTable(lines, header) {
  const idx = lines.findIndex((line) => line.trim() === `## ${header}`);
  if (idx < 0) return [];

  const tableLines = [];
  for (let i = idx + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line.startsWith('## ')) break;
    if (line.startsWith('|')) tableLines.push(line);
  }

  if (tableLines.length < 3) return [];
  const headers = tableLines[0].split('|').map((cell) => cell.trim()).filter(Boolean);
  return tableLines.slice(2).map((row) => {
    const values = row.split('|').map((cell) => cell.trim()).filter(Boolean);
    return Object.fromEntries(headers.map((key, index) => [key, values[index] || '']));
  });
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromText(text) {
  let seed = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    seed ^= text.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}

function shuffle(values, seedText) {
  const list = [...values];
  const random = mulberry32(seedFromText(seedText));
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function parsePackage(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  return {
    meta: parseMeta(lines),
    easyCount: parseCount(lines, 'easy_count'),
    mediumCount: parseCount(lines, 'medium_count'),
    hardCount: parseCount(lines, 'hard_count'),
    blueprints: parseMarkdownTable(lines, 'Worksheet Blueprint Table'),
    pairBank: parseMarkdownTable(lines, 'Worksheet Pair Bank')
  };
}

function validatePackage(model) {
  const counts = { easy: 0, medium: 0, hard: 0 };
  for (const blueprint of model.blueprints) {
    counts[blueprint.difficulty] = (counts[blueprint.difficulty] || 0) + 1;
  }
  if ((counts.easy || 0) !== model.easyCount || (counts.medium || 0) !== model.mediumCount || (counts.hard || 0) !== model.hardCount) {
    throw new Error(`Difficulty counts do not match blueprint rows. expected easy=${model.easyCount}, medium=${model.mediumCount}, hard=${model.hardCount}; got easy=${counts.easy || 0}, medium=${counts.medium || 0}, hard=${counts.hard || 0}`);
  }

  const pairBankById = Object.fromEntries(model.pairBank.map((pair) => [pair.pair_id, pair]));
  for (const blueprint of model.blueprints) {
    const pairIds = blueprint.pair_ids.split(',').map((entry) => entry.trim()).filter(Boolean);
    if (pairIds.length !== 10) throw new Error(`${blueprint.worksheet_id} must reference exactly 10 pair_ids`);
    for (const pairId of pairIds) {
      if (!pairBankById[pairId]) throw new Error(`${blueprint.worksheet_id} references missing pair_id ${pairId}`);
    }
  }
  return pairBankById;
}

function buildWorksheet(model, blueprint, pairs) {
  const items = pairs.map((pair, index) => ({
    slot: slotIds[index],
    leftLabel: pair.left_label,
    iconKey: pair.left_icon_key,
    rid: `R${index + 1}`,
    rightLabel: pair.right_label
  }));

  const leftOrder = shuffle(items.map((item) => item.slot), `${blueprint.worksheet_id}:left`);
  const rightOrder = shuffle(items.map((item) => ({ rid: item.rid, rightLabel: item.rightLabel })), `${blueprint.worksheet_id}:right`);

  return {
    worksheetId: blueprint.worksheet_id,
    instruction: `Match each ${String(blueprint.concept_focus || model.meta.topic || 'item').toLowerCase()} with the correct answer.`,
    meta: model.meta,
    difficulty: blueprint.difficulty,
    conceptFocus: blueprint.concept_focus,
    sourceModalityUsed: blueprint.source_modality_used,
    items,
    leftOrder,
    rightOrder
  };
}

function toContentMarkdown(worksheet) {
  return [
    `# Worksheet Content: ${worksheet.worksheetId}`,
    '',
    '## Metadata',
    `- worksheet_id: ${worksheet.worksheetId}`,
    `- student_id: ${worksheet.meta.student_id}`,
    `- grade: ${worksheet.meta.grade}`,
    `- topic: ${worksheet.meta.topic}`,
    `- language: ${worksheet.meta.language}`,
    '- structure_version: LP_FIXED_V1',
    `- difficulty: ${worksheet.difficulty}`,
    `- concept_focus: ${worksheet.conceptFocus}`,
    `- source_modality_used: ${worksheet.sourceModalityUsed}`,
    '',
    '## Instruction',
    worksheet.instruction,
    '',
    '## Item Table',
    '| slot_id | left_label | left_icon_key | right_option_id | right_label |',
    '|---|---|---|---|---|',
    ...worksheet.items.map((item) => `| ${item.slot} | ${item.leftLabel} | ${item.iconKey} | ${item.rid} | ${item.rightLabel} |`),
    '',
    '## Left Column Display Order',
    ...worksheet.leftOrder.map((slot) => {
      const item = worksheet.items.find((entry) => entry.slot === slot);
      return `- ${slot} ${item.leftLabel}`;
    }),
    '',
    '## Right Column Display Order',
    ...worksheet.rightOrder.map((entry) => `- ${entry.rid} ${entry.rightLabel}`),
    '',
    '## Answer Mapping',
    ...worksheet.items.map((item) => `- ${item.slot} -> ${item.rid}`),
    ''
  ].join('\n');
}

function renderFront(worksheet) {
  const setNo = (worksheet.worksheetId.match(/_SET(\d+)_/) || [, ''])[1].replace(/^0+/, '') || '1';
  const itemBySlot = Object.fromEntries(worksheet.items.map((item) => [item.slot, item]));
  const leftHtml = worksheet.leftOrder.map((slot) => {
    const item = itemBySlot[slot];
    const icon = iconByKey[item.iconKey] || '🧩';
    const button = buttonBySlot[slot];
    return `<div class="card"><div class="icon">${icon}</div><div><div class="txt">${esc(item.leftLabel)}</div><div class="slot">Slot ${slot}</div></div><div class="slot-btn"><img src="../visual/buttons/${button}" alt="${slot}" /></div></div>`;
  }).join('\n        ');
  const rightHtml = worksheet.rightOrder.map((entry) => `<div class="opt"><div class="oid">${entry.rid}</div><div>${esc(entry.rightLabel)}</div></div>`).join('\n        ');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${worksheet.worksheetId} Front</title>
  <style>
    :root { --w: 794px; --h: 1123px; --line: #666; --head-bg: #d8efcb; --head-border: #80aa75; --panel-bg: #f8f8f4; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 18px; background: #ecefe8; font-family: "Trebuchet MS", Verdana, sans-serif; }
    .sheet { width: var(--w); height: var(--h); margin: 0 auto; background: #fff; border: 1.4px solid var(--line); position: relative; }
    .header { margin: 10px; border: 1px solid var(--head-border); background: var(--head-bg); padding: 10px 12px; display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
    .title { font-size: 15px; font-weight: 700; }
    .meta { font-size: 12px; color: #333; margin-top: 2px; }
    .badge { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); display: grid; place-items: center; font-weight: 700; background: #f3f3f3; }
    .board { margin: 0 10px 10px; height: calc(100% - 92px); display: grid; grid-template-columns: 1fr 220px; gap: 10px; }
    .left { border: 1px solid var(--line); background: #fff; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px; align-content: start; }
    .card { border: 1px dashed #bbb; border-radius: 6px; padding: 8px; display: grid; grid-template-columns: 44px 1fr auto; gap: 8px; align-items: center; min-height: 88px; }
    .icon { font-size: 30px; text-align: center; }
    .txt { font-size: 14px; font-weight: 700; }
    .slot { font-size: 12px; color: #333; margin-top: 4px; }
    .slot-btn img { width: 28px; height: 28px; display: block; }
    .right { border: 1px solid var(--line); background: var(--panel-bg); display: grid; grid-template-rows: repeat(10, 1fr); }
    .opt { border-bottom: 1px solid var(--line); padding: 6px; display: grid; grid-template-columns: 36px 1fr; gap: 6px; align-items: center; font-size: 13px; }
    .opt:last-child { border-bottom: 0; }
    .oid { font-weight: 700; text-align: center; }
    @media print { body { background: #fff; padding: 0; } .sheet { border: 1px solid #444; } }
  </style>
</head>
<body>
  <article class="sheet">
    <header class="header">
      <div>
        <div class="title">${esc(worksheet.instruction)}</div>
        <div class="meta">Worksheet ID: ${worksheet.worksheetId} | Structure: LP_FIXED_V1 | Side: Front</div>
      </div>
      <div class="badge">${setNo}</div>
    </header>
    <section class="board">
      <div class="left">
        ${leftHtml}
      </div>
      <aside class="right">
        ${rightHtml}
      </aside>
    </section>
  </article>
</body>
</html>
`;
}

function renderFlip(worksheet) {
  const setNo = (worksheet.worksheetId.match(/_SET(\d+)_/) || [, ''])[1].replace(/^0+/, '') || '1';
  const itemBySlot = Object.fromEntries(worksheet.items.map((item) => [item.slot, item]));
  const slotByRid = Object.fromEntries(worksheet.items.map((item) => [item.rid, item.slot]));
  const leftHtml = worksheet.leftOrder.map((slot) => {
    const item = itemBySlot[slot];
    const icon = iconByKey[item.iconKey] || '🧩';
    const button = buttonBySlot[slot];
    return `<div class="card"><div class="icon">${icon}</div><div><div class="txt">${esc(item.leftLabel)}</div><div class="slot">Slot ${slot}</div></div><div class="slot-btn"><img src="../visual/buttons/${button}" alt="${slot}" /></div></div>`;
  }).join('\n        ');
  const rightHtml = worksheet.rightOrder.map((entry) => {
    const slot = slotByRid[entry.rid];
    const button = buttonBySlot[slot];
    return `<div class="opt"><div class="oid">${entry.rid}</div><div>${esc(entry.rightLabel)}</div><div class="ans-btn"><img src="../visual/buttons/${button}" alt="${slot}" /></div></div>`;
  }).join('\n        ');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${worksheet.worksheetId} Flip</title>
  <style>
    :root { --w: 794px; --h: 1123px; --line: #666; --head-bg: #feeec9; --head-border: #b28d44; --panel-bg: #faf7ef; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 18px; background: #ecefe8; font-family: "Trebuchet MS", Verdana, sans-serif; }
    .sheet { width: var(--w); height: var(--h); margin: 0 auto; background: #fff; border: 1.4px solid var(--line); position: relative; }
    .header { margin: 10px; border: 1px solid var(--head-border); background: var(--head-bg); padding: 10px 12px; display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
    .title { font-size: 15px; font-weight: 700; }
    .meta { font-size: 12px; color: #333; margin-top: 2px; }
    .badge { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); display: grid; place-items: center; font-weight: 700; background: #f3f3f3; }
    .board { margin: 0 10px 10px; height: calc(100% - 92px); display: grid; grid-template-columns: 1fr 220px; gap: 10px; }
    .left { border: 1px solid var(--line); background: #fff; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px; align-content: start; }
    .card { border: 1px dashed #bbb; border-radius: 6px; padding: 8px; display: grid; grid-template-columns: 44px 1fr auto; gap: 8px; align-items: center; min-height: 88px; }
    .icon { font-size: 30px; text-align: center; }
    .txt { font-size: 14px; font-weight: 700; }
    .slot { font-size: 12px; color: #333; margin-top: 4px; }
    .slot-btn img { width: 28px; height: 28px; display: block; }
    .right { border: 1px solid var(--line); background: var(--panel-bg); display: grid; grid-template-rows: repeat(10, 1fr); }
    .opt { border-bottom: 1px solid var(--line); padding: 6px; display: grid; grid-template-columns: 34px 1fr auto; gap: 6px; align-items: center; font-size: 13px; }
    .opt:last-child { border-bottom: 0; }
    .oid { font-weight: 700; text-align: center; }
    .ans-btn img { width: 24px; height: 24px; display: block; }
    @media print { body { background: #fff; padding: 0; } .sheet { border: 1px solid #444; } }
  </style>
</head>
<body>
  <article class="sheet">
    <header class="header">
      <div>
        <div class="title">Answer Side: Match your front attempt with the correct button next to each option.</div>
        <div class="meta">Worksheet ID: ${worksheet.worksheetId} | Structure: LP_FIXED_V1 | Side: Flip</div>
      </div>
      <div class="badge">${setNo}</div>
    </header>
    <section class="board">
      <div class="left">
        ${leftHtml}
      </div>
      <aside class="right">
        ${rightHtml}
      </aside>
    </section>
  </article>
</body>
</html>
`;
}

function main() {
  const packageArg = process.argv[2];
  if (!packageArg) {
    console.error('Usage: node agent/prompts/els-system/logicopicolo/generate-topic-package.js <package-file.md>');
    process.exit(1);
  }

  const packagePath = path.isAbsolute(packageArg) ? packageArg : path.join(process.cwd(), packageArg);
  const model = parsePackage(packagePath);
  const pairBankById = validatePackage(model);

  for (const blueprint of model.blueprints) {
    const pairs = blueprint.pair_ids.split(',').map((entry) => pairBankById[entry.trim()]);
    const worksheet = buildWorksheet(model, blueprint, pairs);
    fs.writeFileSync(path.join(CONTENT_DIR, `${worksheet.worksheetId}.md`), toContentMarkdown(worksheet), 'utf8');
    fs.writeFileSync(path.join(RESULTS_DIR, `${worksheet.worksheetId}_front.html`), renderFront(worksheet), 'utf8');
    fs.writeFileSync(path.join(RESULTS_DIR, `${worksheet.worksheetId}_flip.html`), renderFlip(worksheet), 'utf8');
    console.log(`Generated ${worksheet.worksheetId}.md, ${worksheet.worksheetId}_front.html, ${worksheet.worksheetId}_flip.html`);
  }
}

main();