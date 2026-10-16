import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken, AUTH_COOKIE_NAME } from './lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 認証チェックを除外する公開ルート
  if (
    pathname === '/login' ||
    pathname === '/api/auth/login' ||
    pathname === '/api/auth/logout' ||
    pathname === '/api/cron/measure' || // cron-job.org からの自動計測を保護
    pathname.startsWith('/_next') ||
    pathname === '/icon.svg' ||
    pathname === '/favicon.svg' ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    // APIリクエストの場合は 401 JSON を返却
    if (pathname.startsWith('/api')) {
      return NextResponse.json(
        { error: 'Unauthorized: ログインが必要です。' },
        { status: 401 }
      );
    }

    // 画面アクセスの場合はログイン画面へリダイレクト
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
