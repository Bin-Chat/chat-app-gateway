import { Request } from 'express';

export function extractCookieValue(request: Request | undefined, name: string): string | null {
  if (!request) return null;

  const parsedCookie = request.cookies?.[name];
  if (typeof parsedCookie === 'string' && parsedCookie.length > 0) {
    return parsedCookie;
  }

  const rawCookie = request.headers?.cookie;
  if (!rawCookie) return null;

  const cookies = rawCookie.split(';');
  for (const cookie of cookies) {
    const [rawName, ...rawValue] = cookie.trim().split('=');
    if (rawName === name) {
      return decodeURIComponent(rawValue.join('='));
    }
  }

  return null;
}
