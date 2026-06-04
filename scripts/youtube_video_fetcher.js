#!/usr/bin/env node
/**
 * YouTube Video Fetcher & Validator
 *
 * Interactive CLI that fetches high-quality YouTube videos for ELS-AI content
 * curation. Supports four input modes:
 *   1) Topic / search query
 *   2) Playlist URL or ID
 *   3) Channel URL or ID
 *   4) Single video URL or ID
 *
 * For every fetched video the script:
 *   - Converts YouTube Shorts links to standard /watch?v= URLs
 *   - Validates that the video is public + embeddable via the oEmbed endpoint
 *     (filters out private / blocked / region-restricted videos)
 *   - Builds a normalized record aligned with the ELS-AI TopicSectionDraft
 *     schema (contentType: "youtube_url")
 *
 * Output:
 *   dump/video dumps/<subject>/<topic>.json
 *
 * Usage:
 *   node scripts/youtube_video_fetcher.js
 *
 * Optional env:
 *   GEMINI_API_KEY  - if set, the agent refines the topic into a better query
 *   YT_LIMIT        - max videos to fetch in TOPIC mode (default 15)
 *   YT_KEEP         - validated videos to keep in TOPIC mode (default 10)
 *   YT_PLAYLIST_MAX - safety cap for playlist/channel paging (default 1000)
 *
 * Playlist and channel modes ALWAYS fetch and keep every available video
 * (no KEEP_LIMIT trim), bounded only by YT_PLAYLIST_MAX.
 */

import readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ytSearch from 'youtube-search-api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_ROOT = path.join(PROJECT_ROOT, 'dump', 'video dumps');

const FETCH_LIMIT = Number(process.env.YT_LIMIT || 15);
const KEEP_LIMIT = Number(process.env.YT_KEEP || 10);
const PLAYLIST_MAX = Number(process.env.YT_PLAYLIST_MAX || 1000);

const sanitizeFs = (value) =>
  String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || 'untitled';

function extractPlaylistId(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const match = value.match(/[?&]list=([A-Za-z0-9_-]+)/);
  if (match) return match[1];
  if (/^[A-Za-z0-9_-]{10,}$/.test(value)) return value;
  return '';
}

function extractChannelId(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const channelMatch = value.match(/\/channel\/(UC[A-Za-z0-9_-]{20,})/);
  if (channelMatch) return channelMatch[1];
  if (/^UC[A-Za-z0-9_-]{20,}$/.test(value)) return value;
  return '';
}

