import { agentRouter } from '../agents/router.js';
/**
 * Generates an immediate, clean, human-friendly title from the first message
 * by stripping conversational filler and extracting the core topic.
 */
export function generateFastTitle(message) {
    if (!message || typeof message !== 'string')
        return 'New Chat';
    let cleaned = message.trim();
    // Remove leading conversational prefixes
    const prefixes = [
        /^(can you\s+please\s+|can you\s+|could you\s+please\s+|could you\s+|please\s+)/i,
        /^(i want to\s+|i would like to\s+|i need\s+you\s+to\s+|i need\s+|help me\s+with\s+|help me\s+)/i,
        /^(tell me about\s+|explain to me\s+|explain\s+|what is\s+|what are\s+|how do\s+|how does\s+|how to\s+)/i,
        /^(give me a\s+|give me\s+|create a\s+|create\s+|draft a\s+|draft\s+|generate a\s+|generate\s+)/i,
        /^(write a\s+|write\s+|make a\s+|make\s+|summarize\s+|summarise\s+|analyze\s+|show me\s+)/i,
    ];
    for (const prefix of prefixes) {
        cleaned = cleaned.replace(prefix, '');
    }
    // Remove trailing punctuation or question marks
    cleaned = cleaned.replace(/[?!.:]+$/, '').trim();
    // If message asks for a quiz/story/lesson, format with clean category prefix
    const lowerOrig = message.toLowerCase();
    let prefixCategory = '';
    if (lowerOrig.includes('quiz') || lowerOrig.includes('question')) {
        prefixCategory = 'Quiz: ';
    }
    else if (lowerOrig.includes('story') || lowerOrig.includes('tale')) {
        prefixCategory = 'Story: ';
    }
    else if (lowerOrig.includes('lesson') || lowerOrig.includes('curriculum')) {
        prefixCategory = 'Lesson: ';
    }
    else if (lowerOrig.includes('survey') || lowerOrig.includes('check-in')) {
        prefixCategory = 'Survey: ';
    }
    else if (lowerOrig.includes('report') || lowerOrig.includes('progress') || lowerOrig.includes('trend')) {
        prefixCategory = 'Report: ';
    }
    // Clean out redundant category word from cleaned text if we already prefixed it
    if (prefixCategory && cleaned.toLowerCase().startsWith(prefixCategory.toLowerCase().replace(':', ''))) {
        cleaned = cleaned.replace(/^(quiz|story|lesson|survey|report)\s*(on|about|for)?\s*/i, '');
    }
    // Capitalize words
    const words = cleaned.split(/\s+/).slice(0, 6);
    if (words.length === 0 || words[0].length === 0)
        return 'New Chat';
    const titleWords = words.map((w) => {
        if (['a', 'an', 'the', 'in', 'on', 'of', 'and', 'for', 'with', 'to'].includes(w.toLowerCase())) {
            return w.toLowerCase();
        }
        return w.charAt(0).toUpperCase() + w.slice(1);
    });
    // Ensure first word is always capitalized
    if (titleWords[0]) {
        titleWords[0] = titleWords[0].charAt(0).toUpperCase() + titleWords[0].slice(1);
    }
    let finalTitle = `${prefixCategory}${titleWords.join(' ')}`.trim();
    if (finalTitle.length > 45) {
        finalTitle = `${finalTitle.slice(0, 42)}...`;
    }
    return finalTitle || 'New Conversation';
}
/**
 * Uses LLM to synthesize an accurate, concise 3–5 word conversation label
 * based on both the user request and assistant answer.
 */
export async function generateLlmTitle(userMessage, assistantReply) {
    try {
        const prompt = `Generate a concise, professional 3 to 5 word title for this educational chat.
Do NOT use quotes, punctuation, or generic filler like "Discussion about".
User message: "${userMessage.slice(0, 250)}"
${assistantReply ? `Assistant context: "${assistantReply.slice(0, 250)}"` : ''}

Title:`;
        let generated = '';
        for await (const event of agentRouter.run({
            maxTokens: 30,
            temperature: 0.3,
            messages: [
                {
                    role: 'system',
                    content: 'You generate short, clean 3-5 word titles for chats. Return ONLY the title.',
                },
                { role: 'user', content: prompt },
            ],
        })) {
            if (event.type === 'delta') {
                generated += event.text;
            }
        }
        const clean = generated
            .replace(/["'`*\n\r]/g, '')
            .replace(/^title:\s*/i, '')
            .trim();
        if (clean.length >= 3 && clean.length <= 50) {
            return clean;
        }
    }
    catch (err) {
        // Graceful fallback to fast title
    }
    return null;
}
