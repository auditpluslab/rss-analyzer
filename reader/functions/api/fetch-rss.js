import { rescoreWithProfile, PROFILE } from './_profile.js';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const page = parseInt(url.searchParams.get("page")) || 1;
  const refresh = url.searchParams.get("refresh") === "true";
  const search = url.searchParams.get("search") || "";
  const limit = 50;
  const offset = (page - 1) * limit;

  // 1. 取得するRSSの定義
  const rssFeeds = [
    // --- 海外・ビジネス ---
    { name: "AccT", url: "https://www.accountingtoday.com/feed?rss=true" },
    { name: "Caixin", url: "https://gateway.caixin.com/api/data/global/feedlyRss.xml" },
    { name: "McKinsey", url: "https://www.mckinsey.com/Insights/rss.aspx" },
    { name: "RT", url: "https://www.rt.com/rss-feed/" },
    { name: "TechC", url: "https://techcrunch.com/feed/" },
    { name: "FT", url: "https://www.ft.com/rss/home" },

    // --- 国内メディア ---
    { name: "ラジオ日経", url: "https://www.radionikkei.jp/podcast/cn_shinsou/rss.xml" },
    { name: "日経X", url: "https://tech.nikkeibp.co.jp/rss/index.rdf" },
    { name: "日経ビジネス", url: "https://business.nikkei.com/rss/all_nb.rdf" },
    { name: "日経Biz", url: "https://assets.wor.jp/rss/rdf/nikkei/business.rdf" },
    { name: "日経国際", url: "https://assets.wor.jp/rss/rdf/nikkei/international.rdf" },
    { name: "日経Tech", url: "https://assets.wor.jp/rss/rdf/nikkei/technology.rdf" },
    { name: "日経市場", url: "https://assets.wor.jp/rss/rdf/nikkei/markets.rdf" },
    { name: "日経地域", url: "https://assets.wor.jp/rss/rdf/nikkei/local.rdf" },
    { name: "日経速報", url: "https://assets.wor.jp/rss/rdf/nikkei/news.rdf" },
    { name: "日経スポ", url: "https://assets.wor.jp/rss/rdf/nikkei/sports.rdf" },
    { name: "日経経済", url: "https://assets.wor.jp/rss/rdf/nikkei/economy.rdf" },
    { name: "東洋経済", url: "https://toyokeizai.net/list/feed/rss" },

    // --- 日経（Google News RSS経由）---
    { name: "日経政治", url: "https://news.google.com/rss/search?q=site:nikkei.com+%E6%94%BF%E6%B2%BB&hl=ja&gl=JP&ceid=JP:ja" },
    { name: "日経文化", url: "https://news.google.com/rss/search?q=site:nikkei.com+%E6%96%87%E5%8C%96&hl=ja&gl=JP&ceid=JP:ja" },
    { name: "日経生活", url: "https://news.google.com/rss/search?q=site:nikkei.com+%E7%94%9F%E6%B4%BB&hl=ja&gl=JP&ceid=JP:ja" },
    { name: "日経社説", url: "https://news.google.com/rss/search?q=site:nikkei.com+%E7%A4%BE%E8%AA%AC&hl=ja&gl=JP&ceid=JP:ja" },
    { name: "日経科学", url: "https://news.google.com/rss/search?q=site:nikkei.com+%E7%A7%91%E5%AD%A6&hl=ja&gl=JP&ceid=JP:ja" },
    { name: "日経医療", url: "https://news.google.com/rss/search?q=site:nikkei.com+%E5%8C%BB%E7%99%82&hl=ja&gl=JP&ceid=JP:ja" },
    { name: "日経教育", url: "https://news.google.com/rss/search?q=site:nikkei.com+%E6%95%99%E8%82%B2&hl=ja&gl=JP&ceid=JP:ja" },
    { name: "Nikkei Asia", url: "https://news.google.com/rss/search?q=site:asia.nikkei.com+when:7d&hl=en-US&gl=US&ceid=US:en" },

    // --- 公的機関・研究所 ---
    { name: "JETRO", url: "https://www.jetro.go.jp/rss/biznews.xml" },
    { name: "ニッセイ", url: "https://www.nli-research.co.jp/RSS.rdf?site=nli" },
    { name: "日本総研", url: "https://www.jri.co.jp/xml.jsp?id=12966" },
    { name: "内閣府", url: "https://www.cao.go.jp/rss/news.rdf" },
    { name: "厚労省", url: "https://www.mhlw.go.jp/stf/news.rdf" },
    { name: "日銀", url: "https://www.boj.or.jp/rss/whatsnew.xml" },
    { name: "経産省", url: "https://www.meti.go.jp/ml_index_release_atom.xml" },
    { name: "金融庁", url: "https://www.fsa.go.jp/fsaNewsListAll_rss2.xml" },

    // --- KKJ (企業会計関連) ---
    { name: "KKJ", url: "https://www.kkj.go.jp/r/?VT0wLWFsbCZ0aT0lRTMlODIlQUMlRTMlODMlOTAlRTMlODMlOEElRTMlODMlQjMlRTMlODIlQjkmcmM9NTAmWD0lRTYlQTQlOUMlRTMlODAlODAlRTclQjQlQTImYnI9eCZSPTFyZzJ5bF82bDYK" },
    { name: "KKJ", url: "https://www.kkj.go.jp/r/?VT0wLWFsbCZ0aT0lRTMlODMlODclRTMlODIlQjglRTMlODIlQkYlRTMlODMlQUIlRTUlOEMlOTYmcmM9NTAmWD0lRTYlQTQlOUMlRTMlODAlODAlRTclQjQlQTImYnI9eCZSPTFyZzMyUl8zSk8K" },
    { name: "KKJ", url: "https://www.kkj.go.jp/r/?VT0wLWFsbCZ0aT0lRTMlODMlQUElRTMlODIlQjklRTMlODIlQUYmcmM9NTAmWD0lRTYlQTQlOUMlRTMlODAlODAlRTclQjQlQTImYnI9eCZSPTFyZzJ6Vl84MVkK" },
    { name: "KKJ", url: "https://www.kkj.go.jp/r/?VT0wLWFsbCZ0aT0lRTQlQkMlOUElRTglQTglODglRTMlODIlQjclRTMlODIlQjklRTMlODMlODYlRTMlODMlQTAmcmM9NTAmWD0lRTYlQTQlOUMlRTMlODAlODAlRTclQjQlQTImYnI9eCZSPTFyZzJ4VV80b3AK" },
    { name: "KKJ", url: "https://www.kkj.go.jp/r/?VT0wLWFsbCZ0aT0lRTclOUIlQTMlRTYlOUYlQkImcmM9NTAmWD0lRTYlQTQlOUMlRTMlODAlODAlRTclQjQlQTImYnI9eCZSPTFyZzJ1VF8xNm0K" }
  ];

  // 2. 許可されたソース名リスト（rssFeeds から自動生成）
  const allowedSources = [...new Set(rssFeeds.map(f => f.name))];

  // 3. タイトルベース重複排除用: 日経系ソース名
  const NIKKEI_SOURCES = [
    '日経Biz', '日経国際', '日経Tech', '日経市場', '日経地域',
    '日経速報', '日経スポ', '日経経済', '日経ビジネス', '日経X',
    '日経政治', '日経文化', '日経生活', '日経社説',
    '日経科学', '日経医療', '日経教育', 'Nikkei Asia'
  ];

  const db = context.env.DB;
  const ai = context.env.AI;
  const analyzer = context.env.ANALYZER;

  try {
    if (page === 1 && refresh) {
      // URLベースの重複チェック（DBのON CONFLICT(url)と整合）
      const existingUrlsResult = await db.prepare("SELECT url FROM articles").all();
      const existingUrls = new Set(existingUrlsResult.results.map(r => r.url));

      // タイトルベース重複排除: 日経系過去14日分のタイトルキーを構築
      const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const nikkeiPlaceholders = NIKKEI_SOURCES.map(() => '?').join(',');
      const existingTitlesResult = await db.prepare(
        `SELECT title, source FROM articles WHERE published_at > ? AND source IN (${nikkeiPlaceholders})`
      ).bind(cutoff, ...NIKKEI_SOURCES).all();

      const existingKeys = new Set(existingUrls);
      existingTitlesResult.results.forEach(r => {
        const key = normalizeTitleKey(r.title);
        if (!key) return;
        const domain = r.source === 'Nikkei Asia' ? 'asia.nikkei.com' : 'www.nikkei.com';
        existingKeys.add(`gn::${domain}::${key}`);
      });

      // 全フィード並列取得（Google News側は10秒タイムアウト）
      const allResponses = await Promise.allSettled(
        rssFeeds.map(f => {
          const timeout = f.url.includes('news.google.com') ? 10000 : 15000;
          return fetchWithTimeout(f.url, timeout);
        })
      );

      let articlesToSave = [];

      rssFeeds.forEach((feed, idx) => {
        const result = allResponses[idx];
        if (result.status !== "fulfilled") return;

        const items = extractItems(result.value);
        const isGoogleNews = feed.url.includes('news.google.com');

        items.forEach(item => {
          if (!item.title || !item.link) return;
          const cleanedTitle = cleanTitle(item.title);

          if (isGoogleNews) {
            const nKey = normalizeTitleKey(cleanedTitle);
            if (nKey) {
              const fallback = feed.name === 'Nikkei Asia' ? 'asia.nikkei.com' : 'www.nikkei.com';
              const srcDomain = item.sourceUrl ? safeHostname(item.sourceUrl, fallback) : fallback;
              const dedupeKey = `gn::${srcDomain}::${nKey}`;
              if (existingKeys.has(dedupeKey)) return;
              articlesToSave.push({ ...item, source: feed.name, cleanedTitle });
              existingKeys.add(dedupeKey);
              existingKeys.add(item.link);
            } else {
              if (existingKeys.has(item.link)) return;
              articlesToSave.push({ ...item, source: feed.name, cleanedTitle });
              existingKeys.add(item.link);
            }
          } else {
            if (!existingKeys.has(item.link)) {
              articlesToSave.push({ ...item, source: feed.name, cleanedTitle });
              existingKeys.add(item.link);
            }
          }
        });
      });

      // AI分析と保存処理
      for (let i = 0; i < articlesToSave.length; i += 5) {
        const chunk = articlesToSave.slice(i, i + 5);
        const texts = chunk.map(a => `Title: ${a.title} \nSummary: ${a.description}`);
        let embeddings = [];
        try {
          const { data } = await ai.run('@cf/baai/bge-m3', { text: texts });
          embeddings = data;
        } catch (e) {
          embeddings = chunk.map(() => []);
        }

        const analysisPromises = chunk.map(item => {
          if (!analyzer) return Promise.resolve(null);
          return analyzer.fetch("http://internal/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: item.title })
          }).then(res => res.ok ? res.json() : null).catch(() => null);
        });

        const analysisResults = await Promise.all(analysisPromises);

        // 翻訳処理（日本語が含まれない場合のみ翻訳）
        const translationPromises = chunk.map(item => {
          if (!analyzer || containsJapanese(item.title)) {
            return Promise.resolve({ translated: false, title_ja: item.title });
          }
          return analyzer.fetch("http://internal/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: item.title })
          }).then(res => res.ok ? res.json() : { translated: false, title_ja: item.title })
            .catch(() => ({ translated: false, title_ja: item.title }));
        });

        const translationResults = await Promise.all(translationPromises);

        // ※INSERT文には is_read は含めない（デフォルト0なので）
        const stmt = db.prepare(`
          INSERT INTO articles (url, title, title_ja, source, published_at, description, category, embedding, sentiment, score, tags, is_saved)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, IFNULL((SELECT is_saved FROM articles WHERE url = ?), 0))
          ON CONFLICT(url) DO UPDATE SET
            title=excluded.title,
            title_ja=excluded.title_ja,
            source=excluded.source,
            description=excluded.description,
            embedding=excluded.embedding,
            sentiment=excluded.sentiment,
            score=excluded.score,
            tags=excluded.tags
        `);

        const batch = chunk.map((item, idx) => {
          const embedding = JSON.stringify(embeddings[idx] || []);
          const analysis = analysisResults[idx] || {};
          const translation = translationResults[idx] || { title_ja: item.title };
          const sentiment = analysis.sentiment || "NEUTRAL";
          const rawScore = analysis.score || 0;
          const score = rescoreWithProfile(item.cleanedTitle, rawScore, PROFILE);
          const tags = (analysis.all_tags && Array.isArray(analysis.all_tags)) ? analysis.all_tags.join(",") : "";

          return stmt.bind(
            item.link, item.cleanedTitle, translation.title_ja, item.source, item.date, item.description, item.category,
            embedding, sentiment, score, tags, item.link
          );
        });

        if (batch.length > 0) await db.batch(batch);
      }

      // ガベージコレクション：許可されたソース以外の記事を削除
      const gcPlaceholders = allowedSources.map(() => "?").join(",");
      await db.prepare(`DELETE FROM articles WHERE source NOT IN (${gcPlaceholders})`)
        .bind(...allowedSources).run();
    }

    // 表示用データの抽出（ソース名ベースでフィルタリング）
    const sourcePlaceholders = allowedSources.map(() => "?").join(",");
    let query = `
      SELECT url, title, title_ja, source, published_at, description, category, is_saved, is_read, sentiment, score, tags
      FROM articles
      WHERE source IN (${sourcePlaceholders})
    `;
    let params = [...allowedSources];

    // 検索パラメータがある場合、LIKE検索条件を追加
    if (search.trim()) {
      query += ` AND (title LIKE ? OR title_ja LIKE ? OR description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY published_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const { results } = await db.prepare(query).bind(...params).all();

    return new Response(JSON.stringify({ articles: results, search: search.trim() || null }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

// === 以下、共通関数 (Date Parser 最強版) ===
function extractItems(xml) {
  const items = [];
  const regex = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const c = match[2];

    const tMatch = c.match(/<title[^>]*>([^<]+|<!\[CDATA\[([\s\S]*?)\]\]>)<\/title>/);
    const title = tMatch ? (tMatch[2] || tMatch[1]) : "No Title";

    let link = "";
    const lMatch = c.match(/<link[^>]*href=["']([^"']+)["']/) || c.match(/<link>([^<]+)<\/link>/);
    if (lMatch) link = lMatch[1];

    // --- Date Parsing (最強版) ---
    let dateStr = "";
    const tagPatterns = [
      /<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i,
      /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i,
      /<updated[^>]*>([\s\S]*?)<\/updated>/i,
      /<published[^>]*>([\s\S]*?)<\/published>/i
    ];
    for (const pattern of tagPatterns) {
      const m = c.match(pattern);
      if (m) { dateStr = m[1]; break; }
    }
    if (dateStr) dateStr = dateStr.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1').trim();

    if (!dateStr || dateStr.match(/(\d{4})年/)) {
      const jpMatch = (dateStr || c).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      if (jpMatch) {
        dateStr = `${jpMatch[1]}/${jpMatch[2]}/${jpMatch[3]}`;
      } else {
        const isoMatch = (dateStr || c).match(/(\d{4}-\d{2}-\d{2})/);
        if (isoMatch) dateStr = isoMatch[1];
      }
    }

    // 正規表現フォールバック: XML文字列全体からYYYY-MM-DD形式を抽出
    if (!dateStr || isNaN(new Date(dateStr).getTime())) {
      const regexFallback = c.match(/(\d{4}-\d{2}-\d{2})T?(\d{2}:\d{2}:\d{2})?/);
      if (regexFallback) {
        dateStr = regexFallback[2] ? `${regexFallback[1]}T${regexFallback[2]}` : regexFallback[1];
      }
    }

    let dateObj = new Date(dateStr);
    if (!dateStr || isNaN(dateObj.getTime())) dateObj = new Date();

    let description = "";
    const descMatch = c.match(/<(description|summary|content:encoded)[^>]*>([\s\S]*?)<\/\1>/);
    if (descMatch) description = descMatch[2].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1');
    description = description ? description.replace(/<[^>]*>?/gm, '').substring(0, 500).trim() : "";

    const sourceUrl = (c.match(/<source[^>]*url=["']([^"']+)["'][^>]*>/i) || [])[1] || null;

    items.push({ title, link, date: dateObj.toISOString(), description, category: "", sourceUrl });
  }
  return items;
}

async function fetchWithTimeout(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: controller.signal });
    clearTimeout(id); return await res.text();
  } catch (e) { clearTimeout(id); throw e; }
}

function cleanTitle(t) {
  if (!t) return "";
  return t
    .replace("<![CDATA[", "").replace("]]>", "")
    .replace(/\s*[-–—|]\s*(日本経済新聞|日経ビジネス|Nikkei Asia|Nikkei|Financial Times|FT|ロイター|Reuters|ブルームバーグ|Bloomberg|共同通信|時事通信).*$/i, "")
    .trim();
}

function containsJapanese(text) {
  return /[぀-ゟ゠-ヿ一-龯]/.test(text);
}

function normalizeTitleKey(title) {
  if (!title) return "";
  const key = title
    .replace(/\s*[-|｜–—]\s*(日本経済新聞|日経ビジネス|日経|Nikkei Asia|Nikkei|Financial Times|FT|ロイター|Reuters|ブルームバーグ|Bloomberg|共同通信|時事通信).*$/i, "")
    .replace(/\s+/g, "")
    .toLowerCase();
  return key.length >= 3 ? key : "";
}

function safeHostname(urlStr, fallback) {
  try { return new URL(urlStr).hostname; } catch { return fallback; }
}
