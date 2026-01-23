export async function onRequest(context) {
  try {
    const { urls } = await context.request.json();
    const db = context.env.DB;

    // 送られてきたURLリストを全部「既読 (is_read=1)」にする
    // ※ただし、お気に入り (is_saved=1) の記事は、画面から消えてもいいけどデータとしては大切なのでそのまま
    const placeholders = urls.map(() => "?").join(",");
    const stmt = db.prepare(`UPDATE articles SET is_read = 1 WHERE url IN (${placeholders})`);
    
    await stmt.bind(...urls).run();

    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}