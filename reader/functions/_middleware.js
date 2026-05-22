export async function onRequest(context) {
  const url = new URL(context.request.url);

  // Allow health checks without auth
  if (url.pathname === '/health') {
    return new Response('ok');
  }

  // API Key auth (for rss-scheduler and other machine clients)
  const apiKey = context.request.headers.get('X-API-Key');
  const validApiKey = context.env.API_AUTH_KEY;
  if (validApiKey && apiKey === validApiKey) {
    return context.next();
  }

  const validUser = context.env.BASIC_USERNAME || 'admin';
  const validPass = context.env.BASIC_PASSWORD;

  // Cookieからセッション確認
  const cookie = context.request.headers.get('Cookie') || '';
  const sessionMatch = cookie.match(/(?:^|;\s*)rss_auth=([^;]+)/);
  if (sessionMatch) {
    try {
      const decoded = atob(decodeURIComponent(sessionMatch[1]));
      const [username, password] = decoded.split(':');
      if (username === validUser && password === validPass) {
        return context.next();
      }
    } catch (e) { /* invalid cookie, fall through */ }
  }

  // POST /login — ログイン処理
  if (url.pathname === '/login' && context.request.method === 'POST') {
    const formData = await context.request.formData();
    const username = formData.get('username') || '';
    const password = formData.get('password') || '';

    if (username === validUser && password === validPass) {
      const token = btoa(`${username}:${password}`);
      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/',
          'Set-Cookie': `rss_auth=${encodeURIComponent(token)}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`
        }
      });
    }

    // 認証失敗 → ログインページにエラー表示
    return new Response(loginPage('ユーザー名またはパスワードが正しくありません'), {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  // 未認証 → ログインページを表示
  return new Response(loginPage(), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

function loginPage(error) {
  const errorMsg = error ? `<div class="error">${escapeHtml(error)}</div>` : '';
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>News Feed - Login</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f5f5f7;
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: #fff;
      border-radius: 16px;
      padding: 40px 32px;
      width: 100%;
      max-width: 360px;
      box-shadow: 0 2px 20px rgba(0,0,0,0.08);
    }
    h1 {
      font-size: 22px;
      font-weight: 800;
      text-align: center;
      margin-bottom: 32px;
      letter-spacing: 0.5px;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #666;
      margin-bottom: 6px;
    }
    input[type="text"],
    input[type="password"] {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid #ddd;
      border-radius: 10px;
      font-size: 16px;
      outline: none;
      transition: border-color 0.2s;
      -webkit-appearance: none;
    }
    input:focus { border-color: #007AFF; }
    .field { margin-bottom: 20px; }
    button {
      width: 100%;
      padding: 14px;
      background: #007AFF;
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 8px;
    }
    button:active { background: #0056CC; }
    .error {
      background: #FFE5E5;
      color: #C00;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 20px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>NEWS FEED</h1>
    ${errorMsg}
    <form method="POST" action="/login">
      <div class="field">
        <label for="username">ユーザー名</label>
        <input type="text" id="username" name="username" autocomplete="username" required>
      </div>
      <div class="field">
        <label for="password">パスワード</label>
        <input type="password" id="password" name="password" autocomplete="current-password" required>
      </div>
      <button type="submit">ログイン</button>
    </form>
  </div>
</body>
</html>`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
