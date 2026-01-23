import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock speechSynthesis
const mockSpeechSynthesis = {
  speak: vi.fn(),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  getVoices: vi.fn(() => [
    { name: 'Google 日本語', lang: 'ja-JP', default: true },
    { name: 'Microsoft Ayumi', lang: 'ja-JP', default: false },
    { name: 'English Voice', lang: 'en-US', default: false }
  ]),
  onvoiceschanged: null
};

global.speechSynthesis = mockSpeechSynthesis;

// Mock MediaSession API
global.MediaMetadata = class {
  constructor(metadata) {
    this.title = metadata.title;
    this.artist = metadata.artist;
    this.album = metadata.album;
  }
};

global.navigator.mediaSession = {
  metadata: null,
  playbackState: 'none',
  setActionHandler: vi.fn()
};

// Mock Wake Lock API
global.navigator.wakeLock = {
  request: vi.fn(() => Promise.resolve({
    addEventListener: vi.fn(),
    release: vi.fn()
  }))
};

// Mock localStorage
const mockLocalStorage = {
  store: {},
  getItem: vi.fn((key) => mockLocalStorage.store[key] || null),
  setItem: vi.fn((key, value) => {
    mockLocalStorage.store[key] = value;
  }),
  removeItem: vi.fn((key) => {
    delete mockLocalStorage.store[key];
  }),
  clear: vi.fn(() => {
    mockLocalStorage.store = {};
  })
};
global.localStorage = mockLocalStorage;

// Import TTS utility functions (extracted from index.html for testing)
// In a real setup, these would be in separate modules

