import { keywordMatchScore, PROFILE } from './_profile.js';

export async function onRequest(context) {
  const db = context.env.DB;

  // 【表示制限用】このリストに含まれるドメインのみを表示対象にする
  const allowedDomains = [
    "accountingtoday.com", "gateway.caixin.com", "mckinsey.com",
    "radionikkei.jp", "rt.com", "techcrunch.com", "ft.com",
    "jetro.go.jp", "nli-research.co.jp", "jri.co.jp",
    "tech.nikkeibp.co.jp", "cao.go.jp", "mhlw.go.jp",
    "kkj.go.jp", "boj.or.jp", "nikkei.com",
    "toyokeizai.net", "meti.go.jp", "fsa.go.jp",
    "asia.nikkei.com"
  ];

  const gnSources = ["日経政治", "日経文化", "日経生活", "日経社説", "日経科学", "日経医療", "日経教育", "Nikkei Asia"];

  try {
    // 1. 保存記事（ウェイト5.0）と既読記事（ウェイト1.0）を取得
    const { results: userInteractions } = await db.prepare(`
      SELECT embedding, is_saved
      FROM articles
      WHERE embedding IS NOT NULL
        AND (is_saved = 1 OR is_read = 1)
      ORDER BY 
        CASE WHEN is_saved = 1 THEN 0 ELSE 1 END,
        published_at DESC
      LIMIT 50
    `).all();

    if (!userInteractions || userInteractions.length === 0) {
      return new Response(JSON.stringify({ articles: [] }));
    }

    // 2. 重み付き平均ベクトルを計算（保存=5倍、既読=1倍）
    let userVector = null;
    let totalWeight = 0;

    userInteractions.forEach(row => {
      const vec = JSON.parse(row.embedding);
      if (!vec || vec.length === 0) return;
      
      const weight = row.is_saved === 1 ? 5.0 : 1.0;
      
      if (!userVector) {
        userVector = vec.map(v => v * weight);
      } else {
        for (let i = 0; i < userVector.length; i++) {
          userVector[i] += vec[i] * weight;
        }
      }
      totalWeight += weight;
    });

    if (userVector && totalWeight > 0) {
      for (let i = 0; i < userVector.length; i++) {
        userVector[i] /= totalWeight;
      }
    }

    // 3. 行動シグナル: 直近5日間のソース別・タグ別インタラクション率を計算
    const signalCutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    const { results: sourceStats } = await db.prepare(`
      SELECT source,
        COUNT(*) as total,
        SUM(CASE WHEN is_read = 1 THEN 1 ELSE 0 END) as reads,
        SUM(CASE WHEN is_saved = 1 THEN 1 ELSE 0 END) as saves
      FROM articles
      WHERE published_at > ?
      GROUP BY source
    `).bind(signalCutoff).all();

    const sourceBoost = {};
    sourceStats.forEach(s => {
      if (s.total < 3) return;
      const interactionRate = (s.reads + s.saves * 3) / s.total;
      if (interactionRate >= 0.6) sourceBoost[s.source] = 0.15;
      else if (interactionRate <= 0.2) sourceBoost[s.source] = -0.15;
    });

    const { results: readTagRows } = await db.prepare(`
      SELECT tags FROM articles
      WHERE is_read = 1 AND published_at > ? AND tags != ''
    `).bind(signalCutoff).all();

    const { results: unreadTagRows } = await db.prepare(`
      SELECT tags FROM articles
      WHERE is_read = 0 AND published_at > ? AND tags != ''
    `).bind(signalCutoff).all();

    const tagReads = {};
    readTagRows.forEach(r => r.tags.split(',').forEach(t => {
      const tag = t.trim();
      if (tag) tagReads[tag] = (tagReads[tag] || 0) + 1;
    }));
    const tagUnread = {};
    unreadTagRows.forEach(r => r.tags.split(',').forEach(t => {
      const tag = t.trim();
      if (tag) tagUnread[tag] = (tagUnread[tag] || 0) + 1;
    }));

    const tagBoost = {};
    Object.keys({ ...tagReads, ...tagUnread }).forEach(tag => {
      const reads = tagReads[tag] || 0;
      const total = reads + (tagUnread[tag] || 0);
      if (total < 3) return;
      const rate = reads / total;
      if (rate >= 0.6) tagBoost[tag] = 0.1;
      else if (rate <= 0.2) tagBoost[tag] = -0.1;
    });

    // 4. 全「未読記事」かつ「厳選ドメイン or GN source名」の記事のみを取得
    const domainConditions = allowedDomains.map(() => "url LIKE ?").join(" OR ");
    const sourceConditions = gnSources.map(() => "source = ?").join(" OR ");
    const { results: unreadArticles } = await db.prepare(`
      SELECT url, title, source, published_at, description, category, embedding, is_saved, score, tags
      FROM articles
      WHERE is_read = 0
      AND embedding IS NOT NULL
      AND ((${domainConditions}) OR (${sourceConditions}))
      ORDER BY published_at DESC LIMIT 300
    `).bind(...allowedDomains.map(d => `%${d}%`), ...gnSources).all();

    // 5. 4シグナルスコア（行動ベクトル35% + キーワード35% + AI 15% + 行動シグナル15%）を計算
    const hasBehavioralData = userVector !== null;

    const scoredArticles = unreadArticles.map(article => {
      const vec = JSON.parse(article.embedding);
      if (!vec || vec.length === 0) return { ...article, finalScore: -1 };

      const articleScore = article.score || 0;
      const kwScore = keywordMatchScore(article.title, PROFILE);

      // 行動シグナル: ソース別ブースト + タグ別ブースト
      const behavioralAdj = (sourceBoost[article.source] || 0)
        + (article.tags ? article.tags.split(',').reduce((sum, t) => sum + (tagBoost[t.trim()] || 0), 0) : 0);
      const clampedAdj = Math.max(-0.3, Math.min(0.3, behavioralAdj));

      let finalScore;
      let similarity = 0;
      if (hasBehavioralData) {
        similarity = cosineSimilarity(userVector, vec);
        finalScore = (similarity * 0.35) + (kwScore * 0.35) + ((articleScore / 100) * 0.15) + clampedAdj;
      } else {
        finalScore = (kwScore * 0.7) + ((articleScore / 100) * 0.15) + clampedAdj;
      }

      return { ...article, finalScore, similarity };
    });

    scoredArticles.sort((a, b) => b.finalScore - a.finalScore);
    const topArticles = scoredArticles.slice(0, 30);

    return new Response(JSON.stringify({ articles: topArticles }));

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}