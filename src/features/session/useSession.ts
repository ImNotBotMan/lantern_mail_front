import { useSyncExternalStore } from 'react'

import {
  getSessionSnapshot,
  login,
  logout,
  logoutAll,
  register,
  subscribe,
} from './sessionStore'

/**
 * Состояние сессии для экранов. Действия возвращают `ApiError` наружу — тексты и переходы
 * остаются у экранов (docs/specs/module-session.md).
 */
export function useSession() {
  const snapshot = useSyncExternalStore(subscribe, getSessionSnapshot)
  return { ...snapshot, login, register, logout, logoutAll }
}
