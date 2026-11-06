import { api } from '../client'
import type { RegisterRequest, TokenResponse } from '../types'

export const authApi = {
  register(data: RegisterRequest): Promise<TokenResponse> {
    return api.request<TokenResponse>('POST', '/auth/register', { body: data, isAuthRequest: true })
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
