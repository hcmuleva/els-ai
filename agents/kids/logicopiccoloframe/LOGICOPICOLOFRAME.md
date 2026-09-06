You are a senior React Native architect and interactive UI/UX designer specializing in learning systems.

Your task is to design and implement a Logicopiccolo Frame Component in an existing React Native mobile application.

This component is used for interactive worksheets where students drag buttons into slots based on logic.

────────────────────────────────
1. DESIGN REFERENCE (MANDATORY)
────────────────────────────────

Use the provided image:
agents/kids/logicopiccoloframe/frame.jpeg

Visual Structure:
• L-shaped frame
• Vertical column of slots on the right side
• Bottom row of colored circular buttons
• Frame border (green/solid style)
• Worksheet displayed inside frame

The UI must closely resemble this structure.

────────────────────────────────
2. COMPONENT NAME
────────────────────────────────

LogicopiccoloFrame

────────────────────────────────
3. CORE FUNCTIONALITY
────────────────────────────────

A) Worksheet Loader
• Load worksheet HTML from:
  agents/kids/logicopicolo/results/*.html
• Display inside frame using WebView

B) Thumbnail Selector
• Show all worksheets as thumbnails
• On click → load selected worksheet into frame

C) Drag-and-Drop Interaction
• 10 draggable buttons from:
  agents/kids/logicopicolo/visual/buttons

Behavior:
• Buttons placed at bottom row
• User drags button to vertical slots
• Snap to slot position
• Allow reposition / replace

D) Slot System
• Fixed number of vertical slots on right side
• Each slot accepts one button
• Maintain mapping: slot → button

E) Flip Worksheet
• Button at top of frame:
  “Flip”
• On click:
  - Flip worksheet (front/back)
  - Or reload alternate version

────────────────────────────────
4. TEACHER INTEGRATION
────────────────────────────────

• Add new tab in Teacher view:
  “Logicopiccolo”

Inside tab:
• Worksheet selector
• Frame component
• Preview mode

Teacher can:
• View worksheet
• Test interactions
• (Optional future: assign to student)

────────────────────────────────
5. UI REQUIREMENTS
────────────────────────────────

Layout:

--------------------------------
| Flip Button (Top)              |
| ------------------------------ |
|                                |
| WORKSHEET (WebView)            |
|                                |
|                                | SLOT AREA |  |
|                                | (Right)   |  |
|                                |
| ------------------------------ |
| Bottom: Draggable Buttons      |
--------------------------------

Details:
• Smooth rounded buttons
• Color-coded circles
• Snap animation on drop
• Shadow/elevation for realism
• Responsive layout

────────────────────────────────
6. INTERACTION DESIGN
────────────────────────────────

• Drag:
  - Use PanResponder or react-native-gesture-handler
• Drop:
  - Detect nearest slot
  - Snap to slot
• Feedback:
  - Highlight slot on hover
  - Animate placement

Constraints:
• One button per slot
• Button can be moved back

────────────────────────────────
7. STATE MANAGEMENT
────────────────────────────────

Maintain:

• selectedWorksheet
• buttons[] (positions, id)
• slots[] (occupied/unoccupied)
• mapping (slotId → buttonId)

────────────────────────────────
8. DATA FLOW
────────────────────────────────

Input:
• Worksheet HTML
• Button assets

Output:
• User interaction mapping
• Result state (correct/incorrect in future)

────────────────────────────────
9. FILE STRUCTURE
────────────────────────────────

📁 /app/modules/logicopiccolo/
   ├── LogicopiccoloFrame.tsx
   ├── WorksheetSelector.tsx
   ├── DraggableButton.tsx
   ├── SlotColumn.tsx
   ├── useDragLogic.ts
   ├── styles.ts

────────────────────────────────
10. TECH STACK
────────────────────────────────

• React Native
• WebView (for HTML)
• Gesture handler for drag
• Animated API for smooth UX

────────────────────────────────
11. PERFORMANCE
────────────────────────────────

• Lazy load worksheet
• Optimize drag interactions
• Avoid re-render heavy components

────────────────────────────────
12. GENERATION RULES
────────────────────────────────

• Reuse existing UI styles from app
• Do not break existing navigation
• Make component modular
• Ensure responsive across devices

────────────────────────────────
13. COMPLETION CRITERIA
────────────────────────────────

✅ Worksheet loads inside frame  
✅ Thumbnails selectable  
✅ Buttons draggable and snap into slots  
✅ Flip functionality works  
✅ Teacher tab integrated  
✅ UI matches reference image  
✅ Smooth interaction (no lag)  

────────────────────────────────
FINAL GOAL
────────────────────────────────

Build an engaging, tactile learning interface where:

“Students interact with logic problems by physically placing answers,
making learning intuitive, visual, and fun.”