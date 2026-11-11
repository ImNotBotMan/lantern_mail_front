import { http, HttpResponse } from 'msw'

import type {
  City,
  Friend,
  IncomingFriendRequest,
  IncomingLetter,
  IncomingLetterPreview,
  LetterResponse,
  OutgoingFriendRequest,
  TokenResponse,
  UserResponse,
  UserSearchResult,
} from '../../api/types'

const BASE = '*/api'

export const tokens: TokenResponse = {
  access_token: 'access-1',
  refresh_token: 'refresh-1',
  token_type: 'bearer',
  expires_in: 900,
}

export const moscow: City = {
  id: 1,
  name_ru: 'Москва',
  name_en: 'Moscow',
  country_ru: 'Россия',
  country_en: 'Russia',
  latitude: 55.7558,
  longitude: 37.6173,
}

export const petersburg: City = {
  id: 2,
  name_ru: 'Санкт-Петербург',
  name_en: 'Saint Petersburg',
  country_ru: 'Россия',
  country_en: 'Russia',
  latitude: 59.9343,
  longitude: 30.3351,
}

export const cities: City[] = [moscow, petersburg]

export const me: UserResponse = {
  id: 1,
  username: 'me_user',
  created_at: '2026-01-01T12:00:00Z',
  city: moscow,
  city_changed_at: '2026-01-01T12:00:00Z',
}

/** Тот же профиль до выбора города: с него начинается новый пользователь. */
export const meWithoutCity: UserResponse = {
  ...me,
  city: null,
  city_changed_at: null,
}

export const letter: LetterResponse = {
  view: 'sender',
  id: '11111111-1111-1111-1111-111111111111',
  status: 'draft',
  recipient_username: 'anna',
  body: 'Привет',
  wrapper: { postcard_id: null, seal_id: null, stamp_id: null },
  sender_city: null,
  recipient_city: null,
  created_at: '2026-01-01T12:00:00Z',
  sealed_at: null,
  sent_at: null,
  deliver_at: null,
  read_at: null,
}

export const sealedLetter: LetterResponse = {
  ...letter,
  id: '22222222-2222-2222-2222-222222222222',
  status: 'sealed',
  sealed_at: '2026-01-02T12:00:00Z',
}

export const transitLetter: LetterResponse = {
  ...letter,
  id: '33333333-3333-3333-3333-333333333333',
  status: 'in_transit',
  sender_city: moscow,
  recipient_city: petersburg,
  sealed_at: '2026-01-02T12:00:00Z',
  sent_at: '2026-01-03T12:00:00Z',
  deliver_at: '2026-01-10T12:00:00Z',
}

/** Письмо в пути глазами получателя: ни текста, ни времени доставки. */
export const envelope: IncomingLetterPreview = {
  view: 'incoming_preview',
  id: '44444444-4444-4444-4444-444444444444',
  status: 'in_transit',
  sender_username: 'boris',
  wrapper: { postcard_id: null, seal_id: null, stamp_id: null },
  sender_city: moscow,
  recipient_city: petersburg,
}

/** Доставленное письмо глазами получателя. */
export const incomingLetter: IncomingLetter = {
  view: 'incoming',
  id: '55555555-5555-5555-5555-555555555555',
  status: 'delivered',
  sender_username: 'boris',
  body: 'Привет',
  wrapper: { postcard_id: null, seal_id: null, stamp_id: null },
  sender_city: moscow,
  recipient_city: petersburg,
  delivered_at: '2026-01-05T12:00:00Z',
  read_at: null,
}

/** Доставленное письмо, которое уже прочитали. */
export const readIncomingLetter: IncomingLetter = {
  ...incomingLetter,
  id: '66666666-6666-6666-6666-666666666666',
  status: 'read',
  read_at: '2026-01-07T12:05:00Z',
}

export const friend: Friend = { username: 'anna', friends_since: '2026-01-01T12:00:00Z' }

export const incomingRequest: IncomingFriendRequest = {
  id: '22222222-2222-2222-2222-222222222222',
  sender_username: 'boris',
  created_at: '2026-01-02T12:00:00Z',
}