function extractHandle(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const atMatch = value.match(/(?:youtube\.com\/)?@([^/?#\s]+)/i);
  if (atMatch) {
    try {
      return `@${decodeURIComponent(atMatch[1])}`;
    } catch {
      return `@${atMatch[1]}`;
    }
  }
  const cMatch = value.match(/youtube\.com\/(?:c|user)\/([^/?#\s]+)/i);
  if (cMatch) {
    try {
      return decodeURIComponent(cMatch[1]);
    } catch {
      return cMatch[1];
    }
  }
  if (/^[A-Za-z0-9._-]+$/.test(value) && !/^UC[A-Za-z0-9_-]{20,}$/.test(value)) {
    return value.startsWith('@') ? value : `@${value}`;
  }
  return '';
}

async function resolveChannelIdFromHandle(handleOrUrl) {
  const handle = extractHandle(handleOrUrl);
  if (!handle) return '';
  const url = `https://www.youtube.com/${encodeURI(handle)}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    if (!res.ok) return '';
    const html = await res.text();
    const patterns = [
      /"channelId":"(UC[A-Za-z0-9_-]{20,})"/,
      /<meta itemprop="channelId" content="(UC[A-Za-z0-9_-]{20,})"/,
      /"externalChannelId":"(UC[A-Za-z0-9_-]{20,})"/,
      /\/channel\/(UC[A-Za-z0-9_-]{20,})/,
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m) return m[1];
    }
    return '';
  } catch {
    return '';
  }
}

function extractVideoId(rawUrlOrId) {
  const value = String(rawUrlOrId || '').trim();
  if (!value) return '';
  const shortsMatch = value.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];
  const watchMatch = value.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  const shortMatch = value.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  const embedMatch = value.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;
  return '';
}

function toWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function toEmbedUrl(videoId) {
  return `https://www.youtube.com/embed/${videoId}?rel=0&playsinline=1`;
}

function toThumbnail(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

async function isEmbeddable(videoId) {
  try {
    const url = toWatchUrl(videoId);
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { headers: { 'User-Agent': 'Mozilla/5.0 ELS-AI-Curator' } },
    );
    if (!res.ok) return null;
    const meta = await res.json().catch(() => null);
    return meta || null;
  } catch {
    return null;
  }
}

async function refineQueryWithAgent(topic, subject) {
  const apiKey = process.env.GEMINI_API_KEY;
  const fallback = `${topic} ${subject} short educational video for kids`;
  if (!apiKey) return fallback;

  const prompt = `You are an Educational Content Architect.\nGenerate ONE concise YouTube search query (no quotes, no commentary) to find a high-quality, short, kid-safe educational video.\nSubject: ${subject}\nTopic: ${topic}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 50 },
        }),
      },
    );
    if (!res.ok) return fallback;
    const data = await res.json();
    const query = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return query || fallback;
  } catch {
    return fallback;
  }
}

function mapSearchItem(item) {
  return {
    raw: item,
    videoId: item.id,
    title: item.title,
    channel: item.channelTitle || item.channel?.title || '',
    duration:
      item.length?.simpleText ||
      item.length?.accessibility?.accessibilityData?.label ||
      '',
    isShort: Boolean(
      item.isLive
        ? false
        : item.length?.simpleText && /^0?:\d{1,2}$/.test(item.length.simpleText),
    ),
  };
}

async function fetchByTopic(topic, subject) {
  const query = await refineQueryWithAgent(topic, subject);
  console.log(`[search] "${query}"`);
  const results = await ytSearch.GetListByKeyword(query, false, FETCH_LIMIT, [
    { type: 'video' },
  ]);
  const items = Array.isArray(results?.items) ? results.items : [];
  const videos = items.map(mapSearchItem).filter((v) => v.videoId);
  return {
    videos,
    query,
    nextPageToken: results?.nextPage?.nextPageToken || results?.nextPageToken || '',
    nextPageContext: results?.nextPage?.nextPageContext || results?.nextPageContext || null,
  };
}

async function fetchTopicNextPage(state) {
  if (!state?.nextPageToken) return { videos: [], nextPageToken: '', nextPageContext: null };
  let next;
  try {
    next = await ytSearch.NextPage(
      { nextPageToken: state.nextPageToken, nextPageContext: state.nextPageContext },
      false,
      FETCH_LIMIT,
    );
  } catch (err) {
    console.warn(`  [warn] could not fetch next search page: ${err.message}`);
    return { videos: [], nextPageToken: '', nextPageContext: null };
  }
  const items = Array.isArray(next?.items) ? next.items : [];
  return {
    videos: items.map(mapSearchItem).filter((v) => v.videoId),
    nextPageToken: next?.nextPage?.nextPageToken || next?.nextPageToken || '',
    nextPageContext: next?.nextPage?.nextPageContext || next?.nextPageContext || null,
  };
}

function mapPlaylistItem(item) {
  return {
    raw: item,
    videoId: item.id,
    title: item.title,
    channel: item.shortBylineText?.runs?.[0]?.text || item.channelTitle || '',
    duration: item.length?.simpleText || item.lengthText?.simpleText || '',
    isShort: false,
  };
}

async function fetchByPlaylist(playlistId) {
  console.log(`[playlist] ${playlistId} (fetching ALL videos, cap=${PLAYLIST_MAX})`);
  const collected = [];
  const seen = new Set();

  let data = await ytSearch.GetPlaylistData(playlistId, PLAYLIST_MAX);
  let items = Array.isArray(data?.items) ? data.items : [];
  for (const item of items) {
    if (item?.id && !seen.has(item.id)) {
      seen.add(item.id);
      collected.push(mapPlaylistItem(item));
    }
  }

  let nextPageToken = data?.nextPage?.nextPageToken || data?.nextPageToken;
  let nextPageCtx = data?.nextPage?.nextPageContext || data?.nextPageContext;
  let pageCount = 1;
  while (nextPageToken && collected.length < PLAYLIST_MAX) {
    pageCount += 1;
    process.stdout.write(`  [page ${pageCount}] +${collected.length}\r`);
    let nextData;
    try {
      nextData = await ytSearch.NextPage(
        { nextPageToken, nextPageContext: nextPageCtx },
        false,
        Math.min(PLAYLIST_MAX - collected.length, 100),
      );
    } catch (err) {
      console.warn(`  [warn] pagination stopped: ${err.message}`);
      break;
    }
    const nextItems = Array.isArray(nextData?.items) ? nextData.items : [];
    if (nextItems.length === 0) break;
    let added = 0;
    for (const item of nextItems) {
      if (item?.id && !seen.has(item.id)) {
        seen.add(item.id);
        collected.push(mapPlaylistItem(item));
        added += 1;
      }
    }
    if (added === 0) break;
    nextPageToken = nextData?.nextPage?.nextPageToken || nextData?.nextPageToken;
    nextPageCtx = nextData?.nextPage?.nextPageContext || nextData?.nextPageContext;
  }

  console.log(`  fetched ${collected.length} playlist video(s)`);
  return collected.filter((v) => v.videoId);
}

async function fetchBySingleVideo(rawInput) {
  const videoId = extractVideoId(rawInput);
  if (!videoId) return [];
  console.log(`[video] ${videoId}`);
  let detail = null;
  try {
    detail = await ytSearch.GetVideoDetails(videoId);
  } catch (err) {
    console.warn(`  [warn] could not fetch metadata: ${err.message}`);
  }
  return [
    {
      videoId,
      title: detail?.title || '',
      channel: detail?.channel?.name || detail?.channel || '',
      duration: detail?.duration || '',
      isShort: /youtube\.com\/shorts\//i.test(String(rawInput)),
    },
  ];
}

function collectChannelVideos(node, bag, seen) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) collectChannelVideos(child, bag, seen);
    return;
  }
  const candidateId =
    (typeof node.videoId === 'string' && node.videoId) ||
    (typeof node.id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(node.id) ? node.id : '');
  if (candidateId && !seen.has(candidateId)) {
    seen.add(candidateId);
    const titleRaw =
      node.title?.simpleText ||
      node.title?.runs?.[0]?.text ||
      node.title ||
      node.headline?.simpleText ||
      '';
    const channel =
      node.shortBylineText?.runs?.[0]?.text ||
      node.longBylineText?.runs?.[0]?.text ||
      node.ownerText?.runs?.[0]?.text ||
      node.author ||
      '';
    const duration =
      node.lengthText?.simpleText ||
      node.length?.simpleText ||
      node.lengthSeconds ||
      '';
    bag.push({
      videoId: candidateId,
      title: typeof titleRaw === 'string' ? titleRaw : String(titleRaw || ''),
      channel,
      duration: String(duration || ''),
      isShort: false,
    });
  }
  for (const key of Object.keys(node)) {
    const value = node[key];
    if (value && typeof value === 'object') {
      collectChannelVideos(value, bag, seen);
    }
  }
}

function channelIdToUploadsPlaylistId(channelId) {
  if (!/^UC[A-Za-z0-9_-]{20,}$/.test(channelId)) return '';
  return `UU${channelId.slice(2)}`;
}

function channelIdToShortsPlaylistId(channelId) {
  if (!/^UC[A-Za-z0-9_-]{20,}$/.test(channelId)) return '';
  return `UUSH${channelId.slice(2)}`;
}

async function scrapeChannelShorts(channelId, handleUrl) {
  const targets = [
    handleUrl ? `${handleUrl.replace(/\/$/, '')}/shorts` : '',
    `https://www.youtube.com/channel/${channelId}/shorts`,
  ].filter(Boolean);
  const seen = new Set();
  const videos = [];
  for (const url of targets) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (!res.ok) continue;
      const html = await res.text();
      const idRegex = /"videoId":"([A-Za-z0-9_-]{11})"/g;
      let match;
      while ((match = idRegex.exec(html)) !== null) {
        const id = match[1];
        if (!seen.has(id)) {
          seen.add(id);
          videos.push({ videoId: id, title: '', channel: '', duration: '', isShort: true });
        }
      }
      if (videos.length > 0) break;
    } catch {
      // try next target
    }
  }
  return videos;
}

async function fetchByChannel(channelId, options = {}) {
  const mode = options.mode || 'videos';
  const handleUrl = options.handleUrl || '';
  console.log(`[channel] ${channelId} (mode=${mode})`);

  if (mode === 'shorts') {
    const shortsPlaylistId = channelIdToShortsPlaylistId(channelId);
    if (shortsPlaylistId) {
      console.log(`  trying shorts playlist ${shortsPlaylistId}`);
      try {
        const playlistVideos = await fetchByPlaylist(shortsPlaylistId);
        const flagged = playlistVideos.map((v) => ({ ...v, isShort: true }));
        if (flagged.length > 0) return flagged;
        console.log('  shorts playlist empty; scraping channel /shorts page');
      } catch (err) {
        console.warn(`  [warn] shorts playlist failed: ${err.message}; scraping channel /shorts page`);
      }
    }
    const scraped = await scrapeChannelShorts(channelId, handleUrl);
    console.log(`  scraped ${scraped.length} short(s)`);
    return scraped.slice(0, PLAYLIST_MAX);
  }

  const uploadsPlaylistId = channelIdToUploadsPlaylistId(channelId);
  if (uploadsPlaylistId) {
    console.log(`  using uploads playlist ${uploadsPlaylistId}`);
    try {
      const playlistVideos = await fetchByPlaylist(uploadsPlaylistId);
      if (playlistVideos.length > 0) return playlistVideos;
      console.log('  uploads playlist returned nothing, falling back to channel home tab');
    } catch (err) {
      console.warn(`  [warn] uploads playlist failed: ${err.message}; falling back to channel home tab`);
    }
  }

  const data = await ytSearch.GetChannelById(channelId);
  const seen = new Set();
  const videos = [];
  collectChannelVideos(data, videos, seen);
  console.log(`  fetched ${videos.length} channel video(s) from home tab`);
  return videos.slice(0, PLAYLIST_MAX);
}

function normalizeShortsFlag(video, oembed) {
  if (oembed?.html && /shorts/i.test(oembed.html)) return true;
  return Boolean(video.isShort);
}

async function validateAndFormat(videos, sourceLabel, existingIds) {
  const formatted = [];
  let skippedDup = 0;
  const keepCap = sourceLabel?.type === 'topic' ? KEEP_LIMIT : Infinity;
  for (const v of videos) {
    if (formatted.length >= keepCap) break;
    if (existingIds.has(v.videoId)) {
      skippedDup += 1;
      console.log(`  [dup]  ${v.videoId} already saved, skipping`);
      continue;
    }
    const oembed = await isEmbeddable(v.videoId);
    if (!oembed) {
      console.log(`  [skip] ${v.videoId} not embeddable / private / blocked`);
      continue;
    }
    const isShort = normalizeShortsFlag(v, oembed);
    const url = toWatchUrl(v.videoId);
    formatted.push({
      videoId: v.videoId,
      title: oembed.title || v.title || '',
      url,
      embedUrl: toEmbedUrl(v.videoId),
      thumbnail: oembed.thumbnail_url || toThumbnail(v.videoId),
      channel: oembed.author_name || v.channel || '',
      channelUrl: oembed.author_url || '',
      duration: v.duration || '',
      isShort,
      originalIsShort: Boolean(v.isShort),
      provider: oembed.provider_name || 'YouTube',
      contentType: 'youtube_url',
      source: sourceLabel,
      validated: true,
      validatedAt: new Date().toISOString(),
    });
    existingIds.add(v.videoId);
    console.log(`  [ok]   ${v.videoId} ${formatted[formatted.length - 1].title}`);
  }
  if (skippedDup > 0) console.log(`  ${skippedDup} duplicate(s) skipped`);
  return formatted;
}

function loadExistingPayload(outFile) {
  if (!fs.existsSync(outFile)) return null;
  try {
    const raw = fs.readFileSync(outFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.videos)) return parsed;
    return null;
  } catch (err) {
    console.warn(`  [warn] could not parse existing file (${err.message}), starting fresh`);
    return null;
  }
}

function createPrompter() {
  const rl = readline.createInterface({ input, output, terminal: Boolean(input.isTTY) });
  const queue = [];
  const pending = [];
  rl.on('line', (line) => {
    if (pending.length > 0) {
      pending.shift()(line);
    } else {
      queue.push(line);
    }
  });
  rl.on('close', () => {
    while (pending.length > 0) pending.shift()(null);
  });
  const prompt = (message, fallback = '') =>
    new Promise((resolve) => {
      output.write(message);
      const handler = (line) => {
        const value = (line ?? '').trim();
        resolve(value || fallback);
      };
      if (queue.length > 0) handler(queue.shift());
      else pending.push(handler);
    });
  return { prompt, close: () => rl.close() };
}

async function main() {
  const { prompt, close } = createPrompter();
  try {
    console.log('\nELS-AI YouTube Video Fetcher');
    console.log('-----------------------------');
    const subject = await prompt('Subject (e.g. General Knowledge): ');
    if (!subject) {
      console.error('Subject is required.');
      process.exitCode = 1;
      return;
    }
    const topic = await prompt('Topic (e.g. Planets): ');
    if (!topic) {
      console.error('Topic is required.');
      process.exitCode = 1;
      return;
    }

    console.log('\nSource type:');
    console.log('  1) Topic / search query');
    console.log('  2) Playlist (URL or ID)');
    console.log('  3) Channel (URL or ID)');
    console.log('  4) Single video (URL or ID)');
    const sourceChoice = await prompt('Choose 1/2/3/4 [1]: ', '1');

    let rawVideos = [];
    let sourceMeta = { type: 'topic', value: topic };
    let topicState = null;

    if (sourceChoice === '2') {
      const playlistInput = await prompt('Playlist URL or ID: ');
      const playlistId = extractPlaylistId(playlistInput);
      if (!playlistId) {
        console.error('Could not parse playlist ID.');
        process.exitCode = 1;
        return;
      }
      sourceMeta = { type: 'playlist', value: playlistId };
      rawVideos = await fetchByPlaylist(playlistId);
    } else if (sourceChoice === '3') {
      const channelInput = await prompt('Channel URL, @handle, or UC... ID (append /videos or /shorts to pick a tab): ');
      let channelId = extractChannelId(channelInput);
      if (!channelId) {
        console.log(`  resolving handle "${channelInput}" -> channelId...`);
        channelId = await resolveChannelIdFromHandle(channelInput);
      }
      if (!channelId) {
        console.error(
          'Could not resolve a channel ID. Provide a /channel/UC... URL, an @handle URL, or the raw UC... ID.',
        );
        process.exitCode = 1;
        return;
      }
      console.log(`  resolved channelId=${channelId}`);

      let mode = '';
      if (/\/shorts\b/i.test(channelInput)) mode = 'shorts';
      else if (/\/videos\b/i.test(channelInput)) mode = 'videos';
      if (!mode) {
        const ans = (await prompt('Fetch (v)ideos or (s)horts from this channel? [v]: ', 'v')).toLowerCase();
        mode = ans.startsWith('s') ? 'shorts' : 'videos';
      }
      console.log(`  channel tab: ${mode}`);

      const handleMatch = String(channelInput || '').match(/(https?:\/\/[^\s]*?\/(?:@[^\s/?#]+|channel\/[A-Za-z0-9_-]+))/i);
      const handleUrl = handleMatch ? handleMatch[1] : '';

      sourceMeta = { type: 'channel', value: channelId, mode, input: channelInput };
      rawVideos = await fetchByChannel(channelId, { mode, handleUrl });
    } else if (sourceChoice === '4') {
      const videoInput = await prompt('Video URL or ID: ');
      const videoId = extractVideoId(videoInput);
      if (!videoId) {
        console.error('Could not parse video ID. Provide a /watch?v=, /shorts/, youtu.be link, or 11-char ID.');
        process.exitCode = 1;
        return;
      }
      sourceMeta = { type: 'video', value: videoId };
      rawVideos = await fetchBySingleVideo(videoInput);
    } else {
      sourceMeta = { type: 'topic', value: topic };
      topicState = await fetchByTopic(topic, subject);
      sourceMeta.query = topicState.query;
      rawVideos = topicState.videos;
    }

    if (rawVideos.length === 0) {
      console.error('No videos returned by source.');
      process.exitCode = 1;
      return;
    }

    const subjectDir = path.join(OUTPUT_ROOT, sanitizeFs(subject));
    fs.mkdirSync(subjectDir, { recursive: true });
    const outFile = path.join(subjectDir, `${sanitizeFs(topic)}.json`);

    const existing = loadExistingPayload(outFile);
    const existingIds = new Set(
      (existing?.videos || []).map((v) => v.videoId).filter(Boolean),
    );
    if (existing) {
      console.log(`\nFound existing file with ${existingIds.size} video(s); duplicates will be skipped.`);
    }

    const sourceHistory = Array.isArray(existing?.sourceHistory)
      ? existing.sourceHistory
      : existing?.source
        ? [{ ...existing.source, runAt: existing.generatedAt || null }]
        : [];

    const allNewlyValidated = [];
    let totalFetchedThisRun = rawVideos.length;

    console.log(`\nValidating ${rawVideos.length} videos via oEmbed...`);
    const firstBatch = await validateAndFormat(rawVideos, sourceMeta, existingIds);
    allNewlyValidated.push(...firstBatch);

    if (allNewlyValidated.length === 0 && !existing) {
      console.error('No working videos found after validation.');
      process.exitCode = 1;
      return;
    }

    const writePayload = () => {
      const merged = [...(existing?.videos || []), ...allNewlyValidated];
      const payload = {
        subject: subject.trim(),
        topic: topic.trim(),
        source: sourceMeta,
        sourceHistory: [...sourceHistory, { ...sourceMeta, runAt: new Date().toISOString() }],
        generatedAt: new Date().toISOString(),
        totalFetched: (existing?.totalFetched || 0) + totalFetchedThisRun,
        totalValid: merged.length,
        videos: merged,
      };
      fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
      return merged.length;
    };

    let mergedCount = writePayload();
    console.log(
      `\nAdded ${firstBatch.length} new video(s); total now ${mergedCount}.`,
    );
    console.log(`Saved -> ${path.relative(PROJECT_ROOT, outFile)}`);

    if (sourceMeta.type === 'topic') {
      while (topicState?.nextPageToken) {
        const ans = (await prompt('\nFetch 10 more videos for this topic? (y/N): ', 'n')).toLowerCase();
        if (ans !== 'y' && ans !== 'yes') break;
        topicState = await fetchTopicNextPage(topicState);
        if (topicState.videos.length === 0) {
          console.log('  no more results from YouTube search.');
          break;
        }
        totalFetchedThisRun += topicState.videos.length;
        console.log(`\nValidating ${topicState.videos.length} more videos via oEmbed...`);
        const batch = await validateAndFormat(topicState.videos, sourceMeta, existingIds);
        if (batch.length === 0) {
          console.log('  no new working videos in this batch.');
        } else {
          allNewlyValidated.push(...batch);
        }
        mergedCount = writePayload();
        console.log(
          `Added ${batch.length} new video(s); total now ${mergedCount}.`,
        );
      }
      if (sourceMeta.type === 'topic' && !topicState?.nextPageToken) {
        console.log('\n(no further search pages available)');
      }
    }
  } finally {
    close();
  }
}

main().catch((err) => {
  console.error('[fatal]', err?.message || err);
  process.exitCode = 1;
});
