export async function onRequest(context) {
  const db = context.env.DB;

  try {
    // リクエストの中身（list=一覧ちょだい, save=保存して, delete=消して）
    const { action, article } = await context.request.json();

    if (action === 'list') {
      // 保存済み (is_saved=1) の記事を全部とってくる
      const { results } = await db.prepare(`
        SELECT * FROM articles WHERE is_saved = 1 ORDER BY published_at DESC
      `).all();
      return new Response(JSON.stringify({ articles: results }));
    } 
    
    else if (action === 'save') {
      // 記事を保存済みにする
      await db.prepare("UPDATE articles SET is_saved = 1 WHERE url = ?").bind(article.url).run();
      return new Response(JSON.stringify({ success: true }));
    } 
    
    else if (action === 'delete') {
      // 記事の保存を解除する
      await db.prepare("UPDATE articles SET is_saved = 0 WHERE url = ?").bind(article.url).run();
      return new Response(JSON.stringify({ success: true }));
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}