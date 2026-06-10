-- RSS Reader PWA — D1 Database Schema
-- Updated: 2026-06-10 (aligned with actual runtime code)

DROP TABLE IF EXISTS articles;
DROP TABLE IF EXISTS clicks;

CREATE TABLE articles (
  url TEXT PRIMARY KEY,
  title TEXT,
  title_ja TEXT,
  source TEXT,
  description TEXT,
  category TEXT,
  published_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  embedding TEXT,       -- JSON array from @cf/baai/bge-m3
  sentiment TEXT,       -- POSITIVE | NEGATIVE | NEUTRAL
  score INTEGER,        -- 0-100 (rescored with profile)
  tags TEXT,            -- comma-separated AI tags
  is_saved INTEGER DEFAULT 0,
  is_read INTEGER DEFAULT 0
);

CREATE INDEX idx_articles_source ON articles(source);
CREATE INDEX idx_articles_published ON articles(published_at);
CREATE INDEX idx_articles_read ON articles(is_read);
CREATE INDEX idx_articles_score ON articles(score);

CREATE TABLE IF NOT EXISTS clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_url TEXT,
  clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clicks_url ON clicks(article_url);
CREATE INDEX idx_clicks_time ON clicks(clicked_at);
