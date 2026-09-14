import type { ContentType } from "../types.js";
import type { GeneratorResult } from "./types.js";
import { generateTopic } from "./topic.generator.js";
import { generateQuestions } from "./question.generator.js";
import { generateQuiz } from "./quiz.generator.js";
import { generateContent } from "./content.generator.js";
import { generateStory } from "./story.generator.js";
import { generateClassroom } from "./classroom.generator.js";

type Generator = (params: any) => Promise<GeneratorResult>;

export const generatorByType: Record<ContentType, Generator> = {
  topic: generateTopic,
  question: generateQuestions,
  quiz: generateQuiz,
  content: generateContent,
  story: generateStory,
  classroom: generateClassroom,
};
