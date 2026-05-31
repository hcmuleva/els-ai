import ytSearch from 'youtube-search-api';

/**
 * Ask the AI Agent (Gemini) to generate the optimal YouTube search query
 * based on the theme, topic, and content data.
 */
async function getSearchQueryFromAgent(theme, topic, contentData) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("No GEMINI_API_KEY found, falling back to basic search string generation.");
    return `${topic} ${theme} educational video for kids`;
  }

  const prompt = `You are an expert Educational Content Architect. 
I need a highly specific YouTube search query to find a high-quality, short-form (under 5 minutes) educational video for young children.

Theme: ${theme}
Topic: ${topic}
Content Data: ${contentData}

Generate exactly ONE search query string that will yield the best, most engaging results. Do not include any extra text, quotes, or explanations. Just the search query.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 50 }
      })
    });

    if (!response.ok) {
      throw new Error(`Agent API failed with status: ${response.status}`);
    }

    const data = await response.json();
    const query = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (query) return query;
  } catch (error) {
    console.error("Agent failed to generate query:", error.message);
  }

  // Fallback if agent fails
  return `${topic} ${theme} educational video for kids`;
}

/**
 * Check if a YouTube video is embeddable and working using oEmbed
 */
async function isEmbeddable(videoId) {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    return res.ok;
  } catch (e) {
    return false;
  }
}

/**
 * Main function to get the best YouTube link
 */
export async function getBestYoutubeLink(theme, topic, contentData) {
  console.log(`[Agent] Analyzing theme: "${theme}", topic: "${topic}"...`);
  const searchQuery = await getSearchQueryFromAgent(theme, topic, contentData);
  console.log(`[Agent] Suggested search query: "${searchQuery}"`);

  console.log(`[YouTube] Searching for videos...`);
  try {
    // Search for videos
    const searchResults = await ytSearch.GetListByKeyword(searchQuery, false, 5, [{ type: 'video' }]);
    
    if (!searchResults || !searchResults.items || searchResults.items.length === 0) {
      throw new Error("No videos found for the query.");
    }

    // Iterate through results to find the first embeddable and working video
    for (const item of searchResults.items) {
      const isWorking = await isEmbeddable(item.id);
      if (isWorking) {
        const url = `https://www.youtube.com/watch?v=${item.id}`;
        console.log(`[Success] Found high-quality working video: ${url} (${item.title})`);
        return url;
      } else {
        console.log(`[Skip] Video ${item.id} is blocked or not embeddable.`);
      }
    }
    
    throw new Error("No working embeddable videos found.");
  } catch (error) {
    console.error("[Error]", error.message);
    return null;
  }
}

// Example usage if run directly
if (process.argv[1] && process.argv[1].endsWith('fetch_best_youtube.js')) {
  (async () => {
    const theme = process.argv[2] || "Solar System";
    const topic = process.argv[3] || "Planets";
    const contentData = process.argv[4] || "Introduction to the planets in our solar system suitable for young kids.";
    
    await getBestYoutubeLink(theme, topic, contentData);
  })();
}
