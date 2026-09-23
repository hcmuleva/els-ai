import { generateTopic } from "./topic.generator.js";
import { generateQuestions } from "./question.generator.js";
import { generateQuiz } from "./quiz.generator.js";
import { generateContent } from "./content.generator.js";
import { generateStory } from "./story.generator.js";
import { generateClassroom } from "./classroom.generator.js";
export const generatorByType = {
    topic: generateTopic,
    question: generateQuestions,
    quiz: generateQuiz,
    content: generateContent,
    story: generateStory,
    classroom: generateClassroom,
};