export const outgoingRequest: OutgoingFriendRequest = {
  id: '33333333-3333-3333-3333-333333333333',
  recipient_username: 'anna',
  created_at: '2026-01-03T12:00:00Z',
}

export const searchResult: UserSearchResult = {
  username: 'anna',
  relationship: 'none',
  request_id: null,
}

export function unauthorized() {
  return HttpResponse.json(
    { error: 'not_authenticated', message: 'Not authenticated' },
    { status: 401 },
  )
}

export function sessionRejected() {
  return HttpResponse.json(
    { error: 'invalid_refresh_token', message: 'Invalid refresh token' },
    { status: 401 },
  )
}

/** Хендлеры по формам контракта: тесты клиента не зависят от реализации бэкенда. */
export const handlers = [
  http.post(`${BASE}/auth/login`, () => HttpResponse.json(tokens)),
  http.post(`${BASE}/auth/register`, () => HttpResponse.json(tokens, { status: 201 })),
  http.post(`${BASE}/auth/refresh`, () => HttpResponse.json(tokens)),
  http.post(`${BASE}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${BASE}/auth/logout-all`, () => new HttpResponse(null, { status: 204 })),

  http.get(`${BASE}/users/me`, () => HttpResponse.json(me)),
  http.patch(`${BASE}/users/me`, async ({ request }) => {
    const { city_id } = (await request.json()) as { city_id: number }
    const city = cities.find((item) => item.id === city_id) ?? null
    return HttpResponse.json({ ...me, city, city_changed_at: '2026-02-01T12:00:00Z' })
  }),
  http.get(`${BASE}/cities`, () => HttpResponse.json(cities)),
  http.get(`${BASE}/users/search`, ({ request }) => {
    const query = new URL(request.url).searchParams.get('q') ?? ''
    if (query.length < 3) {
      return HttpResponse.json(
        { error: 'validation_error', message: 'Request validation failed' },
        { status: 422 },
      )
    }
    return HttpResponse.json([searchResult])
  }),

  http.get(`${BASE}/letters/sent`, () => HttpResponse.json([letter])),
  http.get(`${BASE}/letters/inbox`, () => HttpResponse.json([])),
  http.get(`${BASE}/letters/:id`, () => HttpResponse.json(letter)),
  http.post(`${BASE}/letters`, () => HttpResponse.json(letter, { status: 201 })),
  http.patch(`${BASE}/letters/:id`, () => HttpResponse.json(letter)),
  http.delete(`${BASE}/letters/:id`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${BASE}/letters/:id/seal`, () => HttpResponse.json({ ...letter, status: 'sealed' })),
  http.post(`${BASE}/letters/:id/unseal`, () => HttpResponse.json(letter)),
  http.post(`${BASE}/letters/:id/send`, () =>
    HttpResponse.json({ ...letter, status: 'in_transit' }),
  ),
  http.post(`${BASE}/letters/:id/read`, () =>
    HttpResponse.json(
      {
        view: 'incoming',
        id: letter.id,
        status: 'read',
        sender_username: 'boris',
        body: 'Привет',
        wrapper: letter.wrapper,
        delivered_at: '2026-01-05T12:00:00Z',
        read_at: '2026-01-05T12:05:00Z',
      },
      { status: 200 },
    ),
  ),

  http.get(`${BASE}/friends`, () => HttpResponse.json([friend])),
  http.delete(`${BASE}/friends/:username`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${BASE}/friends/requests/incoming`, () => HttpResponse.json([incomingRequest])),
  http.get(`${BASE}/friends/requests/outgoing`, () => HttpResponse.json([outgoingRequest])),
  http.post(`${BASE}/friends/requests`, () => HttpResponse.json(outgoingRequest, { status: 201 })),
  http.post(`${BASE}/friends/requests/:id/accept`, () =>
    HttpResponse.json({ username: 'boris', friends_since: '2026-01-04T12:00:00Z' }),
  ),
  http.post(`${BASE}/friends/requests/:id/decline`, () => new HttpResponse(null, { status: 204 })),
  http.delete(`${BASE}/friends/requests/:id`, () => new HttpResponse(null, { status: 204 })),
]
