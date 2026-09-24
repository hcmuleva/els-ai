import { detectLinkType, extractDomain, parseLink } from '../linkPreviewUtils';

describe('linkPreviewUtils', () => {
  describe('detectLinkType', () => {
    it('detects YouTube regular watch links', () => {
      expect(detectLinkType('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube');
    });

    it('detects YouTube youtu.be short links', () => {
      expect(detectLinkType('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube');
    });

    it('detects YouTube shorts links', () => {
      expect(detectLinkType('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube');
    });

    it('detects Vimeo links', () => {
      expect(detectLinkType('https://vimeo.com/123456789')).toBe('vimeo');
    });

    it('detects Loom links', () => {
      expect(detectLinkType('https://www.loom.com/share/abcdef123456')).toBe('loom');
    });

    it('detects Dailymotion links', () => {
      expect(detectLinkType('https://www.dailymotion.com/video/x8abcdef')).toBe('dailymotion');
      expect(detectLinkType('https://dai.ly/x8abcdef')).toBe('dailymotion');
    });

    it('detects direct video URLs', () => {
      expect(detectLinkType('https://example.com/media/lesson.mp4')).toBe('direct_video');
      expect(detectLinkType('https://cdn.school.org/video.webm?token=123')).toBe('direct_video');
      expect(detectLinkType('https://s3.amazonaws.com/bucket/sample.mov')).toBe('direct_video');
    });

    it('detects direct audio URLs', () => {
      expect(detectLinkType('https://example.com/audio/pronunciation.mp3')).toBe('direct_audio');
      expect(detectLinkType('https://cdn.school.org/story.wav')).toBe('direct_audio');
    });

    it('detects Instagram reel links', () => {
      expect(detectLinkType('https://www.instagram.com/reel/C1234567890/')).toBe('instagram');
    });

    it('falls back to generic for standard web links', () => {
      expect(detectLinkType('https://en.wikipedia.org/wiki/Solar_System')).toBe('generic');
      expect(detectLinkType('https://nationalgeographic.com/animals')).toBe('generic');
    });
  });

  describe('extractDomain', () => {
    it('extracts clean hostnames without www', () => {
      expect(extractDomain('https://www.youtube.com/watch?v=123')).toBe('youtube.com');
      expect(extractDomain('https://khanacademy.org/math')).toBe('khanacademy.org');
    });
  });

  describe('parseLink', () => {
    it('parses YouTube link correctly with embed URL and videoId', () => {
      const parsed = parseLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(parsed.type).toBe('youtube');
      expect(parsed.videoId).toBe('dQw4w9WgXcQ');
      expect(parsed.embedUrl).toContain('youtube.com/embed/dQw4w9WgXcQ');
      expect(parsed.label).toBe('YouTube Video');
    });

    it('parses Vimeo link correctly with embed URL', () => {
      const parsed = parseLink('https://vimeo.com/76979871');
      expect(parsed.type).toBe('vimeo');
      expect(parsed.embedUrl).toBe('https://player.vimeo.com/video/76979871');
      expect(parsed.label).toBe('Vimeo Video');
    });

    it('parses Loom link correctly with embed URL', () => {
      const parsed = parseLink('https://www.loom.com/share/9abc12345def');
      expect(parsed.type).toBe('loom');
      expect(parsed.embedUrl).toBe('https://www.loom.com/embed/9abc12345def');
    });

    it('parses generic link correctly with domain and label', () => {
      const parsed = parseLink('https://en.wikipedia.org/wiki/Earth');
      expect(parsed.type).toBe('generic');
      expect(parsed.domain).toBe('en.wikipedia.org');
      expect(parsed.label).toBe('en.wikipedia.org');
    });
  });
});
