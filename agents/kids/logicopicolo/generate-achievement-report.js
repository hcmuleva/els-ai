const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const RESULTS_DIR = path.join(ROOT, 'results');

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

function parseTeachingInputs(lines) {
  const result = { text: 'no', image: 'no', audio: 'no', video: 'no' };
  let current = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '### Text Content') current = 'text';
    else if (trimmed === '### Image Content') current = 'image';
    else if (trimmed === '### Audio Content') current = 'audio';
    else if (trimmed === '### Video Content') current = 'video';
    else if (current && trimmed.startsWith('- required:')) {
      result[current] = trimmed.split(':')[1].trim();
    }
  }
  return result;
}

function average(items) {
  if (!items.length) return 0;
  return Math.round((items.reduce((sum, item) => sum + item, 0) / items.length) * 100) / 100;
}

function determineAchievedLevel(results, thresholds) {
  if (!results.length || results.some((row) => row.status.toLowerCase() === 'pending')) {
    return 'Not Assessed';
  }

  const easyPassed = results.filter((row) => row.difficulty === 'easy').every((row) => row.score_percent >= thresholds.easy);
  const mediumRows = results.filter((row) => row.difficulty === 'medium');
  const hardRows = results.filter((row) => row.difficulty === 'hard');
  const mediumPassed = mediumRows.length > 0 && mediumRows.every((row) => row.score_percent >= thresholds.medium);
  const hardPassed = hardRows.length > 0 && hardRows.every((row) => row.score_percent >= thresholds.hard);
  const mediumAnyPassed = mediumRows.some((row) => row.score_percent >= thresholds.medium);

  if (easyPassed && mediumPassed && hardPassed) return 'Advanced';
  if (easyPassed && mediumPassed) return 'Proficient';
  if (easyPassed && mediumAnyPassed) return 'Developing';
  if (easyPassed) return 'Emerging';
  return 'Not Assessed';
}

function determineNextPlan(level, counts) {
  if (level === 'Advanced') return `easy=0, medium=0, hard=${Math.max(1, counts.hard)}`;
  if (level === 'Proficient') return `easy=0, medium=${Math.max(1, counts.medium)}, hard=${Math.max(1, counts.hard)}`;
  if (level === 'Developing') return `easy=0, medium=${Math.max(1, counts.medium)}, hard=0`;
  if (level === 'Emerging') return `easy=${Math.max(1, counts.easy)}, medium=0, hard=0`;
  return `easy=${counts.easy}, medium=${counts.medium}, hard=${counts.hard}`;
}

function determineNextContentType(results) {
  const completed = results.filter((row) => row.status.toLowerCase() !== 'pending');
  if (!completed.length) return 'text';

  const byModality = new Map();
  for (const row of completed) {
    const current = byModality.get(row.source_modality_used) || [];
    current.push(row.score_percent);
    byModality.set(row.source_modality_used, current);
  }

  let weakest = 'text';
  let weakestScore = Number.POSITIVE_INFINITY;
  for (const [modality, scores] of byModality.entries()) {
    const score = average(scores);
    if (score < weakestScore) {
      weakestScore = score;
      weakest = modality;
    }
  }
  return weakest;
}

function buildInterpretation(results, level) {
  const completed = results.filter((row) => row.status.toLowerCase() !== 'pending');
  if (!completed.length) {
    return {
      strengths: 'Assessment is still pending for one or more worksheets.',
      gaps: 'Complete worksheet scoring before interpreting achievement.',
      interpretation: 'Topic-level interpretation is waiting for worksheet completion.'
    };
  }

  const strongest = [...completed].sort((a, b) => b.score_percent - a.score_percent)[0];
  const weakest = [...completed].sort((a, b) => a.score_percent - b.score_percent)[0];
  return {
    strengths: `Best performance was in ${strongest.concept_focus} (${strongest.difficulty}, ${strongest.score_percent}%).`,
    gaps: `Most support is needed in ${weakest.concept_focus} (${weakest.difficulty}, ${weakest.score_percent}%).`,
    interpretation: `Current topic level is ${level}. Strongest modality evidence came from ${strongest.source_modality_used}.`
  };
}

