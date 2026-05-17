const fs = require('fs');
const path = require('path');

function parseCount(lines, key) {
  const line = lines.find((entry) => entry.trim().startsWith(`- ${key}:`));
  if (!line) return 0;
  const match = line.match(/:\s*(\d+)/);
  return match ? Number(match[1]) : 0;
}

function parseMarkdownTable(lines, header) {
  const idx = lines.findIndex((line) => line.trim() === `## ${header}`);
  if (idx < 0) {
    return { start: -1, end: -1, headers: [], rows: [] };
  }

  const tableLines = [];
  let start = -1;
  let end = -1;
  for (let i = idx + 1; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('## ')) {
      end = i;
      break;
    }
    if (trimmed.startsWith('|')) {
      if (start === -1) start = i;
      tableLines.push(trimmed);
    }
  }
  if (end === -1) end = lines.length;
  if (tableLines.length < 3) {
    return { start, end, headers: [], rows: [] };
  }

  const headers = tableLines[0].split('|').map((cell) => cell.trim()).filter(Boolean);
  const rows = tableLines.slice(2).map((row) => {
    const values = row.split('|').map((cell) => cell.trim()).filter(Boolean);
    return Object.fromEntries(headers.map((key, index) => [key, values[index] || '']));
  });
  return { start, end, headers, rows };
}

function toMarkdownTable(headers, rows) {
  const table = [];
  table.push(`| ${headers.join(' | ')} |`);
  table.push(`| ${headers.map(() => '---').join(' | ')} |`);
  for (const row of rows) {
    table.push(`| ${headers.map((header) => row[header] ?? '').join(' | ')} |`);
  }
  return table;
}

function normalizeRow(row, thresholds) {
  const currentStatus = String(row.status || 'pending').trim().toLowerCase();
  if (currentStatus === 'pending') {
    return {
      ...row,
      score_percent: row.score_percent || '0',
      status: 'pending'
    };
  }

  const totalItems = Number(row.total_items || 0);
  const correctItems = Number(row.correct_items || 0);
  const safeTotal = totalItems > 0 ? totalItems : 0;
  const rawScore = safeTotal === 0 ? 0 : (correctItems / safeTotal) * 100;
  const scorePercent = Math.round(rawScore * 100) / 100;
  const threshold = thresholds[row.difficulty] ?? 0;
  const status = scorePercent >= threshold ? 'pass' : 'fail';

  return {
    ...row,
    total_items: String(totalItems),
    correct_items: String(correctItems),
    score_percent: String(scorePercent),
    status
  };
}

function main() {
  const packageArg = process.argv[2];
  if (!packageArg) {
    console.error('Usage: node agent/prompts/els-system/logicopicolo/update-package-scores.js <package-file.md>');
    process.exit(1);
  }

  const packagePath = path.isAbsolute(packageArg) ? packageArg : path.join(process.cwd(), packageArg);
  const text = fs.readFileSync(packagePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const thresholds = {
    easy: parseCount(lines, 'easy_mastery_threshold'),
    medium: parseCount(lines, 'medium_mastery_threshold'),
    hard: parseCount(lines, 'hard_mastery_threshold')
  };

  const table = parseMarkdownTable(lines, 'Assessment Capture Template');
  if (table.start === -1 || !table.headers.length) {
    throw new Error('Assessment Capture Template table not found');
  }

  const updatedRows = table.rows.map((row) => normalizeRow(row, thresholds));
  const updatedTableLines = toMarkdownTable(table.headers, updatedRows);
  const newLines = [
    ...lines.slice(0, table.start),
    ...updatedTableLines,
    '',
    ...lines.slice(table.end)
  ];

  fs.writeFileSync(packagePath, `${newLines.join('\n')}\n`, 'utf8');
  console.log(`Updated assessment scores in ${packagePath}`);
}

main();