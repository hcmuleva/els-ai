# Step 3: Mobile Quiz Engine (Expo & React Native)

## 1. Core Architecture
The mobile app acts as a **Renderer Engine**. It should not have hardcoded quiz logic. Instead, it reads the `question_type` and `question_data` from the backend and renders the appropriate UI.

### 1.1 Key Libraries
- **Animations:** `react-native-reanimated`, `lottie-react-native`.
- **Gestures:** `react-native-gesture-handler`.
- **Sound:** `expo-av`.
- **Storage:** `expo-secure-store` (for tokens).

## 2. Dynamic Renderer Pattern

### 2.1 Component Structure
```javascript
// components/quiz/QuizRenderer.tsx
import DragDropRenderer from './renderers/DragDropRenderer';
import ImageSelectRenderer from './renderers/ImageSelectRenderer';

const QuizRenderer = ({ question }) => {
  switch (question.question_type) {
    case 'drag_drop':
      return <DragDropRenderer data={question.question_data} />;
    case 'image_select':
      return <ImageSelectRenderer data={question.question_data} />;
    default:
      return <Text>Unsupported Question Type</Text>;
  }
};
```

## 3. Interactive Playroom Features (Kids Focus)

### 3.1 Audio Feedback
- **Tap Sounds:** Every button press should have a subtle "click" or "pop" sound.
- **Success Jingle:** Play a cheerful sound and show confetti/stars on correct answers.
- **Error Feedback:** Play a gentle "boing" or "shake" animation on wrong answers.
- **Background Music:** Loop playful, low-volume music during the quiz.

### 3.2 Drag & Drop Logic
- Use `react-native-reanimated` for smooth movement.
- When an item is dragged over a valid target, provide haptic feedback and highlight the target.
- On drop, if correct, snap to position and play success sound. If wrong, snap back to start.

## 4. Implementation Checklist
- [ ] Implement `ProfilePage` for updating user info (first_name, last_name, profile_image).
- [ ] Implement `QuizRenderer` shell with support for `expo-av`.
- [ ] Create `DragDropRenderer` using `react-native-reanimated`.
- [ ] Implement `ImageSelectRenderer` with sound prompts.
- [ ] Setup global `AuthContext` to handle refresh tokens and auto-login.
- [ ] Ensure the UI adapts based on the selected `active_profile`.
