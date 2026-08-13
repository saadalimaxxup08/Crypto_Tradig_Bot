import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_crypto_trader_100_percent_perfect';

export function signToken(email: string): string {
  return jwt.sign({ email }, JWT_SECRET, { expiresIn: '1d' });
}

export function verifyToken(token: string): { email: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { email: string };
  } catch (error) {
    return null;
  }
}

export function getSessionUser(): { email: string } | null {
  const cookieStore = cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function clearSession() {
  const cookieStore = cookies();
  cookieStore.delete('token');
}
