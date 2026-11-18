/**
 * Формы контракта бэкенда. Единственное место, где они описаны
 * (docs/specs/api-contract.md, спека `module-backend-contract`).
 */

export type LetterStatus = 'draft' | 'sealed' | 'in_transit' | 'delivered' | 'read' | 'cancelled'

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
  sender_city: City | null
  recipient_city: City | null
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
  sender_city: City | null
  recipient_city: City | null
}

/** Доставленное письмо глазами получателя. */
export interface IncomingLetter {
  view: 'incoming'
  id: string
  status: 'delivered' | 'read'
  sender_username: string | null
  body: string
  wrapper: Wrapper
  sender_city: City | null
  recipient_city: City | null
  delivered_at: string
  read_at: string | null
}

export type AnyLetter = LetterResponse | IncomingLetter | IncomingLetterPreview
export type IncomingLetterView = IncomingLetter | IncomingLetterPreview

/** Диалог без истории: кто собеседник и можно ли туда писать. */
export interface ConversationSummary {
  id: string
  /** Чат «Себе»: собеседника нет, `peer_username` — null. */
  is_self: boolean
  peer_username: string | null
  /** false — чат заморожен после unfriend: история читается, писать нельзя. */
  can_write: boolean
}

/**
 * Последнее письмо диалога. У чужого летящего письма (`in_transit`) текста нет — `body` пустой,
 * и времени доставки тоже нет.
 */
/**
 * Превью последнего видимого мне письма. `text` — своё письмо или доставленное чужое (тело есть),
 * `in_transit` — чужое ещё летит: ни текста, ни времени доставки контракт не отдаёт.
 */
export type ConversationPreview =
  | { letter_id: string; kind: 'text'; body: string }
  | { letter_id: string; kind: 'in_transit'; body: null }

/** Карточка списка чатов. Порядок списка задаёт сервер: новые вперёд, «Себе» — в конце. */
export interface ConversationCard extends ConversationSummary {
  last_event_at: string
  preview: ConversationPreview
}

export interface ConversationList {
  items: ConversationCard[]
}

/** Страница ленты диалога: письма в тех же формах, что `/letters`, новые вперёд. */
export interface ConversationFeed {
  conversation: ConversationSummary
  items: AnyLetter[]
  /** Непрозрачный курсор для `before`; null — более ранних писем нет. */
  next_cursor: string | null
}

export interface ConversationFeedQuery {
  /** 1–200. */
  limit?: number
  before?: string | null
}

export type LetterEventType = 'letter.sent' | 'letter.delivered' | 'letter.read'

/**
 * Событие realtime-шины `/ws`. Шина не источник правды: событие лишь говорит, что пора
 * перезапросить данные, и может прийти повторно.
 */
export interface LetterEvent {
  type: LetterEventType
  letter_id: string
  /** Обязателен у всех трёх событий: по нему обновляется карточка и лента одного чата. */
  conversation_id: string
  sender_id: number
  recipient_id: number
  at: string
}

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

/** Город справочника: названия на двух языках и координаты для расчёта пути. */
export interface City {
  id: number
  name_ru: string
  name_en: string
  country_ru: string
  country_en: string
  latitude: number
  longitude: number
}

export interface UserResponse {
  id: number
  username: string | null
  created_at: string
  city: City | null
  /** Когда город выбран или сменён в последний раз; null — город ещё не выбран. */
  city_changed_at: string | null
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
  | 'city_not_found'
  | 'city_change_too_soon'
  | 'sender_city_missing'
  | 'recipient_city_missing'
  | 'validation_error'

/** Коды, которые порождает сам клиент: сервер их не присылает. */
export type ClientErrorCode = 'network_error' | 'server_error' | 'unknown'

export interface ErrorBody {
  error: string
  message: string
  details?: unknown
}
