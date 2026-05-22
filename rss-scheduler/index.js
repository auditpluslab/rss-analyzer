export default {
  async scheduled(event, env, ctx) {
    const appUrl = "https://rss-reader-pwa-i12.pages.dev/api/fetch-rss?refresh==true&scope=full";

    console.log("RSS更新ロボット、出動します...");

    try {
      const response = await fetch(appUrl, {
        method: "GET",
        headers: {
          "User-Agent": "RSS-Scheduler-Bot/1.0",
          "X-API-Key": env.API_AUTH_KEY
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log("更新成功！取得記事数:", data.articles ? data.articles.length : 0);
      } else {
        const errorText = await response.text();
        console.error("更新失敗。ステータス:", response.status, "エラー:", errorText);
      }
    } catch (e) {
      console.error("ネットワークエラーが発生しました:", e.message);
    }
  },
};
