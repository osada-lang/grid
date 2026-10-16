export const AUTH_COOKIE_NAME = '365voice_grid_session';

const getSecretKey = () => {
  return process.env.AUTH_SECRET || '365voice_grid_auth_secret_token_2026';
};

/**
 * Web Crypto API を使用した HMAC-SHA256 署名付きセッショントークンの生成
 */
export async function createSessionToken(email: string): Promise<string> {
  const secret = getSecretKey();
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const payload = JSON.stringify({
    email,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30日間有効
  });

  const payloadBase64 = btoa(encodeURIComponent(payload));
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(payloadBase64)
  );

  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
  return `${payloadBase64}.${signatureBase64}`;
}

/**
 * セッショントークンの署名検証および有効期限チェック
 */
export async function verifySessionToken(token?: string | null): Promise<{ email: string } | null> {
  if (!token || !token.includes('.')) return null;

  try {
    const [payloadBase64, signatureBase64] = token.split('.');
    const secret = getSecretKey();
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = Uint8Array.from(atob(signatureBase64), (c) => c.charCodeAt(0));
    const isValid = await crypto.subtle.verify(
      'HMAC',
      cryptoKey,
      signatureBytes,
      encoder.encode(payloadBase64)
    );

    if (!isValid) return null;

    const payload = JSON.parse(decodeURIComponent(atob(payloadBase64)));
    if (payload.exp && Date.now() > payload.exp) {
      return null; // 有効期限切れ
    }

    return { email: payload.email };
  } catch {
    return null;
  }
}
