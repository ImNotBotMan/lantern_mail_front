---
id: module-backend-contract
type: module-design
title: Контракт бэкенда, который потребляет веб-клиент
status: active
tags: [contract, api]
---

# Контракт бэкенда

## Responsibility

**Ответственность:** единственная запись того, что веб-клиент ждёт от API: эндпоинты,
формы запросов и ответов, коды ошибок, правила токенов. Код клиента и `module-front-api-client`
ссылаются сюда, а не на `/docs` бэкенда и не на примеры в README.

**Кому принадлежит:** бэкенду. Здесь — снимок того, что бэкенд обязан отдавать
(конституция, Статья 7). Расхождение с работающим API — баг, а не повод обойти контракт
на клиенте.

## Boundary

- Источник форм: `docs/friends.md` (друзья и поиск — целевой дизайн), `docs/letter-lifecycle.md`
  (письма), `docs/specs/module-api.md` и `module-auth` бэкенда (авторизация, ошибки).
- Не описывает: реализацию бэкенда, схему БД, воркер, push.
- Не описывает: как клиент хранит ответы и что рисует — это `architecture` и модули.

## Состояние бэкенда на момент фиксации

Контракт описывает **целевое** состояние, согласованное с пользователем: источник правды
по друзьям — `docs/friends.md`.

Что уже есть в коде (проверено): авторизация, `/users/me`, весь жизненный цикл письма,
`/users/search` с `relationship`, `/devices`.

Что расходится с этим контрактом и должно быть приведено к нему в бэкенде:
`GET /friends/requests` (в коде — один эндпоинт с двумя списками), `DELETE /friends/{user_id}`
(в коде — по числовому id, в контракте — по `username`), `POST /friends/requests/{id}/decline`
(в коде — `DELETE /friends/requests/{id}` для отказа и отзыва). Коды ошибок друзей —
по таблице ниже; в коде сейчас `self_friend_request` вместо `friend_request_to_self`.

Плюс на 2026-11-06 бэкенд-репозиторий посреди мержа: неразрешённые конфликты в
`backend/app/api/deps.py`, `backend/app/db/models.py`, `backend/tests/api/test_letters_api.py`,
`backend/uv.lock`, `docs/letter-lifecycle.md`. До их сведения живой `/openapi.json`
недоступен; снимок ниже собран по документированному контракту и коду.

## Общие правила

- База: `VITE_API_BASE_URL` (по умолчанию `http://localhost:8000`).
- Авторизация: `Authorization: Bearer <access_token>`. Без действующего токена — 401.
- Тело ответа — JSON. Тело ошибки всегда `{ "error": "<код>", "message": "..." }`,
  у `validation_error` дополнительно `details`.
- Даты — ISO 8601 с зоной (`timestamptz`). Идентификаторы писем — UUID-строки.
- CORS на бэкенде **не настроен**: браузерные запросы с другого origin сейчас не пройдут.
  Это работа на бэкенде, без неё клиент не запускается.

## Токены

| Токен | Формат | Срок | Где живёт |
|---|---|---|---|
| `access_token` | JWT, HS256 | 15 минут | только в памяти клиента |
| `refresh_token` | opaque-строка | 30 дней | `localStorage` клиента |

`TokenResponse`: `{ access_token, refresh_token, token_type: "bearer", expires_in }`.

- Каждый `/auth/refresh` выдаёт **новую пару** и отзывает предъявленный refresh-токен.
- Повторное предъявление отозванного токена сервер считает кражей и отзывает всю цепочку
  сессии (`family_id`): все выданные в ней refresh-токены перестают работать.
- `/auth/logout` отзывает текущий refresh-токен, `/auth/logout-all` — все сессии пользователя.

## Эндпоинты

### Авторизация и профиль

| Метод и путь | Тело запроса | Успех |
|---|---|---|
| `POST /auth/register` | JSON `{ email, password, username }` — `username` 3–32, `[a-z0-9_]`, пароль 8–128 | 201 `TokenResponse` |
| `POST /auth/login` | **form-encoded** (`application/x-www-form-urlencoded`): `username` = email, `password` | 200 `TokenResponse` |
| `POST /auth/refresh` | JSON `{ refresh_token }` | 200 `TokenResponse` (новая пара) |
| `POST /auth/logout` | JSON `{ refresh_token }` | 204 |
| `POST /auth/logout-all` | — (нужен access-токен) | 204 |
| `GET /users/me` | — | 200 `{ id, username, created_at }` |

Логин — единственный эндпоинт с form-encoded телом (так его отдаёт `OAuth2PasswordRequestForm`);
остальные — JSON.

### Письма

