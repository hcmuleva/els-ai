# Step 2: Backend Services & Quiz Architecture

## 1. Modular Service Structure
The backend should be structured as a monorepo of micro-services or a highly modular monolith.

### 1.1 Key Modules
- **Auth Service:** User management, login, token rotation, RBAC.
- **Content Service:** AI-generated stories, videos, and lesson plans.
- **Quiz Service:** Dynamic quiz generation and assessment logic.
- **Reporting Service:** Aggregating data for parents, teachers, and admins.
- **Storage Service:** Integration with AWS S3 for media assets.

## 2. Dynamic Quiz Schema (PostgreSQL)
We use a hybrid relational + JSONB approach for maximum flexibility.

### 2.1 Quizzes Table
```sql
CREATE TABLE quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail_image TEXT,
    created_by UUID NOT NULL, -- Teacher or AI Agent ID
    class_level VARCHAR(50), -- KG, Class 1, etc.
    subject VARCHAR(100), -- Animals, Maths, etc.
    quiz_type VARCHAR(100) NOT NULL, -- drag_drop, image_select, etc.
    difficulty_level VARCHAR(50),
    background_music_url TEXT,
    theme JSONB DEFAULT '{}', -- colors, sound_pack
    total_questions INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT false,
    is_ai_generated BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### 2.2 Quiz Questions Table
```sql
CREATE TABLE quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
    question_type VARCHAR(100) NOT NULL,
    question_title TEXT,
    question_instruction TEXT,
    question_audio TEXT,
    time_limit_seconds INTEGER DEFAULT 30,
    points INTEGER DEFAULT 10,
    sort_order INTEGER,
    question_data JSONB NOT NULL, -- DYNAMIC DATA PER TYPE
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 2.3 Assets Table (Centralized Media)
```sql
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    asset_type VARCHAR(50), -- image, audio, video
    file_url TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 3. Dynamic `question_data` Examples

### 3.1 Drag & Drop Match
```json
{
  "drag_items": [
    {"id": "lion", "image": "lion.png", "sound": "lion.mp3"},
    {"id": "tiger", "image": "tiger.png", "sound": "tiger.mp3"}
  ],
  "drop_targets": [
    {"id": "lion", "label": "Lion"},
    {"id": "tiger", "label": "Tiger"}
  ],
  "match_rules": [
    {"drag_item_id": "lion", "drop_target_id": "lion"},
    {"drag_item_id": "tiger", "drop_target_id": "tiger"}
  ],
  "sounds": {"drag": "drag.mp3", "drop": "drop.mp3", "success": "win.mp3"}
}
```

### 3.2 Image Select (Sound Match)
```json
{
  "prompt_audio": "find_elephant.mp3",
  "options": [
    {"id": 1, "image": "elephant.png", "is_correct": true},
    {"id": 2, "image": "dog.png", "is_correct": false}
  ]
}
```

## 4. Implementation Checklist
- [ ] Setup S3 bucket integration for asset uploads.
- [ ] Implement CRUD for Quizzes and Questions.
- [ ] Create API for fetching Random Background Music based on theme.
- [ ] Implement `student_attempts` and `question_attempts` to track progress.
- [ ] Ensure all API responses use `snake_case`.
