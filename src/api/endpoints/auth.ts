import { api } from '../client'
import type { RegisterRequest, TokenResponse, VerificationRequiredResponse } from '../types'

export const authApi = {
  /** Токенов не выдаёт: сначала подтверждение адреса письмом Firebase. */
  register(data: RegisterRequest): Promise<VerificationRequiredResponse> {
    return api.request<VerificationRequiredResponse>('POST', '/auth/register', {
      body: data,
      isAuthRequest: true,
    })
  },

  /**
   * Письмо со ссылкой для смены пароля шлёт Firebase. Ответ 204 одинаков для любого адреса,
   * поэтому наличие аккаунта по нему не определить (docs/specs/api-contract.md).
   */
  requestPasswordReset(email: string): Promise<void> {
    return api.request<void>('POST', '/auth/password/reset', {
      body: { email },
      isAuthRequest: true,
    })
  },

  /** Единственный эндпоинт с form-encoded телом: бэкенд принимает OAuth2PasswordRequestForm. */
  login(email: string, password: string): Promise<TokenResponse> {
    return api.request<TokenResponse>('POST', '/auth/login', {
      form: { username: email, password },
      isAuthRequest: true,
    })
  },

  refresh(refreshToken: string): Promise<TokenResponse> {
    return api.request<TokenResponse>('POST', '/auth/refresh', {
      body: { refresh_token: refreshToken },
      isAuthRequest: true,
    })
  },

  logout(refreshToken: string): Promise<void> {
    return api.request<void>('POST', '/auth/logout', {
      body: { refresh_token: refreshToken },
      isAuthRequest: true,
    })
  },

  logoutAll(): Promise<void> {
    return api.request<void>('POST', '/auth/logout-all')
  },
}
