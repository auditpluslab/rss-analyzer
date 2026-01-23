export async function onRequest(context) {
  try {
    const { article_id } = await context.request.json(); // article_id は url のこと
    const db = context.env.DB;

    // クリック履歴を保存
    await db.prepare("INSERT INTO clicks (article_url, clicked_at) VALUES (?, ?)")
      .bind(article_id, new Date().toISOString())
      .run();

    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}