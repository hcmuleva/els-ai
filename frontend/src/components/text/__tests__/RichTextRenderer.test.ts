jest.mock('lucide-react-native', () => ({}));
jest.mock('react-native-render-html', () => () => null);
jest.mock('react-native-webview', () => ({ WebView: () => null }));

import { detectTextFormat, isInteractiveHtml, isPureHtml, markdownToHtml, sanitizeHtmlForRender } from '../RichTextRenderer';
import { extractMermaidCode, hasMermaidBlocks, isMermaid } from '../../media/MermaidViewer';

describe('RichTextRenderer - detectTextFormat', () => {
  it('detects HTML formatting correctly', () => {
    expect(detectTextFormat('<h2>What is Photosynthesis?</h2>')).toBe('html');
    expect(detectTextFormat('<p>Plants absorb <strong>sunlight</strong> to make food.</p>')).toBe('html');
    expect(detectTextFormat('<div><span>Important Concept</span></div>')).toBe('html');
    expect(detectTextFormat('<ul><li>Item 1</li><li>Item 2</li></ul>')).toBe('html');
    expect(detectTextFormat('First line<br/>Second line')).toBe('html');
    expect(detectTextFormat('<!DOCTYPE html><html><body><h1>Doc</h1></body></html>')).toBe('html');
  });

  it('detects Markdown formatting correctly', () => {
    expect(detectTextFormat('# Chapter 1: The Solar System')).toBe('markdown');
    expect(detectTextFormat('### Subheading\nHere is some content.')).toBe('markdown');
    expect(detectTextFormat('This is **bold** text and *italic* text.')).toBe('markdown');
    expect(detectTextFormat('- Point A\n- Point B\n- Point C')).toBe('markdown');
    expect(detectTextFormat('Check this [Resource Link](https://example.com)')).toBe('markdown');
    expect(detectTextFormat('```python\nprint("hello")\n```')).toBe('markdown');
  });

  it('identifies standard plain text', () => {
    expect(detectTextFormat('The quick brown fox jumps over the lazy dog.')).toBe('plain');
    expect(detectTextFormat('Welcome to class. Today we will study gravity.')).toBe('plain');
    expect(detectTextFormat('')).toBe('plain');
  });
});