| Метод и путь | Тело запроса | Успех |
|---|---|---|
| `POST /letters` | `{ recipient_username?, body? = "", postcard_id? }` | 201 `LetterResponse` |
| `GET /letters/sent` | — | 200 `LetterResponse[]` |
| `GET /letters/inbox` | — | 200 `(IncomingLetter \| IncomingLetterPreview)[]` |
| `GET /letters/{id}` | — | 200 `LetterResponse \| IncomingLetter \| IncomingLetterPreview`, форма — по полю `view` |
| `PATCH /letters/{id}` | `{ recipient_username?, body?, postcard_id? }` (только переданные поля; `null` у получателя/открытки — «убрать») | 200 `LetterResponse` |
| `DELETE /letters/{id}` | — | 204 |
| `POST /letters/{id}/seal` | `{ seal_id?, stamp_id? }` | 200 `LetterResponse` |
| `POST /letters/{id}/unseal` | — | 200 `LetterResponse` |
| `POST /letters/{id}/send` | — | 200 `LetterResponse` |
| `POST /letters/{id}/read` | — | 200 `IncomingLetter` |

Три формы письма различаются полем `view`:

```
LetterResponse            view: "sender"            — всё: текст, обёртка, все даты
IncomingLetterPreview     view: "incoming_preview"  — status: "in_transit", sender_username, wrapper
IncomingLetter            view: "incoming"          — status: "delivered" | "read", текст, delivered_at, read_at
```

`LetterResponse`: `{ view, id, status, recipient_username | null, body, wrapper, created_at,
sealed_at | null, sent_at | null, deliver_at | null, read_at | null }`.
`IncomingLetter`: `{ view, id, status, sender_username | null, body, wrapper, delivered_at, read_at | null }`.
`IncomingLetterPreview`: `{ view, id, status: "in_transit", sender_username | null, wrapper }`.
`wrapper`: `{ postcard_id | null, seal_id | null, stamp_id | null }`.

`status` ∈ `draft | sealed | in_transit | delivered | read | cancelled`. Статус вычисляется
сервером на момент ответа; клиент его не считает. `deliver_at` получателю не отдаётся —
в конверте нет и не должно быть времени доставки.

`postcard_id` / `seal_id` / `stamp_id` — идентификаторы ещё не созданного каталога
обёрток; сервер их не проверяет, каталога в первом билде нет.

### Друзья и поиск

| Метод и путь | Тело запроса | Успех |
|---|---|---|
| `GET /users/search?q=` | — (`q`: 3–32, `[a-z0-9_]`; клиент приводит к нижнему регистру) | 200 `UserSearchResult[]`, максимум 20, сортировка по `username` |
| `GET /friends` | — | 200 `Friend[]` |
| `DELETE /friends/{username}` | — | 204 |
| `POST /friends/requests` | `{ recipient_username }` | 201 `OutgoingFriendRequest` |
| `GET /friends/requests/incoming` | — | 200 `IncomingFriendRequest[]` |
| `GET /friends/requests/outgoing` | — | 200 `OutgoingFriendRequest[]` |
| `POST /friends/requests/{id}/accept` | — | 200 `Friend` |
| `POST /friends/requests/{id}/decline` | — | 204 |
| `DELETE /friends/requests/{id}` | — | 204 (отозвать свою заявку) |

```
Friend                  { username, friends_since }            // friends_since = accepted_at
IncomingFriendRequest   { id, sender_username, created_at }
OutgoingFriendRequest   { id, recipient_username, created_at }
UserSearchResult        { username, relationship, request_id | null }
```

`relationship` ∈ `none | outgoing_request | incoming_request | friend`. `request_id` заполнен
только у `outgoing_request` и `incoming_request`. Список заявок сортируется новыми вперёд,
друзья — по `username`. Пагинации нет.

`GET /users/search` — только начало `username`, ищет сервер; `_` экранируется на сервере.

### Устройства (не используются веб-клиентом в первом билде)

`POST /devices` `{ token, platform: "ios" | "android" | "web" }` — upsert, `DELETE /devices/{id}`.
Существуют, потому что уже есть на бэкенде и понадобятся для web push; в первом билде
клиент к ним не обращается.

## Коды ошибок

`{ "error": "<код>", "message": "..." }`. Клиент переводит код в текст; `message`
показывается, только если для кода нет перевода.

| HTTP | Коды |
|---|---|
| 401 | `not_authenticated`, `invalid_credentials`, `invalid_refresh_token` |
| 403 | `forbidden` |
| 404 | `not_found`, `user_not_found`, `friend_request_not_found` |
| 409 | `email_taken`, `username_taken`, `not_friends`, `already_friends`, `friend_request_exists`, `incoming_friend_request_exists`, `friend_request_not_pending`, `invalid_state`, `letter_empty`, `recipient_missing` |
| 422 | `recipient_not_found`, `friend_request_to_self`, `validation_error` (с `details`) |

`invalid_refresh_token` на `/auth/refresh` означает, что сессия закрыта (истекла или
украдена) — это единственный ответ, по которому клиент разлогинивается.

## Правила, которые клиент получает от сервера, а не выводит сам

- Можно ли отправить письмо этому пользователю: `send` возвращает `not_friends` (409),
  если получатель не взаимный друг и не сам отправитель. Клиент показывает ошибку, но не заменяет
  проверку своей.
- Видимость письма: приходится на три формы ответа (`view`) — клиент отображает форму,
  а не решает, что скрыть.
- Допустимость действия: сервер отвечает 409 `invalid_state`, если переход недопустим
  в текущем статусе.
