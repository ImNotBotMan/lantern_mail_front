import { api } from '../client'
import type { RegisterRequest, RegisterResponse, TokenResponse } from '../types'

export const authApi = {
  /** 202: аккаунт создан, письмо с подтверждением отправлено, токенов пока нет. */
  register(data: RegisterRequest): Promise<RegisterResponse> {
    return api.request<RegisterResponse>('POST', '/auth/register', {
      body: data,
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

  /** Вход через Google: ID-токен Firebase в обмен на нашу пару токенов. */
  firebaseLogin(idToken: string): Promise<TokenResponse> {
    return api.request<TokenResponse>('POST', '/auth/firebase', {
      body: { id_token: idToken },
      isAuthRequest: true,
    })
  },

  /** Письмо со сбросом пароля; сервер отвечает 204 и не раскрывает, есть ли такой адрес. */
  requestPasswordReset(email: string): Promise<void> {
    return api.request<void>('POST', '/auth/password/reset', {
      body: { email },
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
