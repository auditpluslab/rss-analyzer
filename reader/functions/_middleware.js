export async function onRequest(context) {
  const url = new URL(context.request.url);

  // Allow health checks without auth
  if (url.pathname === '/health') {
    return new Response('ok');
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

  // BASIC認証ヘッダー確認
  const authHeader = context.request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return new Response('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="RSS Reader"' }
    });
  }

  const decoded = atob(authHeader.split(' ')[1]);
  const [username, password] = decoded.split(':');

  if (username !== validUser || password !== validPass) {
    return new Response('Invalid credentials', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="RSS Reader"' }
    });
  }

  // 認証成功 → Cookieセット（30日間有効）
  const response = await context.next();
  const newResponse = new Response(response.body, response);
  newResponse.headers.append('Set-Cookie',
    `rss_auth=${encodeURIComponent(authHeader.split(' ')[1])}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`
  );
  return newResponse;
}
