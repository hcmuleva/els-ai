jest.mock('lucide-react-native', () => ({
  Check: () => null,
  Copy: () => null,
}));

import { tokenizeInline, parseBlocks } from '../ChatMarkdown';

describe('ChatMarkdown parser', () => {
  const sampleLessonPlan = `Here's a lesson plan for 4th-grade science:

**Lesson Topic:** Plant Growth and Photosynthesis

**Grade Level:** 4th Grade

**Subject:** Science

**Time Needed:** 2 class periods (approximately 1 hour 30 minutes each)

**Objectives:**

* Students will understand the basic needs of plants.
* Students will learn about the process of photosynthesis.
* Students will be able to describe the role of sunlight, water, and air in plant growth.

**Materials:**

* Seeds (fast-growing plants like radish or bean sprouts)
* Soil
* Water
* Sunlight

**Lesson Plan:**

**Day 1: Introduction to Plant Growth and Photosynthesis**

1. **Introduction (10 minutes)**
\t* Introduce the topic of plant growth and photosynthesis.
\t* Ask students what they know about plants and how they grow.
2. **Direct Instruction (20 minutes)**
\t* Show diagrams of plant cells.
3. **Guided Practice (20 minutes)**
\t* Give each student a seed.

**Day 2: Exploring Photosynthesis**

1. **Review (10 minutes)**
\t* Review the basic needs of plants.
2. **Experiment (30 minutes)**
\t* Set up an experiment:
\t\t+ Place a small plant in a sunny spot.
\t\t+ Place another small plant in a dark spot.
3. **Closure (10 minutes)**
\t* Review the results.

**Assessment:**

* Observe student participation during the experiment.

**Extension:**

* Have students design and conduct their own experiment.

**Interdisciplinary Connections:**

* Math: Measure the growth of plants using units of measurement.

I hope this lesson plan helps! Let me know if you need any modifications or have any questions.`;

  it('tokenizes inline bold text accurately', () => {
    const tokens = tokenizeInline('**Lesson Topic:** Plant Growth and Photosynthesis');
    expect(tokens.length).toBe(2);
    expect(tokens[0]).toEqual({ text: 'Lesson Topic:', bold: true });
    expect(tokens[1]).toEqual({ text: ' Plant Growth and Photosynthesis' });
  });

  it('tokenizes inline bold inside ordered item', () => {
    const tokens = tokenizeInline('**Introduction (10 minutes)**');
    expect(tokens.length).toBe(1);
    expect(tokens[0]).toEqual({ text: 'Introduction (10 minutes)', bold: true });
  });

  it('parses key-value headers correctly', () => {
    const blocks = parseBlocks('**Lesson Topic:** Plant Growth and Photosynthesis');
    expect(blocks[0]).toEqual({
      type: 'key_value',
      key: 'Lesson Topic',
      value: 'Plant Growth and Photosynthesis',
    });
  });

  it('parses standalone section headers', () => {
    const blocks = parseBlocks('**Objectives:**');
    expect(blocks[0]).toEqual({
      type: 'section_header',
      text: 'Objectives',
      hasColon: true,
    });
  });

  it('parses day section headers', () => {
    const blocks = parseBlocks('**Day 1: Introduction to Plant Growth and Photosynthesis**');
    expect(blocks[0]).toEqual({
      type: 'section_header',
      text: 'Day 1: Introduction to Plant Growth and Photosynthesis',
      hasColon: false,
    });
  });

  it('parses unordered and nested list items with correct indentation', () => {
    const blocks = parseBlocks(`* Students will understand.
\t* Introduce the topic.
\t\t+ Place a small plant in a sunny spot.`);

    expect(blocks[0]).toEqual({
      type: 'unordered_item',
      indent: 0,
      marker: '*',
      text: 'Students will understand.',
    });

    expect(blocks[1]).toEqual({
      type: 'unordered_item',
      indent: 1,
      marker: '*',
      text: 'Introduce the topic.',
    });

    expect(blocks[2]).toEqual({
      type: 'unordered_item',
      indent: 2,
      marker: '+',
      text: 'Place a small plant in a sunny spot.',
    });
  });

  it('parses ordered list items', () => {
    const blocks = parseBlocks('1. **Introduction (10 minutes)**');
    expect(blocks[0]).toEqual({
      type: 'ordered_item',
      indent: 0,
      number: '1',
      text: '**Introduction (10 minutes)**',
    });
  });

  it('parses the entire lesson plan without error', () => {
    const blocks = parseBlocks(sampleLessonPlan);
    expect(blocks.length).toBeGreaterThan(20);
    const keyValues = blocks.filter((b) => b.type === 'key_value');
    expect(keyValues.length).toBe(4);
    const sectionHeaders = blocks.filter((b) => b.type === 'section_header');
    expect(sectionHeaders.length).toBe(8);
  });
});
