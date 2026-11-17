import { initializeApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth, signInWithPopup } from 'firebase/auth'
import type { Auth } from 'firebase/auth'

/**
 * Единственное, что веб-клиент делает с Firebase SDK, — окно Google.
 * Пароли, подтверждение почты и сброс пароля идут через наш API, поэтому Firebase
 * остаётся за одной функцией и легко подменяется в тестах.
 */

interface FirebaseConfig {
  apiKey?: string
  authDomain?: string
  projectId?: string
  appId?: string
}

function config(): FirebaseConfig {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  }
}

/**
 * Кнопка Google видна только там, где проект Firebase настроен: в dev/CI без ключей
 * её нет вовсе, а не «есть, но падает при клике».
 */
export function isGoogleSignInEnabled(): boolean {
  const { apiKey, authDomain, appId } = config()
  return Boolean(apiKey && authDomain && appId)
}

export type GoogleSignInFailure = 'cancelled' | 'popup_blocked' | 'provider_disabled' | 'unknown'

/** Причина отказа окна Google. `cancelled` — не ошибка: человек просто закрыл окно. */
export class GoogleSignInError extends Error {
  readonly reason: GoogleSignInFailure

  constructor(reason: GoogleSignInFailure, cause?: unknown) {
    super(`Google sign-in failed: ${reason}`, { cause })
    this.name = 'GoogleSignInError'
    this.reason = reason
  }
}

/** Коды Firebase → причины, о которых интерфейсу есть что сказать. */
const FAILURE_BY_CODE: Record<string, GoogleSignInFailure> = {
  'auth/popup-closed-by-user': 'cancelled',
  'auth/cancelled-popup-request': 'cancelled',
  'auth/user-cancelled': 'cancelled',
  'auth/popup-blocked': 'popup_blocked',
  'auth/operation-not-allowed': 'provider_disabled',
  'auth/unauthorized-domain': 'provider_disabled',
}

let firebaseAuth: Auth | null = null

function auth(): Auth {
  if (!isGoogleSignInEnabled()) throw new GoogleSignInError('provider_disabled')
  if (!firebaseAuth) firebaseAuth = getAuth(initializeApp(config()))
  return firebaseAuth
}

/** Открыть окно Google и вернуть ID-токен: сервер обменяет его на нашу пару токенов. */
export async function signInWithGoogle(): Promise<string> {
  try {
    const result = await signInWithPopup(auth(), new GoogleAuthProvider())
    return await result.user.getIdToken()
  } catch (cause) {
    const code = (cause as { code?: string }).code ?? ''
    throw new GoogleSignInError(FAILURE_BY_CODE[code] ?? 'unknown', cause)
  }
}
