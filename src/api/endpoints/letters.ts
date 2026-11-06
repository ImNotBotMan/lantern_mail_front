import { api } from '../client'
import type {
  AnyLetter,
  IncomingLetter,
  IncomingLetterView,
  LetterCreate,
  LetterResponse,
  LetterSeal,
  LetterUpdate,
} from '../types'

export const lettersApi = {
  create(data: LetterCreate): Promise<LetterResponse> {
    return api.request<LetterResponse>('POST', '/letters', { body: data })
  },

  sent(): Promise<LetterResponse[]> {
    return api.request<LetterResponse[]>('GET', '/letters/sent')
  },

  inbox(): Promise<IncomingLetterView[]> {
    return api.request<IncomingLetterView[]>('GET', '/letters/inbox')
  },

  get(id: string): Promise<AnyLetter> {
    return api.request<AnyLetter>('GET', `/letters/${id}`)
  },

  update(id: string, data: LetterUpdate): Promise<LetterResponse> {
    return api.request<LetterResponse>('PATCH', `/letters/${id}`, { body: data })
  },

  remove(id: string): Promise<void> {
    return api.request<void>('DELETE', `/letters/${id}`)
  },

  seal(id: string, data: LetterSeal = {}): Promise<LetterResponse> {
    return api.request<LetterResponse>('POST', `/letters/${id}/seal`, { body: data })
  },

  unseal(id: string): Promise<LetterResponse> {
    return api.request<LetterResponse>('POST', `/letters/${id}/unseal`)
  },

  send(id: string): Promise<LetterResponse> {
    return api.request<LetterResponse>('POST', `/letters/${id}/send`)
  },

  read(id: string): Promise<IncomingLetter> {
    return api.request<IncomingLetter>('POST', `/letters/${id}/read`)
  },
}