function main() {
  const packageArg = process.argv[2];
  if (!packageArg) {
    console.error('Usage: node agent/prompts/els-system/logicopicolo/generate-achievement-report.js <package-file.md>');
    process.exit(1);
  }

  const packagePath = path.isAbsolute(packageArg) ? packageArg : path.join(process.cwd(), packageArg);
  const text = fs.readFileSync(packagePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const meta = parseMeta(lines);
  const teachingInputs = parseTeachingInputs(lines);
  const thresholds = {
    easy: parseCount(lines, 'easy_mastery_threshold'),
    medium: parseCount(lines, 'medium_mastery_threshold'),
    hard: parseCount(lines, 'hard_mastery_threshold')
  };
  const counts = {
    easy: parseCount(lines, 'easy_count'),
    medium: parseCount(lines, 'medium_count'),
    hard: parseCount(lines, 'hard_count')
  };

  const blueprints = parseMarkdownTable(lines, 'Worksheet Blueprint Table');
  const blueprintById = Object.fromEntries(blueprints.map((row) => [row.worksheet_id, row]));
  const captureRows = parseMarkdownTable(lines, 'Assessment Capture Template').map((row) => ({
    worksheet_id: row.worksheet_id,
    difficulty: row.difficulty,
    total_items: Number(row.total_items || 0),
    correct_items: Number(row.correct_items || 0),
    score_percent: Number(row.score_percent || 0),
    status: row.status || 'pending',
    concept_focus: blueprintById[row.worksheet_id]?.concept_focus || '',
    source_modality_used: blueprintById[row.worksheet_id]?.source_modality_used || ''
  }));

  const achievedLevel = determineAchievedLevel(captureRows, thresholds);
  const easyScores = captureRows.filter((row) => row.difficulty === 'easy' && row.status.toLowerCase() !== 'pending').map((row) => row.score_percent);
  const mediumScores = captureRows.filter((row) => row.difficulty === 'medium' && row.status.toLowerCase() !== 'pending').map((row) => row.score_percent);
  const hardScores = captureRows.filter((row) => row.difficulty === 'hard' && row.status.toLowerCase() !== 'pending').map((row) => row.score_percent);
  const interpretation = buildInterpretation(captureRows, achievedLevel);
  const nextContentType = determineNextContentType(captureRows);
  const nextWorksheetPlan = determineNextPlan(achievedLevel, counts);

  const reportName = `${meta.package_id}_achievement_report.md`;
  const reportPath = path.join(RESULTS_DIR, reportName);
  const report = [
    `# Topic Achievement Report: ${meta.package_id}`,
    '',
    '## Metadata',
    `- package_id: ${meta.package_id}`,
    `- student_id: ${meta.student_id}`,
    `- topic: ${meta.topic}`,
    `- evaluation_date: ${new Date().toISOString().slice(0, 10)}`,
    '',
    '## Source Learning Content Reviewed',
    `- text_used: ${teachingInputs.text}`,
    `- image_used: ${teachingInputs.image}`,
    `- audio_used: ${teachingInputs.audio}`,
    `- video_used: ${teachingInputs.video}`,
    '',
    '## Worksheet Results Summary',
    '| worksheet_id | difficulty | concept_focus | score_percent | passed |',
    '| --- | --- | --- | --- | --- |',
    ...captureRows.map((row) => `| ${row.worksheet_id} | ${row.difficulty} | ${row.concept_focus} | ${row.score_percent} | ${row.status.toLowerCase() === 'pending' ? 'pending' : row.status.toLowerCase() === 'pass' || row.status.toLowerCase() === 'passed' ? 'yes' : 'no'} |`),
    '',
    '## Performance By Difficulty',
    `- easy_average_score: ${average(easyScores)}`,
    `- medium_average_score: ${average(mediumScores)}`,
    `- hard_average_score: ${average(hardScores)}`,
    '',
    '## Achieved Topic Level',
    `- achieved_level: ${achievedLevel}`,
    '',
    '## Interpretation',
    `- ${interpretation.interpretation}`,
    `- ${interpretation.strengths}`,
    `- ${interpretation.gaps}`,
    '',
    '## Recommended Next Action',
    `- next_content_type: ${nextContentType}`,
    `- next_worksheet_plan: ${nextWorksheetPlan}`,
    `- teacher_note: Review ${nextContentType} support for the weakest concept before the next worksheet cycle.`,
    ''
  ].join('\n');

  fs.writeFileSync(reportPath, report, 'utf8');
  console.log(`Generated ${reportPath}`);
}

main();