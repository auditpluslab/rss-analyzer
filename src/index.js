import { Ai } from '@cloudflare/ai';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ai = new Ai(env.AI);

    // 初回設定用
    if (url.pathname === '/setup-tags') {
      return await setupTags(env, ai);
    }

    // 分析用
    if (url.pathname === '/analyze' && request.method === 'POST') {
      return await analyzeArticle(request, env, ai);
    }

    // 翻訳用
    if (url.pathname === '/translate' && request.method === 'POST') {
      return await translateTitle(request, env, ai);
    }

    return new Response('Usage: POST /analyze with JSON { "title": "..." }', { status: 404 });
  }
};

// ==================================================
// 1. 分析ロジック (変更なし)
// ==================================================
async function analyzeArticle(request, env, ai) {
  try {
    const { title } = await request.json();
    if (!title) return new Response('No title provided', { status: 400 });

    // --- A. タグ付け (Embedding) ---
    const embeddings = await ai.run('@cf/baai/bge-m3', { text: title });
    const vector = embeddings.data[0];

    const tagMatches = await env.TAG_INDEX.query(vector, { topK: 3, returnMetadata: true });
    const fixedTags = tagMatches.matches
      .filter(m => m.score > 0.45)
      .map(m => m.metadata.tag);

    // --- B. 分析 (Gemini) ---
    let analysisResult = await runGeminiAnalysis(env.GEMINI_API_KEY, title);

    const safeResult = analysisResult || { sentiment: "NEUTRAL", score: 50, keyword: "None" };

    const finalResponse = {
      sentiment: safeResult.sentiment,
      score: safeResult.score,
      fixed_tags: fixedTags,
      all_tags: Array.from(new Set([...fixedTags, safeResult.keyword])).filter(t => t !== "None")
    };

    return new Response(JSON.stringify(finalResponse), {
      headers: { 'content-type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

async function runGeminiAnalysis(apiKey, title) {
  const prompt = `Analyze the news title for a CPA and Consulting Partner focused on cross-border business (Japan-China-APAC).
Key interests (weighted): Enterprise DX & financial governance (1.5x), AI/LLM/Agents & serverless architecture (1.5x), Social systems & ecosystem building (1.2x).
Prioritize: enterprise/B2B perspectives, technology-business strategy intersections, APAC market dynamics, CFO/CIO decision-making.
Deprioritize: B2C campaigns, consumer gadgets, crypto price speculation.
News Title: "${title}"
Task:
1. Sentiment: POSITIVE, NEGATIVE, or NEUTRAL.
2. Score: 0-100 (Importance to this professional profile. Most general news should score 20-40. Only highly relevant articles should score 60+).
3. Keyword: Extract ONE most specific and important keyword from the title.
Output JSON ONLY: {"sentiment": "...", "score": 0, "keyword": "..."}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                sentiment: { type: 'STRING', enum: ['POSITIVE', 'NEGATIVE', 'NEUTRAL'] },
                score: { type: 'INTEGER' },
                keyword: { type: 'STRING' }
              },
              required: ['sentiment', 'score', 'keyword']
            }
          }
        })
      }
    );

    if (!res.ok) {
      console.error('Gemini analysis API error:', res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (e) {
    console.error('Gemini analysis failed:', e);
    return null;
  }
}

// ==================================================
// 2. タグ登録ロジック (★ここを修正: バッチ処理化)
// ==================================================
async function setupTags(env, ai) {
  const tagList = [
    // ▼ テクノロジー
    "半導体", "生成AI", "SaaS", "クラウド", "サイバーセキュリティ",
    "データセンター", "ブロックチェーン", "暗号資産", "宇宙ビジネス",
    "量子コンピュータ", "ロボティクス", "スタートアップ",
    // ▼ 製造・モビリティ
    "自動車", "EV", "電池", "自動運転", "機械", "素材", "化学",
    "鉄鋼", "航空宇宙", "防衛産業", "物流", "ドローン",
    // ▼ 金融・経済
    "マクロ経済", "金利", "為替", "インフレ", "中央銀行", "決算",
    "M&A", "IPO", "FinTech", "銀行", "保険", "証券", "投資ファンド",
    // ▼ 生活・ヘルスケア
    "ヘルスケア", "医薬品", "バイオ", "医療機器", "小売", "EC",
    "食品", "不動産", "建設", "インバウンド", "観光", "エンタメ", "ゲーム",
    // ▼ エネルギー・環境
    "エネルギー", "原油", "脱炭素", "再生可能エネルギー", "ESG",
    "電力", "資源", "農業",
    // ▼ 政治
    "政治", "選挙", "規制", "米中対立", "地政学リスク",
    "中国経済", "米国経済", "欧州経済", "新興国",
    // ▼ プロファイル固有タグ
    "クロスボーダー", "エンタープライズDX", "基幹システム再構築",
    "財務ガバナンス", "データコンプライアンス", "AI Agent",
    "Agentic Workflow", "サーバーレス", "RAG"
  ];

  const vectors = [];

  // ★修正ポイント：10個ずつまとめてAIに送る（回数制限対策）
  const batchSize = 10;

  for (let i = 0; i < tagList.length; i += batchSize) {
    // 10個取り出す
    const batch = tagList.slice(i, i + batchSize);

    // まとめてベクトル化（これでAPI呼び出しは1回で済む）
    const embeddingsResponse = await ai.run('@cf/baai/bge-m3', { text: batch });

    // 結果を整形
    for (let j = 0; j < batch.length; j++) {
      vectors.push({
        id: batch[j],
        values: embeddingsResponse.data[j], // 対応するベクトルを取り出す
        metadata: { tag: batch[j] }
      });
    }
  }

  // Vectorizeに保存
  await env.TAG_INDEX.upsert(vectors);

  return new Response(`Setup complete! Registered ${vectors.length} tags.`);
}

// ==================================================
// 3. 翻訳ロジック
// ==================================================
async function translateTitle(request, env, ai) {
  try {
    const { title } = await request.json();
    if (!title) return new Response('No title provided', { status: 400 });

    // 既に日本語が含まれる場合は翻訳スキップ
    if (containsJapanese(title)) {
      return new Response(JSON.stringify({
        translated: false,
        title_ja: title
      }), {
        headers: { 'content-type': 'application/json' }
      });
    }

    // Gemini 2.0 Flash で翻訳
    const translatedTitle = await runGeminiTranslation(env.GEMINI_API_KEY, title);

    return new Response(JSON.stringify({
      translated: true,
      title_ja: translatedTitle || title
    }), {
      headers: { 'content-type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({
      error: e.message,
      title_ja: title // フォールバック
    }), { status: 500 });
  }
}

function containsJapanese(text) {
  // ひらがな、カタカナ、漢字を検出
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
}

async function runGeminiTranslation(apiKey, title) {
  const prompt = `Translate the following news title to natural Japanese.
Keep it concise and maintain the journalistic tone.
Output ONLY the Japanese translation, nothing else.

Title: "${title}"`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 200
          }
        })
      }
    );

    if (!res.ok) {
      console.error('Gemini translation API error:', res.status);
      return null;
    }

    const data = await res.json();
    let translated = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();

    // クォーテーション除去
    translated = translated.replace(/^["']|["']$/g, '').trim();

    // 翻訳結果に日本語が含まれていない場合はフォールバック
    if (!containsJapanese(translated)) {
      console.warn('Translation output does not contain Japanese:', translated);
      return null;
    }

    return translated;
  } catch (e) {
    console.error('Gemini translation failed:', e);
    return null;
  }
}