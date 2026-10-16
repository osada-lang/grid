import { NextResponse } from 'next/server';
import { createSessionToken, AUTH_COOKIE_NAME } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, password } = body;

    const expectedEmail = process.env.ADMIN_EMAIL || 'admin@365voice.jp';
    const expectedPassword = process.env.ADMIN_PASSWORD || 'silver-ringo-815-park';

    if (!email || !password) {
      return NextResponse.json(
        { error: 'ID（メールアドレス）とパスワードを入力してください' },
        { status: 400 }
      );
    }

    if (email.trim().toLowerCase() !== expectedEmail.toLowerCase() || password !== expectedPassword) {
      return NextResponse.json(
        { error: 'IDまたはパスワードが正しくありません' },
        { status: 401 }
      );
    }

    const token = await createSessionToken(email.trim().toLowerCase());

    const response = NextResponse.json({
      success: true,
      message: 'ログインに成功しました',
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30日間
    });

    return response;
  } catch (error: any) {
    console.error('API /api/auth/login error:', error);
    return NextResponse.json(
      { error: error.message || 'ログイン処理に失敗しました' },
      { status: 500 }
    );
  }
}
