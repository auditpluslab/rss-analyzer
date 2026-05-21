export async function onRequest(context) {
  try {
    // 1. データベースから最近クリックした記事のID（URL）を5件取得
    const { results } = await context.env.DB.prepare(
      "SELECT article_id FROM clicks ORDER BY clicked_at DESC LIMIT 5"
    ).all();

    // データがない場合
    if (!results || results.length === 0) {
      return new Response(JSON.stringify({ analysis: "まだデータが足りません。もっと記事を読んでみましょう！" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. 記事URLからリストを作成
    const clickedUrls = results.map(r => r.article_id).join("\n");

    // 3. Gemini API に送るプロンプト（命令文）を作成
    const prompt = `
      以下の記事URLリストは、あるエンジニアが興味を持って閲覧したものです。
      このユーザーの「技術的な興味・関心」を、30文字程度の短い日本語で分析・要約してください。
      
      記事リスト:
      ${clickedUrls}
      
      分析結果（例：Rustや低レイヤー技術に関心が高いようです）：
    `;

    // 4. APIキーの確認
    const apiKey = context.env.GEMINI_API_KEY;
    
    // キーが読み込めていない場合のエラー処理
    if (!apiKey) {
      return new Response(JSON.stringify({ 
        error: "Configuration Error", 
        details: "APIキーが見つかりません。.dev.vars ファイルを確認してください。" 
      }), {
        headers: { "Content-Type": "application/json" },
        status: 500
      });
    }

    // 5. Gemini API を呼び出す (モデル: gemini-1.5-flash)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();
    
    // 【重要】Googleからエラーが返ってきた場合、その内容をそのまま画面に出す
    if (data.error) {
       return new Response(JSON.stringify({ 
         error: "Google API Error", 
         details: data.error 
       }, null, 2), {
         headers: { "Content-Type": "application/json" },
         status: 400
       });
    }

    // 6. 成功した場合、AIの回答を取り出す
    const analysisText = data.candidates?.[0]?.content?.parts?.[0]?.text || "分析結果の取得に失敗しました";

    return new Response(JSON.stringify({ analysis: analysisText }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    // プログラム自体のエラー
    return new Response(JSON.stringify({ 
      error: "Internal Server Error", 
      details: err.message,
      stack: err.stack
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}