describe('RichTextRenderer - isPureHtml & sanitizeHtmlForRender', () => {
  it('identifies pure HTML documents and snippets correctly', () => {
    expect(isPureHtml('<!DOCTYPE html><html><body><p>Hello</p></body></html>')).toBe(true);
    expect(isPureHtml('<html><head><title>Test</title></head><body>Content</body></html>')).toBe(true);
    expect(isPureHtml('<div class="container"><p>Paragraph 1</p></div>')).toBe(true);
    expect(isPureHtml('# Heading\n<p>Mixed</p>')).toBe(false);
  });

  it('sanitizes full HTML documents by extracting body and stripping scripts and styles', () => {
    const rawHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Article Title</title>
        <style>
          body { font-family: Arial; }
          .highlight { color: red; }
        </style>
        <script>console.log("malicious");</script>
      </head>
      <body>
        <article>
          <h1>Lesson 1</h1>
          <p>Introduction to the cell structure.</p>
        </article>
      </body>
      </html>
    `;
    const cleaned = sanitizeHtmlForRender(rawHtml);
    expect(cleaned).toContain('<h1>Lesson 1</h1>');
    expect(cleaned).toContain('<p>Introduction to the cell structure.</p>');
    expect(cleaned).not.toContain('<!DOCTYPE');
    expect(cleaned).not.toContain('<style>');
    expect(cleaned).not.toContain('body { font-family: Arial; }');
    expect(cleaned).not.toContain('<script>');
    expect(cleaned).not.toContain('console.log');
  });

  it('detects interactive HTML documents with scripts or style stylesheets', () => {
    const htmlWithScript = `
      <!DOCTYPE html>
      <html>
      <head><title>App</title></head>
      <body>
        <div id="cards"></div>
        <script>
          const commands = ['/visualization'];
          document.getElementById('cards').innerHTML = 'rendered';
        </script>
      </body>
      </html>
    `;
    expect(isInteractiveHtml(htmlWithScript)).toBe(true);
    expect(isInteractiveHtml('<p>Simple static text</p>')).toBe(false);
    expect(isInteractiveHtml('# Heading\n- item')).toBe(false);
  });
});

describe('RichTextRenderer - markdownToHtml', () => {
  it('converts markdown headers and formatting to html', () => {
    const input = '# Heading 1\n## Heading 2\nThis is **bold** and *italic*.';
    const output = markdownToHtml(input);
    expect(output).toContain('<h1>Heading 1</h1>');
    expect(output).toContain('<h2>Heading 2</h2>');
    expect(output).toContain('<strong>bold</strong>');
    expect(output).toContain('<em>italic</em>');
  });

  it('preserves existing embedded HTML while converting markdown', () => {
    const input = '# Title\n<div style="background-color: blue;"><p>Alert</p></div>';
    const output = markdownToHtml(input);
    expect(output).toContain('<h1>Title</h1>');
    expect(output).toContain('<div style="background-color: blue;">');
    expect(output).toContain('<p>Alert</p>');
  });

  it('converts lists and blockquotes correctly', () => {
    const input = '- Item A\n- Item B\n> Important quote';
    const output = markdownToHtml(input);
    expect(output).toContain('<ul>');
    expect(output).toContain('<li>Item A</li>');
    expect(output).toContain('<li>Item B</li>');
    expect(output).toContain('</ul>');
    expect(output).toContain('<blockquote>Important quote</blockquote>');
  });

  it('handles multi-line HTML tags cleanly without mangling them', () => {
    const input = '<div\n  class="card"\n  style="background: #fff;">\n  <h3>Header</h3>\n</div>';
    const output = markdownToHtml(input);
    expect(output).toContain('<div');
    expect(output).toContain('class="card"');
    expect(output).toContain('style="background: #fff;"');
    expect(output).toContain('<h3>Header</h3>');
    expect(output).toContain('</div>');
    expect(output).not.toContain('<p><div');
  });
});

describe('RichTextRenderer - Mermaid Diagram Support', () => {
  it('detects standalone Mermaid diagrams correctly', () => {
    expect(isMermaid('flowchart TD\n  A[Start] --> B[End]')).toBe(true);
    expect(isMermaid('graph LR\n  Step1 --> Step2')).toBe(true);
    expect(isMermaid('sequenceDiagram\n  Alice->>Bob: Hello')).toBe(true);
    expect(isMermaid('classDiagram\n  Animal <|-- Duck')).toBe(true);
    expect(isMermaid('pie title Pets\n  "Dogs" : 386\n  "Cats" : 85')).toBe(true);
    expect(isMermaid('```mermaid\nflowchart TD\n  A --> B\n```')).toBe(true);
    expect(isMermaid('This is just normal text.')).toBe(false);
  });

  it('detectTextFormat identifies Mermaid diagrams', () => {
    expect(detectTextFormat('flowchart TD\n  A[Sun] --> B[Plant]')).toBe('mermaid');
    expect(detectTextFormat('sequenceDiagram\n  Client->>Server: Request')).toBe('mermaid');
    expect(detectTextFormat('```mermaid\ngraph LR\n  X --> Y\n```')).toBe('mermaid');
  });

  it('detects embedded Mermaid blocks within Markdown documents', () => {
    const mixedDoc = `
      # Photosynthesis Process

      Here is how solar energy is converted into glucose:

      \`\`\`mermaid
      flowchart TD
        Light[Sunlight] --> Chlorophyll[Chloroplasts]
        Water[H2O] & CO2[Carbon Dioxide] --> Photosynthesis[Photosynthesis Reaction]
        Photosynthesis --> Glucose[Glucose C6H12O6] & Oxygen[O2 Released]
      \`\`\`

      Review this diagram for tomorrow's quiz.
    `;
    expect(hasMermaidBlocks(mixedDoc)).toBe(true);
    expect(hasMermaidBlocks('# Just a normal markdown document\n- Point 1\n- Point 2')).toBe(false);
  });

  it('extracts clean Mermaid syntax from code blocks', () => {
    const wrapped = '```mermaid\nflowchart TD\n  A --> B\n```';
    expect(extractMermaidCode(wrapped)).toBe('flowchart TD\n  A --> B');
  });
});
