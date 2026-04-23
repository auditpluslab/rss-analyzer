export async function onRequest(context) {
  const db = context.env.DB;

  // 【表示制限用】このリストに含まれるドメインのみを表示対象にする
  const allowedDomains = [
    "accountingtoday.com", "gateway.caixin.com", "mckinsey.com", 
    "radionikkei.jp", "rt.com", "techcrunch.com", "ft.com", 
    "jetro.go.jp", "nli-research.co.jp", "jri.co.jp", 
    "tech.nikkeibp.co.jp", "cao.go.jp", "mhlw.go.jp", 
    "kkj.go.jp", "boj.or.jp", "nikkei.com", "news.google.com",
    "toyokeizai.net", "meti.go.jp", "fsa.go.jp"
  ];

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

    // 3. 全「未読記事」かつ「厳選ドメイン」の記事のみを取得
    const domainConditions = allowedDomains.map(() => "url LIKE ?").join(" OR ");
    const { results: unreadArticles } = await db.prepare(`
      SELECT url, title, source, published_at, description, category, embedding, is_saved, score
      FROM articles 
      WHERE is_read = 0 
      AND embedding IS NOT NULL
      AND (${domainConditions})
      ORDER BY published_at DESC LIMIT 300
    `).bind(...allowedDomains.map(d => `%${d}%`)).all();

    // 4. ハイブリッドスコア（類似度70% + AIスコア30%）を計算してソート
    const scoredArticles = unreadArticles.map(article => {
      const vec = JSON.parse(article.embedding);
      if (!vec || vec.length === 0) return { ...article, finalScore: -1 };
      
      const similarity = cosineSimilarity(userVector, vec);
      const articleScore = article.score || 0; // DBに保存されているAIスコア(0-100)
      
      // ハイブリッドスコア: 類似度70% + 重要度30%
      const finalScore = (similarity * 0.7) + ((articleScore / 100) * 0.3);
      
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