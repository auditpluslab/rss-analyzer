DROP TABLE IF EXISTS articles;

CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  title TEXT,
  title_ja TEXT,
  url TEXT,
  source TEXT,
  summary TEXT,
  published_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id TEXT,
  clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES articles(id)
);

-- マイグレーション: 既存データベースにtitle_jaカラムを追加
ALTER TABLE articles ADD COLUMN title_ja TEXT;