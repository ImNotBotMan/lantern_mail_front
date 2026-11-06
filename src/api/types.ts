/**
 * Формы контракта бэкенда. Единственное место, где они описаны
 * (docs/specs/api-contract.md, спека `module-backend-contract`).
 */

export type LetterStatus =
  | 'draft'
  | 'sealed'
  | 'in_transit'
  | 'delivered'
  | 'read'
  | 'cancelled'

export type Relationship = 'none' | 'outgoing_request' | 'incoming_request' | 'friend'

export interface Wrapper {
  postcard_id: number | null
  seal_id: number | null
  stamp_id: number | null
}

/** Письмо глазами отправителя: видно всё. */
export interface LetterResponse {
  view: 'sender'
  id: string
  status: LetterStatus
  recipient_username: string | null
  body: string
  wrapper: Wrapper
  created_at: string
  sealed_at: string | null
  sent_at: string | null
  deliver_at: string | null
  read_at: string | null
}

/** Письмо в пути глазами получателя: отправитель и обёртка, без текста и времени доставки. */
export interface IncomingLetterPreview {
  view: 'incoming_preview'
  id: string
  status: 'in_transit'
  sender_username: string | null
  wrapper: Wrapper
}

/** Доставленное письмо глазами получателя. */
export interface IncomingLetter {
  view: 'incoming'
  id: string
  status: 'delivered' | 'read'
  sender_username: string | null
  body: string
  wrapper: Wrapper
  delivered_at: string
  read_at: string | null
}

export type AnyLetter = LetterResponse | IncomingLetter | IncomingLetterPreview
export type IncomingLetterView = IncomingLetter | IncomingLetterPreview

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: 'bearer'
  expires_in: number
}

export interface RegisterRequest {
  email: string
  password: string
  username: string
}

export interface UserResponse {
  id: number
  username: string | null
  created_at: string
}

export interface LetterCreate {
  recipient_username?: string | null
  body?: string
  postcard_id?: number | null
}

export interface LetterUpdate {
  recipient_username?: string | null
  body?: string
  postcard_id?: number | null
}

export interface LetterSeal {
  seal_id?: number | null
  stamp_id?: number | null
}

export interface UserSearchResult {
  username: string
  relationship: Relationship
  request_id: string | null
}

export interface Friend {
  username: string
  friends_since: string
}

export interface IncomingFriendRequest {
  id: string
  sender_username: string
  created_at: string
}

export interface OutgoingFriendRequest {
  id: string
  recipient_username: string
  created_at: string
}

/** Коды ошибок домена и сервисов бэкенда (поле `error` в теле ответа). */
export type ApiErrorCode =
  | 'not_authenticated'
  | 'invalid_credentials'
  | 'invalid_refresh_token'
  | 'forbidden'
  | 'not_found'
  | 'user_not_found'
  | 'friend_request_not_found'
  | 'email_taken'
  | 'username_taken'
  | 'username_required'
  | 'not_friends'
  | 'already_friends'
  | 'friend_request_exists'
  | 'incoming_friend_request_exists'
  | 'friend_request_not_pending'
  | 'self_friend_request'
  | 'recipient_not_found'
  | 'friend_request_to_self'
  | 'invalid_state'
  | 'letter_empty'
  | 'recipient_missing'
  | 'validation_error'

/** Коды, которые порождает сам клиент: сервер их не присылает. */
export type ClientErrorCode = 'network_error' | 'server_error' | 'unknown'

export interface ErrorBody {
  error: string
  message: string
  details?: unknown
}
