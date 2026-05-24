import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
export const aiRouter = Router();
const generateSchema = z.object({
    topic: z.string().min(1),
    classLevel: z.string().default('LKG'),
    quizType: z.enum(['drag_drop', 'image_select']),
    difficultyLevel: z.string().default('Easy'),
});
aiRouter.post('/generate', requireAuth, async (req, res) => {
    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
    }
    const { topic, classLevel, quizType, difficultyLevel } = parsed.data;
    // AI Generation Simulation based on parameters
    let title = `AI-Generated: ${topic}`;
    let description = `Explore and practice '${topic}' through this interactive ${quizType.replace('_', ' ')} quiz.`;
    let questions = [];
    const playfulBgm = '/media/bg-audio/eliveta-kids-happy-music-474162.mp3';
    if (quizType === 'drag_drop') {
        if (topic.toLowerCase().includes('fraction') || topic.toLowerCase().includes('math')) {
            questions = [
                {
                    question_type: 'drag_drop',
                    question_title: 'Match Fraction Visuals to Numbers',
                    question_instruction: 'Drag each fraction number to its matching visual circle!',
                    question_data: {
                        drag_items: [
                            { id: 'half', image: 'https://img.icons8.com/color/96/half-empty.png', label: '1/2' },
                            { id: 'quarter', image: 'https://img.icons8.com/color/96/one-quarter.png', label: '1/4' },
                            { id: 'three_quarters', image: 'https://img.icons8.com/color/96/three-quarters.png', label: '3/4' },
                        ],
                        drop_targets: [
                            { id: 'half', label: 'Half shaded circle' },
                            { id: 'quarter', label: 'One-quarter shaded circle' },
                            { id: 'three_quarters', label: 'Three-quarters shaded circle' },
                        ],
                        match_rules: [
                            { drag_item_id: 'half', drop_target_id: 'half' },
                            { drag_item_id: 'quarter', drop_target_id: 'quarter' },
                            { drag_item_id: 'three_quarters', drop_target_id: 'three_quarters' },
                        ],
                    },
                },
            ];
        }
        else {
            // Default matching (Colors / General)
            questions = [
                {
                    question_type: 'drag_drop',
                    question_title: `Match items for ${topic}`,
                    question_instruction: 'Match each item on the left with its correct counterpart on the right!',
                    question_data: {
                        drag_items: [
                            { id: 'item1', image: 'https://img.icons8.com/color/96/apple.png', label: 'Red Apple' },
                            { id: 'item2', image: 'https://img.icons8.com/color/96/banana.png', label: 'Yellow Banana' },
                            { id: 'item3', image: 'https://img.icons8.com/color/96/grapes.png', label: 'Purple Grapes' },
                        ],
                        drop_targets: [
                            { id: 'item1', label: 'Matches with RED color' },
                            { id: 'item2', label: 'Matches with YELLOW color' },
                            { id: 'item3', label: 'Matches with PURPLE color' },
                        ],
                        match_rules: [
                            { drag_item_id: 'item1', drop_target_id: 'item1' },
                            { drag_item_id: 'item2', drop_target_id: 'item2' },
                            { drag_item_id: 'item3', drop_target_id: 'item3' },
                        ],
                    },
                },
            ];
        }
    }
    else {
        // quizType === 'image_select'
        if (topic.toLowerCase().includes('animal') || topic.toLowerCase().includes('nature')) {
            questions = [
                {
                    question_type: 'image_select',
                    question_title: 'Find the King of the Jungle!',
                    question_instruction: 'Listen to the sound and choose the animal that makes it.',
                    question_audio: '/media/sounds/lion.mp3',
                    question_data: {
                        prompt_audio: '/media/sounds/lion.mp3',
                        options: [
                            { id: 'lion', image: '/media/pictures/lion.png', is_correct: true, label: 'Lion' },
                            { id: 'ape', image: '/media/pictures/ape.png', is_correct: false, label: 'Ape' },
                            { id: 'elephant', image: '/media/pictures/elephant.png', is_correct: false, label: 'Elephant' },
                        ],
                    },
                },
                {
                    question_type: 'image_select',
                    question_title: 'Which animal says Moo?',
                    question_instruction: 'Select the animal that makes a Moo sound.',
                    question_audio: '/media/sounds/cow.mp3',
                    question_data: {
                        prompt_audio: '/media/sounds/cow.mp3',
                        options: [
                            { id: 'sheep', image: '/media/pictures/sheep.png', is_correct: false, label: 'Sheep' },
                            { id: 'cow', image: '/media/pictures/cow.png', is_correct: true, label: 'Cow' },
                            { id: 'rooster', image: '/media/pictures/rooster.png', is_correct: false, label: 'Rooster' },
                        ],
                    },
                },
            ];
        }
        else {
            // Default Image Select (Shapes / General)
            questions = [
                {
                    question_type: 'image_select',
                    question_title: `Find the correct item representing ${topic}`,
                    question_instruction: 'Select the correct image option below.',
                    question_data: {
                        options: [
                            { id: 'opt1', image: 'https://img.icons8.com/color/96/checked.png', is_correct: true, label: 'Correct Choice' },
                            { id: 'opt2', image: 'https://img.icons8.com/color/96/cancel.png', is_correct: false, label: 'Incorrect Choice A' },
                            { id: 'opt3', image: 'https://img.icons8.com/color/96/minus.png', is_correct: false, label: 'Incorrect Choice B' },
                        ],
                    },
                },
            ];
        }
    }
    // Artificial delay to simulate processing of Content + Question generator agents
    await new Promise((resolve) => setTimeout(resolve, 800));
    return res.json({
        title,
        description,
        quiz_type: quizType,
        class_level: classLevel,
        difficulty_level: difficultyLevel,
        background_music_url: playfulBgm,
        theme: { colors: { primary: '#6366f1', background: '#e0e7ff' } },
        questions,
    });
});