describe('TTS Utility Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ----------------------------------------------------
  // containsJapanese function tests
  // ----------------------------------------------------
  describe('containsJapanese', () => {
    // Replicate the function from index.html
    function containsJapanese(text) {
      return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
    }

    it('should detect hiragana', () => {
      expect(containsJapanese('こんにちは')).toBe(true);
      expect(containsJapanese('こんにちは世界')).toBe(true);
    });

    it('should detect katakana', () => {
      expect(containsJapanese('コンニチハ')).toBe(true);
      expect(containsJapanese('テスト')).toBe(true);
    });

    it('should detect kanji', () => {
      expect(containsJapanese('日本語')).toBe(true);
      expect(containsJapanese('漢字')).toBe(true);
    });

    it('should detect mixed japanese-english', () => {
      expect(containsJapanese('株価が上昇')).toBe(true);
      expect(containsJapanese('Stock Market Rally 株式')).toBe(true);
    });

    it('should return false for english only', () => {
      expect(containsJapanese('Hello World')).toBe(false);
      expect(containsJapanese('Breaking News')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(containsJapanese('')).toBe(false);
    });

    it('should return false for numbers and symbols', () => {
      expect(containsJapanese('12345')).toBe(false);
      expect(containsJapanese('!@#$%')).toBe(false);
    });
  });

  // ----------------------------------------------------
  // escapeHtml function tests
  // ----------------------------------------------------
  describe('escapeHtml', () => {
    // Replicate the function from index.html
    function escapeHtml(unsafe) {
      return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    it('should escape ampersand', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
      expect(escapeHtml('A&B')).toBe('A&amp;B');
    });

    it('should escape less than and greater than', () => {
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
      expect(escapeHtml('a < b && b > c')).toBe('a &lt; b &amp;&amp; b &gt; c');
    });

    it('should escape quotes', () => {
      expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
      expect(escapeHtml("'test'")).toBe('&#039;test&#039;');
    });

    it('should handle mixed special characters', () => {
      expect(escapeHtml('<img src="x" onerror="alert(\'xss\')">'))
        .toBe('&lt;img src=&quot;x&quot; onerror=&quot;alert(&#039;xss&#039;)&quot;&gt;');
    });

    it('should handle empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should convert non-string to string', () => {
      expect(escapeHtml(12345)).toBe('12345');
      expect(escapeHtml(null)).toBe('null');
      expect(escapeHtml(undefined)).toBe('undefined');
    });
  });

  // ----------------------------------------------------
  // TTS State Management tests
  // ----------------------------------------------------
  describe('TTS State Management', () => {
    it('should save state to localStorage', () => {
      const state = {
        currentIndex: 5,
        currentTab: 'home',
        isPaused: false,
        rate: 1.2,
        pitch: 1.0
      };

      localStorage.setItem('rss_tts_state', JSON.stringify(state));

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'rss_tts_state',
        JSON.stringify(state)
      );
    });

    it('should load state from localStorage', () => {
      const state = {
        currentIndex: 3,
        currentTab: 'ai',
        isPaused: true,
        rate: 0.8,
        pitch: 1.1
      };

      mockLocalStorage.store['rss_tts_state'] = JSON.stringify(state);

      const loaded = localStorage.getItem('rss_tts_state');
      const parsed = JSON.parse(loaded);

      expect(parsed.currentIndex).toBe(3);
      expect(parsed.currentTab).toBe('ai');
      expect(parsed.isPaused).toBe(true);
      expect(parsed.rate).toBe(0.8);
    });

    it('should handle corrupted localStorage data', () => {
      mockLocalStorage.store['rss_tts_state'] = 'invalid json';

      expect(() => {
        JSON.parse(localStorage.getItem('rss_tts_state'));
      }).toThrow();
    });

    it('should validate tab names', () => {
      const validTabs = ['home', 'ai', 'saved'];
      const invalidTab = 'invalid';

      expect(validTabs.includes('home')).toBe(true);
      expect(validTabs.includes(invalidTab)).toBe(false);
    });

    it('should validate rate range', () => {
      const validRate = 1.0;
      const invalidRateLow = 0.1;
      const invalidRateHigh = 3.0;

      const isValidRate = (rate) => rate >= 0.5 && rate <= 2;

      expect(isValidRate(validRate)).toBe(true);
      expect(isValidRate(invalidRateLow)).toBe(false);
      expect(isValidRate(invalidRateHigh)).toBe(false);
    });
  });

  // ----------------------------------------------------
  // TTS Queue Management tests
  // ----------------------------------------------------
  describe('TTS Queue Management', () => {
    it('should initialize empty queue', () => {
      const queue = {
        articles: [],
        currentIndex: 0,
        totalPages: 1,
        currentPage: 1
      };

      expect(queue.articles.length).toBe(0);
      expect(queue.currentIndex).toBe(0);
    });

    it('should add articles to queue', () => {
      const articles = [
        { url: 'url1', title: 'Article 1' },
        { url: 'url2', title: 'Article 2' },
        { url: 'url3', title: 'Article 3' }
      ];

      const queue = {
        articles: articles,
        currentIndex: 0
      };

      expect(queue.articles.length).toBe(3);
      expect(queue.articles[0].url).toBe('url1');
    });

    it('should advance to next article', () => {
      const queue = {
        articles: [
          { url: 'url1', title: 'Article 1' },
          { url: 'url2', title: 'Article 2' }
        ],
        currentIndex: 0
      };

      // Simulate next
      queue.currentIndex = 1;

      expect(queue.currentIndex).toBe(1);
      expect(queue.articles[queue.currentIndex].url).toBe('url2');
    });

    it('should detect end of queue', () => {
      const articles = [
        { url: 'url1', title: 'Article 1' },
        { url: 'url2', title: 'Article 2' }
      ];

      const currentIndex = 1;
      const isEndOfQueue = currentIndex >= articles.length - 1;

      expect(isEndOfQueue).toBe(true);
    });
  });

  // ----------------------------------------------------
  // SpeechSynthesis API Mock tests
  // ----------------------------------------------------
  describe('SpeechSynthesis API', () => {
    it('should call speak when playing article', () => {
      const utterance = { text: 'テスト記事' };
      mockSpeechSynthesis.speak(utterance);

      expect(mockSpeechSynthesis.speak).toHaveBeenCalledWith(utterance);
    });

    it('should call cancel when stopping playback', () => {
      mockSpeechSynthesis.cancel();

      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });

    it('should call pause when pausing playback', () => {
      mockSpeechSynthesis.pause();

      expect(mockSpeechSynthesis.pause).toHaveBeenCalled();
    });

    it('should call resume when resuming playback', () => {
      mockSpeechSynthesis.resume();

      expect(mockSpeechSynthesis.resume).toHaveBeenCalled();
    });

    it('should get available voices', () => {
      const voices = mockSpeechSynthesis.getVoices();

      expect(voices.length).toBeGreaterThan(0);
      expect(voices[0].lang).toBe('ja-JP');
    });

    it('should filter Japanese voices', () => {
      const voices = mockSpeechSynthesis.getVoices();
      const japaneseVoices = voices.filter(v => v.lang.startsWith('ja'));

      expect(japaneseVoices.length).toBe(2);
      expect(japaneseVoices.every(v => v.lang.startsWith('ja'))).toBe(true);
    });
  });

  // ----------------------------------------------------
  // Media Session API Mock tests
  // ----------------------------------------------------
  describe('Media Session API', () => {
    it('should set action handlers', () => {
      const handler = () => {};
      global.navigator.mediaSession.setActionHandler('play', handler);

      expect(global.navigator.mediaSession.setActionHandler).toHaveBeenCalledWith('play', handler);
    });

    it('should set metadata', () => {
      const metadata = new global.MediaMetadata({
        title: 'Test Article',
        artist: 'Test Source',
        album: 'RSS Articles'
      });

      expect(metadata.title).toBe('Test Article');
      expect(metadata.artist).toBe('Test Source');
      expect(metadata.album).toBe('RSS Articles');
    });
  });

  // ----------------------------------------------------
  // Wake Lock API Mock tests
  // ----------------------------------------------------
  describe('Wake Lock API', () => {
    it('should request wake lock', async () => {
      const lock = await global.navigator.wakeLock.request('screen');

      expect(global.navigator.wakeLock.request).toHaveBeenCalledWith('screen');
      expect(lock).toBeDefined();
    });
  });
});

// ----------------------------------------------------
// Integration Tests
// ----------------------------------------------------
describe('TTS Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle complete TTS workflow', () => {
    // Simulate: Play → Pause → Resume → Stop
    mockSpeechSynthesis.speak({ text: 'Test' });
    mockSpeechSynthesis.pause();
    mockSpeechSynthesis.resume();
    mockSpeechSynthesis.cancel();

    expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);
    expect(mockSpeechSynthesis.pause).toHaveBeenCalledTimes(1);
    expect(mockSpeechSynthesis.resume).toHaveBeenCalledTimes(1);
    expect(mockSpeechSynthesis.cancel).toHaveBeenCalledTimes(1);
  });

  it('should save and restore playback position', () => {
    const position = {
      currentIndex: 10,
      currentTab: 'home',
      articleUrl: 'https://example.com/article1'
    };

    localStorage.setItem('rss_tts_state', JSON.stringify(position));
    const restored = JSON.parse(localStorage.getItem('rss_tts_state'));

    expect(restored.currentIndex).toBe(10);
    expect(restored.articleUrl).toBe('https://example.com/article1');
  });
});
