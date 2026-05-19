# Step 4: AI Agents & Automated Generation

## 1. Multi-Agent System Architecture
Agents are specialized LLM prompts/tools that handle specific parts of the learning journey.

### 1.1 Core Agents
1. **Context Agent:** Analyzes student progress, strengths, and weaknesses to decide what content to generate next.
2. **Content Generator:** Creates age-appropriate stories, text, and lesson scripts.
3. **Question Generator:** Converts content into structured `question_data` (JSON) for the Quiz Engine.
4. **Assessment Agent:** Evaluates student attempts and provides qualitative feedback.
5. **Recommendation Agent:** Suggests the next topic or difficulty level.

## 2. Quiz Generation Workflow

### 2.1 The Generation Prompt
Teachers or the system can trigger generation by providing:
- **Topic:** (e.g., "Animal Habitats")
- **Class Level:** (e.g., "KG")
- **Quiz Type:** (e.g., "drag_drop")

### 2.2 Expected AI Output (Example)
The AI MUST return a valid JSON object that matches the `quiz_questions` schema.

```json
{
  "quiz_metadata": {
    "title": "Where do animals live?",
    "subject": "Nature",
    "difficulty": "easy"
  },
  "questions": [
    {
      "type": "drag_drop",
      "instruction": "Match the animal to its home",
      "data": {
        "drag_items": [
          {"id": "fish", "image": "fish_icon_url", "sound": "glug_sound_url"},
          {"id": "bird", "image": "bird_icon_url", "sound": "chirp_sound_url"}
        ],
        "drop_targets": [
          {"id": "fish", "label": "Water"},
          {"id": "bird", "label": "Nest"}
        ]
      }
    }
  ]
}
```

## 3. Feedback & Iteration
1. **AI Generates:** System creates the quiz JSON.
2. **Teacher Reviews:** Display the generated data in a dashboard.
3. **Teacher Modifies:** Teacher can edit labels, swap images, or change instructions.
4. **Publish:** Once approved, the quiz is marked `is_published: true`.

## 4. Implementation Checklist
- [ ] Create system prompts for each agent in the `agents/` folder.
- [ ] Implement a `GeneratorService` that calls LLM APIs (OpenAI/Gemini/Anthropic).
- [ ] Build a "Review Dashboard" for teachers to validate AI-generated quizzes.
- [ ] Setup a library of "Common Assets" (success/fail sounds, default icons) for the AI to reference.
