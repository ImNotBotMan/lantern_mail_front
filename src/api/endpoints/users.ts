import { api } from '../client'
import type { UserResponse, UserSearchResult } from '../types'

export const usersApi = {
  me(): Promise<UserResponse> {
    return api.request<UserResponse>('GET', '/users/me')
  },

  /** Первый выбор города разрешён всегда; смена — не чаще раза в неделю (решает сервер). */
  updateCity(cityId: number): Promise<UserResponse> {
    return api.request<UserResponse>('PATCH', '/users/me', { body: { city_id: cityId } })
  },

  search(query: string, signal?: AbortSignal): Promise<UserSearchResult[]> {
    return api.request<UserSearchResult[]>('GET', `/users/search?q=${encodeURIComponent(query)}`, {
      signal,
    })
  },
}
