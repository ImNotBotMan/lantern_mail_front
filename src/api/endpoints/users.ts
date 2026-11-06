import { api } from '../client'
import type { UserResponse, UserSearchResult } from '../types'

export const usersApi = {
  me(): Promise<UserResponse> {
    return api.request<UserResponse>('GET', '/users/me')
  },

  search(query: string, signal?: AbortSignal): Promise<UserSearchResult[]> {
    return api.request<UserSearchResult[]>('GET', `/users/search?q=${encodeURIComponent(query)}`, {
      signal,
    })
  },
}
