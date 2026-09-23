import { z } from "zod";
import { generateJson } from "../../services/llmClient.js";
import { newContentId } from "../../utils/ids.js";
import type { QuizParams } from "../types.js";
import type { GeneratorResult } from "./types.js";
import { fetchAndUploadTopicImage } from "../../services/imageFetcher.js";

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function generateQuiz(
  params: z.infer<typeof QuizParams>,
): Promise<GeneratorResult> {
  const quizType = params.quizType || "multi_choice";

  // ── 0. MIXED QUESTION QUIZ ─────────────────────────────────────────
  if (quizType === "mixed") {
    const output = await generateJson<{
      title?: string;
      questions: Array<{
        prompt: string;
        questionType: string;
        options?: any[];
        choices?: any[];
        correctAnswer?: string;
        sentence?: string;
        answer?: string;
        hint?: string;
        pairs?: Array<{ label?: string; item?: string; target?: string; emoji?: string }>;
        isTrue?: boolean;
        explanation?: string;
      }>;
    }>({
      system:
        "You are an expert curriculum writer. Reply with ONLY a JSON object: " +
        "{ title: string, questions: [...] }. " +
        "Create an engaging, balanced MIX of questions across these question types: " +
        "'multi_choice', 'true_false', 'fill_blank', 'drag_drop_match', 'memory_match', 'jigsaw'. " +
        "DO NOT use 'logico' or audio types. " +
        "For 'multi_choice': provide prompt, options (4 distinct choices), correctAnswer, explanation. " +
        "For 'true_false': provide prompt, options: ['True', 'False'], correctAnswer ('True' or 'False'), explanation. " +
        "For 'fill_blank': provide sentence containing '___', answer, options (4 choices including answer), hint, explanation. " +
        "For 'drag_drop_match': provide prompt and 3-4 pairs: [{ item, target }]. " +
        "For 'memory_match': provide prompt and 4 pairs: [{ label, emoji }]. " +
        "For 'jigsaw': provide prompt: 'Assemble the jigsaw puzzle for [Topic]'. " +
        "Write age-appropriate, factually accurate questions.",
      prompt: [
        `Subject: ${params.subject}`,
        `Grade level: ${params.gradeLevel}`,
        `Topic: ${params.topic}`,
        `Difficulty: ${params.difficulty}`,
        `Number of questions: ${params.questionCount}`,
        params.timeLimitMinutes ? `Time limit: ${params.timeLimitMinutes} minutes` : "",
        `Randomness seed: ${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        "IMPORTANT: Generate completely fresh, diverse, creative questions covering different subtopics and real-world situations. Avoid repetitive or boilerplate questions.",
      ]
        .filter(Boolean)
        .join("\n"),
      temperature: 0.85,
      maxTokens: 4500,
    });

    const title = output.title || `${params.topic} — Mixed Challenge`;
    const questions: any[] = [];

    for (let idx = 0; idx < (output.questions || []).length; idx++) {
      const q = output.questions[idx];
      let rawType = String(q.questionType || (q as any).type || "").toLowerCase().trim();
      const promptLower = String(q.prompt || "").toLowerCase();
      if (rawType.includes("blank") || rawType.includes("fill") || q.sentence || promptLower.includes("___") || promptLower.includes("fill in the blank")) {
        rawType = "fill_blank";
      } else if (rawType.includes("drag") || rawType.includes("match_box") || rawType.includes("drop") || (Array.isArray(q.pairs) && q.pairs.some((p: any) => p.item && p.target))) {
        rawType = "drag_drop_match";
      } else if (rawType.includes("memory") || (Array.isArray(q.pairs) && q.pairs.some((p: any) => p.emoji))) {
        rawType = "memory_match";
      } else if (rawType.includes("jigsaw") || rawType.includes("puzzle") || promptLower.includes("jigsaw") || promptLower.includes("puzzle")) {
        rawType = "jigsaw";
      } else if (rawType.includes("true") || rawType.includes("false") || rawType === "tf" || (Array.isArray(q.options) && q.options.length === 2 && q.options.every((o: any) => /^(true|false)$/i.test(String(o).trim())))) {
        rawType = "true_false";
      } else {
        rawType = "multi_choice";
      }

      if (rawType === "jigsaw") {
        const puzzleSubtopic = q.prompt
          ? q.prompt.replace(/assemble the jigsaw puzzle for/gi, "").replace(/jigsaw puzzle/gi, "").replace(/puzzle/gi, "").trim()
          : "";
        const imageTopic = puzzleSubtopic.length > 2 ? puzzleSubtopic : params.topic;
        const jigsawImage = await fetchAndUploadTopicImage(imageTopic);
        const gridSize = params.difficulty === "easy" ? "2x2" : params.difficulty === "hard" ? "4x4" : "3x3";
        const qPrompt = q.prompt || `Jigsaw Puzzle: ${imageTopic}`;
        questions.push({
          prompt: qPrompt,
          questionType: "jigsaw",
          image: jigsawImage,
          gridSize,
          difficulty: params.difficulty,
          explanation: q.explanation || `Assemble the ${gridSize} jigsaw puzzle.`,
          questionData: {
            image: jigsawImage,
            prompt_image: jigsawImage,
            gridSize,
            difficulty: params.difficulty === "mixed" ? "medium" : params.difficulty,
          },
        });
      } else if (rawType === "fill_blank") {
        let sentence = String(q.sentence || q.prompt || "").trim();
        const answer = String(q.answer || q.correctAnswer || "").trim();
        if (!sentence.includes("___")) sentence = `${sentence} ___`;
        const rawDistractors = Array.isArray(q.options)
          ? q.options.filter((o) => typeof o === "string" && o.toLowerCase() !== answer.toLowerCase())
          : ["Option A", "Option B", "Option C"];
        const options = shuffleArray([answer, ...rawDistractors.slice(0, 3)]);
        const hint = q.hint || `Think about ${params.topic}`;
        const explanation = q.explanation || `The answer is ${answer}.`;
        questions.push({
          prompt: sentence,
          sentence,
          answer,
          options,
          correctAnswer: answer,
          hint,
          explanation,
          questionType: "fill_blank",
          questionData: { sentence, answer, options, hint },
        });
      } else if (rawType === "memory_match") {
        const rawPairs = Array.isArray(q.pairs) ? q.pairs.slice(0, 4) : [];
        const pairs = rawPairs.map((p, pIdx) => ({
          id: pIdx + 1,
          label: String(p.label || p.item || `Concept ${pIdx + 1}`).trim(),
          emoji: p.emoji || "✨",
        }));
        const prompt = q.prompt || `Match the pairs for ${params.topic}`;
        const explanation = q.explanation || "Match the pairs.";
        questions.push({
          prompt,
          pairs,
          grid: "4x4",
          questionType: "memory_match",
          explanation,
          questionData: { grid: "4x4", pairs },
        });
      } else if (rawType === "drag_drop_match") {
        const rawPairs = Array.isArray(q.pairs) ? q.pairs.slice(0, 4) : [];
        const drag_items = rawPairs.map((p: any, pIdx) => ({
          id: `drag-${pIdx + 1}`,
          label: String(p.item || p.label || `Item ${pIdx + 1}`).trim(),
          image: p.image ? String(p.image).trim() : "",
        }));
        const drop_targets = rawPairs.map((p, pIdx) => ({
          id: `target-${pIdx + 1}`,
          label: String(p.target || `Target ${pIdx + 1}`).trim(),
        }));
        const match_rules = rawPairs.map((_, pIdx) => ({
          drag_item_id: `drag-${pIdx + 1}`,
          drop_target_id: `target-${pIdx + 1}`,
        }));
        const prompt = q.prompt || "Match each item with its correct pair.";
        const explanation = q.explanation || "Drag each item to its correct drop target.";
        questions.push({
          prompt,
          drag_items,
          drop_targets,
          match_rules,
          questionType: "drag_drop_match",
          explanation,
          questionData: { drag_items, drop_targets, match_rules },
        });
      } else if (rawType === "true_false") {
        const isTrue = q.isTrue !== undefined ? Boolean(q.isTrue) : String(q.correctAnswer).toLowerCase() === "true";
        const correctAnswer = isTrue ? "True" : "False";
        const correctOptionIndex = isTrue ? 0 : 1;
        const prompt = String(q.prompt).trim();
        const explanation = q.explanation || `This statement is ${correctAnswer}.`;
        questions.push({
          prompt,
          options: ["True", "False"],
          correctAnswer,
          correctOptionIndex,
          explanation,
          questionType: "true_false",
          questionData: {
            question: prompt,
            options: [
              { id: "opt-1", label: "True", text: "True", is_correct: isTrue, correct: isTrue },
              { id: "opt-2", label: "False", text: "False", is_correct: !isTrue, correct: !isTrue },
            ],
            correctOptionIndex,
            correct_option: correctOptionIndex,
            explanation,
          },
        });
      } else {
        // Default multi_choice
        const prompt = String(q.prompt || `Question ${idx + 1}`).trim();
        const rawOpts = Array.isArray(q.options) ? q.options : Array.isArray(q.choices) ? q.choices : [];
        let options = rawOpts.map((o) => typeof o === "string" ? o.trim() : String(o?.text || o?.label || o?.option || "").trim()).filter(Boolean);
        while (options.length < 4) {
          options.push(`Option ${String.fromCharCode(65 + options.length)}`);
        }
        let correctAnswer = String(q.correctAnswer ?? options[0]).trim();
        if (!options.includes(correctAnswer)) {
          correctAnswer = options[0];
        }
        options = shuffleArray(options);
        const correctOptionIndex = Math.max(0, options.indexOf(correctAnswer));
        const explanation = String(q.explanation || "Correct answer.").trim();
        const formattedOptions = options.map((optText, optIdx) => ({
          id: `opt-${optIdx + 1}`,
          label: optText,
          text: optText,
          is_correct: optIdx === correctOptionIndex,
          correct: optIdx === correctOptionIndex,
        }));
        questions.push({
          prompt,
          options,
          correctAnswer,
          correctOptionIndex,
          explanation,
          questionType: "multi_choice",
          questionData: {
            question: prompt,
            options: formattedOptions,
            correctOptionIndex,
            correct_option: correctOptionIndex,
            explanation,
          },
        });
      }
    }

    const contentId = newContentId("quiz");
    return {
      contentId,
      name: title,
      preview: {
        title,
        questionCount: questions.length,
        sampleQuestions: questions.slice(0, 3),
      },
      data: {
        title,
        quizType: "mixed",
        questions,
      },
    };
  }

  // ── 1. JIGSAW PUZZLE QUIZ ──────────────────────────────────────────
  if (quizType === "jigsaw") {
    const gridSize =
      params.difficulty === "easy" ? "2x2" : params.difficulty === "hard" ? "4x4" : "3x3";
    const count = Math.min(params.questionCount, 3);
    const questions = [];

    for (let i = 0; i < count; i++) {
      const imageUrl = await fetchAndUploadTopicImage(params.topic);
      const puzzleTitle =
        count > 1 ? `${params.topic} Puzzle #${i + 1}` : `Jigsaw Puzzle: ${params.topic}`;
      const qData = {
        image: imageUrl,
        prompt_image: imageUrl,
        gridSize,
        difficulty: params.difficulty === "mixed" ? "medium" : params.difficulty,
      };
      questions.push({
        prompt: puzzleTitle,
        questionType: "jigsaw",
        image: imageUrl,
        gridSize,
        difficulty: params.difficulty,
        explanation: `Complete the ${gridSize} puzzle by assembling the pieces into the correct image.`,
        questionData: qData,
      });
    }

    const title = `${params.topic} — Jigsaw Challenge`;
    const contentId = newContentId("quiz");

    return {
      contentId,
      name: title,
      preview: {
        title,
        questionCount: questions.length,
        sampleQuestions: questions.slice(0, 3),
      },
      data: {
        title,
        quizType: "jigsaw",
        questions,
      },
    };
  }

  // ── 2. FILL IN THE BLANK QUIZ ───────────────────────────────────────
  if (quizType === "fill_blank") {
    const output = await generateJson<{
      title?: string;
      questions: Array<{
        prompt?: string;
        sentence: string;
        answer: string;
        distractors?: string[];
        hint?: string;
        explanation?: string;
      }>;
    }>({
      system:
        "You are an expert curriculum writer. Reply with ONLY a JSON object: " +
        "{ title: string, questions: [{ prompt, sentence, answer, distractors: [string, string, string], hint?, explanation? }] }. " +
        "Each 'sentence' MUST contain '___' where the 'answer' belongs. " +
        "Provide exactly 3 believable distractors for each question so there are 4 total options. " +
        "Write age-appropriate, factually accurate questions.",
      prompt: [
        `Subject: ${params.subject}`,
        `Grade level: ${params.gradeLevel}`,
        `Topic: ${params.topic}`,
        `Difficulty: ${params.difficulty}`,
        `Number of questions: ${params.questionCount}`,
        `Randomness seed: ${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        "IMPORTANT: Generate completely fresh, diverse, creative questions covering different subtopics. Avoid repetitive or boilerplate questions.",
      ].join("\n"),
      temperature: 0.85,
      maxTokens: 4000,
    });

    const title = output.title || `${params.topic} — Fill in the Blanks`;
    const questions = (output.questions || []).map((q, idx) => {
      let sentence = String(q.sentence || q.prompt || "").trim();
      const answer = String(q.answer || "").trim();
      if (!sentence.includes("___")) {
        sentence = `${sentence} ___`;
      }
      const rawDistractors = Array.isArray(q.distractors) ? q.distractors : ["Option A", "Option B", "Option C"];
      const allOpts = shuffleArray([answer, ...rawDistractors.slice(0, 3)]);
      const hint = q.hint || `Think about key concepts in ${params.topic}`;
      const explanation = q.explanation || `The correct word is "${answer}".`;

      return {
        prompt: sentence,
        sentence,
        answer,
        options: allOpts,
        correctAnswer: answer,
        hint,
        explanation,
        questionType: "fill_blank",
        questionData: {
          sentence,
          answer,
          options: allOpts,
          hint,
        },
      };
    });

    const contentId = newContentId("quiz");
    return {
      contentId,
      name: title,
      preview: {
        title,
        questionCount: questions.length,
        sampleQuestions: questions.slice(0, 3),
      },
      data: {
        title,
        quizType: "fill_blank",
        questions,
      },
    };
  }

  // ── 3. MEMORY MATCH QUIZ ───────────────────────────────────────────
  if (quizType === "memory_match") {
    const output = await generateJson<{
      title?: string;
      questions: Array<{
        prompt: string;
        pairs: Array<{ label: string; emoji?: string }>;
        explanation?: string;
      }>;
    }>({
      system:
        "You are an expert curriculum writer. Reply with ONLY a JSON object: " +
        "{ title: string, questions: [{ prompt: string, pairs: [{ label: string, emoji: string }], explanation?: string }] }. " +
        "Each question MUST contain exactly 4 matching pairs (for a 4x4 card grid). " +
        "Write clear, distinct educational concepts with representative emojis.",
      prompt: [
        `Subject: ${params.subject}`,
        `Grade level: ${params.gradeLevel}`,
        `Topic: ${params.topic}`,
        `Difficulty: ${params.difficulty}`,
        `Number of questions: ${Math.min(params.questionCount, 5)}`,
        `Randomness seed: ${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        "IMPORTANT: Generate completely fresh, diverse, creative concept pairs. Avoid repetitive pairs.",
      ].join("\n"),
      temperature: 0.85,
      maxTokens: 4000,
    });

    const title = output.title || `${params.topic} — Memory Match`;
    const questions = (output.questions || []).map((q, idx) => {
      const rawPairs = Array.isArray(q.pairs) ? q.pairs.slice(0, 4) : [];
      const pairs = rawPairs.map((p, pIdx) => ({
        id: pIdx + 1,
        label: String(p.label || `Concept ${pIdx + 1}`).trim(),
        emoji: p.emoji || "✨",
      }));
      const prompt = q.prompt || `Match the pairs for ${params.topic}`;
      const explanation = q.explanation || "Find all matching card pairs to win!";

      return {
        prompt,
        pairs,
        grid: "4x4",
        questionType: "memory_match",
        explanation,
        questionData: {
          grid: "4x4",
          pairs,
        },
      };
    });

    const contentId = newContentId("quiz");
    return {
      contentId,
      name: title,
      preview: {
        title,
        questionCount: questions.length,
        sampleQuestions: questions.slice(0, 3),
      },
      data: {
        title,
        quizType: "memory_match",
        questions,
      },
    };
  }

  // ── 4. DRAG & DROP MATCH QUIZ ──────────────────────────────────────
  if (quizType === "drag_drop_match") {
    const output = await generateJson<{
      title?: string;
      questions: Array<{
        prompt: string;
        pairs: Array<{ item: string; target: string }>;
        explanation?: string;
      }>;
    }>({
      system:
        "You are an expert curriculum writer. Reply with ONLY a JSON object: " +
        "{ title: string, questions: [{ prompt: string, pairs: [{ item: string, target: string }], explanation?: string }] }. " +
        "Each question MUST contain 3 to 4 matching pairs of items and their correct target slots. " +
        "Example: item: 'Lion', target: 'Carnivore'.",
      prompt: [
        `Subject: ${params.subject}`,
        `Grade level: ${params.gradeLevel}`,
        `Topic: ${params.topic}`,
        `Difficulty: ${params.difficulty}`,
        `Number of questions: ${Math.min(params.questionCount, 5)}`,
        `Randomness seed: ${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        "IMPORTANT: Generate completely fresh, diverse, creative matching pairs.",
      ].join("\n"),
      temperature: 0.85,
      maxTokens: 4000,
    });

    const title = output.title || `${params.topic} — Matching Challenge`;
    const questions = (output.questions || []).map((q, idx) => {
      const rawPairs = Array.isArray(q.pairs) ? q.pairs.slice(0, 4) : [];
      const drag_items = rawPairs.map((p: any, pIdx) => ({
        id: `drag-${pIdx + 1}`,
        label: String(p.item).trim(),
        image: p.image ? String(p.image).trim() : "",
      }));
      const drop_targets = rawPairs.map((p, pIdx) => ({
        id: `target-${pIdx + 1}`,
        label: String(p.target).trim(),
      }));
      const match_rules = rawPairs.map((_, pIdx) => ({
        drag_item_id: `drag-${pIdx + 1}`,
        drop_target_id: `target-${pIdx + 1}`,
      }));
      const prompt = q.prompt || `Match each item with its correct pair.`;
      const explanation = q.explanation || "Drag each item on the left to its matching box on the right.";

      return {
        prompt,
        drag_items,
        drop_targets,
        match_rules,
        questionType: "drag_drop_match",
        explanation,
        questionData: {
          drag_items,
          drop_targets,
          match_rules,
        },
      };
    });

    const contentId = newContentId("quiz");
    return {
      contentId,
      name: title,
      preview: {
        title,
        questionCount: questions.length,
        sampleQuestions: questions.slice(0, 3),
      },
      data: {
        title,
        quizType: "drag_drop_match",
        questions,
      },
    };
  }

  // ── 5. TRUE / FALSE QUIZ ───────────────────────────────────────────
  if (quizType === "true_false") {
    const output = await generateJson<{
      title?: string;
      questions: Array<{
        prompt: string;
        isTrue: boolean;
        explanation?: string;
      }>;
    }>({
      system:
        "You are an expert curriculum writer. Reply with ONLY a JSON object: " +
        "{ title: string, questions: [{ prompt: string, isTrue: boolean, explanation: string }] }. " +
        "Statements must be clear, unambiguous facts for the subject and grade level.",
      prompt: [
        `Subject: ${params.subject}`,
        `Grade level: ${params.gradeLevel}`,
        `Topic: ${params.topic}`,
        `Difficulty: ${params.difficulty}`,
        `Number of questions: ${params.questionCount}`,
        `Randomness seed: ${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        "IMPORTANT: Generate fresh, distinct statements covering various aspects of the topic.",
      ].join("\n"),
      temperature: 0.85,
      maxTokens: 4000,
    });

    const title = output.title || `${params.topic} — True or False`;
    const questions = (output.questions || []).map((q, idx) => {
      const prompt = String(q.prompt).trim();
      const correctAnswer = q.isTrue ? "True" : "False";
      const options = ["True", "False"];
      const explanation = q.explanation || `This statement is ${correctAnswer}.`;
      const correctOptionIndex = q.isTrue ? 0 : 1;

      return {
        prompt,
        options,
        correctAnswer,
        correctOptionIndex,
        explanation,
        questionType: "true_false",
        questionData: {
          question: prompt,
          options: [
            { id: "opt-1", label: "True", text: "True", is_correct: q.isTrue, correct: q.isTrue },
            { id: "opt-2", label: "False", text: "False", is_correct: !q.isTrue, correct: !q.isTrue },
          ],
          correctOptionIndex,
          correct_option: correctOptionIndex,
          explanation,
        },
      };
    });

    const contentId = newContentId("quiz");
    return {
      contentId,
      name: title,
      preview: {
        title,
        questionCount: questions.length,
        sampleQuestions: questions.slice(0, 3),
      },
      data: {
        title,
        quizType: "true_false",
        questions,
      },
    };
  }

  // ── 6. DEFAULT: MULTI_CHOICE & SINGLE_CHOICE ────────────────────────
  const output = await generateJson<{
    title?: string;
    questions: Array<{
      prompt?: string;
      question?: string;
      options?: any[];
      choices?: any[];
      correctAnswer?: string;
      explanation?: string;
    }>;
  }>({
    system:
      "You are an expert curriculum writer. Reply with ONLY a JSON object, no prose, " +
      "matching this shape: { title: string, questions: [{ prompt, options: [string, string, string, string], correctAnswer, explanation }] }. " +
      "Always include 4 distinct options with 1 unambiguous correct answer. " +
      "Write age-appropriate, factually accurate questions.",
    prompt: [
      `Subject: ${params.subject}`,
      `Grade level: ${params.gradeLevel}`,
      `Topic: ${params.topic}`,
      `Quiz type: ${quizType}`,
      `Difficulty: ${params.difficulty}`,
      `Number of questions: ${params.questionCount}`,
      params.timeLimitMinutes ? `Time limit: ${params.timeLimitMinutes} minutes` : "",
      `Randomness seed: ${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      "IMPORTANT: Generate completely fresh, diverse, creative questions. Avoid repeating standard textbook questions.",
    ]
      .filter(Boolean)
      .join("\n"),
    temperature: 0.85,
    maxTokens: 4000,
  });

  const title = output.title || `${params.topic} Quiz`;
  const questions = (output.questions || []).map((q, idx) => {
    const prompt = String(q.prompt || q.question || `Question ${idx + 1}`).trim();
    const rawOptions = Array.isArray(q.options) ? q.options : Array.isArray(q.choices) ? q.choices : [];
    let options: string[] = [];
    const seen = new Set<string>();

    rawOptions.forEach((o: any, oIdx: number) => {
      let txt =
        typeof o === "string"
          ? o.trim()
          : String(o?.text ?? o?.option ?? o?.choice ?? o?.value ?? o?.label ?? o?.answer ?? "").trim();
      txt = txt.replace(/^([A-D]|[a-d]|[1-4]|[क-घ])[\.\)\:\-]\s*/, "").trim();
      if (!txt || txt === "[object Object]") {
        txt = `Option ${String.fromCharCode(65 + oIdx)}`;
      }
      if (seen.has(txt.toLowerCase())) {
        txt = `${txt} (${String.fromCharCode(65 + oIdx)})`;
      }
      seen.add(txt.toLowerCase());
      options.push(txt);
    });

    if (options.length < 4) {
      while (options.length < 4) {
        options.push(`Choice ${String.fromCharCode(65 + options.length)}`);
      }
    }

    let correctAnswer = String(q.correctAnswer ?? options[0]).trim();
    if (!options.includes(correctAnswer)) {
      if (/^[0-3]$/.test(correctAnswer)) {
        correctAnswer = options[parseInt(correctAnswer, 10)] || options[0];
      } else if (/^[A-D]$/i.test(correctAnswer)) {
        const cIdx = correctAnswer.toUpperCase().charCodeAt(0) - 65;
        correctAnswer = options[cIdx] || options[0];
      } else {
        const found = options.find((o) => o.toLowerCase().includes(correctAnswer.toLowerCase()));
        correctAnswer = found || options[0];
      }
    }

    // Fisher-Yates shuffle options to randomize correct answer position
    options = shuffleArray(options);

    const correctOptionIndex = Math.max(0, options.indexOf(correctAnswer));
    const explanation = String(q.explanation || "Correct answer.").trim();

    const formattedOptions = options.map((optText, optIdx) => ({
      id: `opt-${optIdx + 1}`,
      label: optText,
      text: optText,
      is_correct: optIdx === correctOptionIndex,
      correct: optIdx === correctOptionIndex,
    }));

    return {
      prompt,
      options,
      correctAnswer,
      correctOptionIndex,
      explanation,
      questionType: quizType,
      questionData: {
        question: prompt,
        options: formattedOptions,
        correctOptionIndex,
        correct_option: correctOptionIndex,
        explanation,
      },
    };
  });

  const contentId = newContentId("quiz");

  return {
    contentId,
    name: title,
    preview: {
      title,
      questionCount: questions.length,
      sampleQuestions: questions.slice(0, 3),
    },
    data: {
      title,
      quizType,
      questions,
    },
  };
}
