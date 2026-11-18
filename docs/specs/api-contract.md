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
  (письма), `docs/conversations.md` (чаты и realtime-канал), `docs/specs/module-api.md`,
  `module-events` и `module-auth` бэкенда (авторизация, ошибки).
- Не описывает: реализацию бэкенда, схему БД, воркер, push.
- Не описывает: как клиент хранит ответы и что рисует — это `architecture` и модули.

## Состояние бэкенда

Контракт описывает **целевое** состояние, согласованное с пользователем: источник правды
по друзьям — `docs/friends.md` в корне монорепозитория.

Бэкенд приведён к этому контракту (PR #4, коммит `3258687`, влит в `main` 2026-11-06).
Формы и коды ниже сверены с живым `/openapi.json` и кодом `backend/app/api/*`; проверки,
не требующие базы, подтверждены живыми запросами: `q` короче 3 символов — 422,
`friend_request_to_self` и `recipient_not_found` — 422, тело заявки принимает только
`recipient_username`.

Чаты и realtime-канал выкачены в `main` монорепо (PR #13, #14); формы и подача событий
сверены с `docs/conversations.md`, схемами `backend/app/schemas/conversations.py` и ответами
автора бэкенда. Практические следствия: `preview` есть всегда, `preview.body: null` — только
у летящего; `conversation_id` обязателен у всех трёх событий (README-абзац про `null`
у `letter.read` из контракта убран); живой сокет не закрывается при истечении токена.

Города требуют ревизии Alembic `c9e4f7a12b58` (`uv run alembic upgrade head`): без неё
`/cities` и `PATCH /users/me` отвечают 500, а письма — 500 вместо отправки.

Ответы, читающие таблицу `friendships` (`/friends`, `/friends/requests/*`, `/users/search`
с непустым результатом), требуют ревизии Alembic `b7d3e2a91c04` (`uv run alembic upgrade head`):
на прежней ревизии код уже новый, а схема таблицы старая, и такие запросы отвечают 500.
Ошибки друзей после миграции — по таблице ниже, включая `incoming_friend_request_exists`,
`friend_request_not_pending` и `forbidden`.

Авторизация сверена с живым `/openapi.json` и `backend/app/api/auth.py`: регистрация — 202
`VerificationRequiredResponse` без токенов, сброс пароля — 204 на любой адрес (живая проверка:
неизвестный адрес — 204, невалидный — 422 `validation_error`), недоступный Firebase — 502
`identity_unavailable` (`app/services/errors.py`).

## Общие правила

- База: `VITE_API_BASE_URL` (по умолчанию `/api`). В разработке `/api` проксируется Vite на
  `http://localhost:8000`, поэтому браузер видит один origin и CORS для локальной работы не
  нужен. Для прод-сборки адрес задаётся переменной окружения.
- Авторизация: `Authorization: Bearer <access_token>`. Без действующего токена — 401.
- Тело ответа — JSON. Тело ошибки всегда `{ "error": "<код>", "message": "..." }`,
  у `validation_error` дополнительно `details`.
- Даты — ISO 8601 с зоной (`timestamptz`). Идентификаторы писем — UUID-строки.
- CORS настроен на бэкенде: `CORSMiddleware`, `allow_origins` из переменной `CORS_ORIGINS`
  (по умолчанию `http://localhost:5173`), разрешённые заголовки — `Authorization` и
  `Content-Type`, без credentials (клиент шлёт `Bearer`, cookie не используются).
  Прод-сборка с другого origin работает, если его origin добавить в `CORS_ORIGINS`.

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
| `POST /auth/register` | JSON `{ email, password, username }` — `username` 3–32, `[a-z0-9_]`, пароль 8–128 | 202 `VerificationRequiredResponse` |
| `POST /auth/password/reset` | JSON `{ email }` | 204 — всегда, для любого адреса |
| `POST /auth/login` | **form-encoded** (`application/x-www-form-urlencoded`): `username` = email, `password` | 200 `TokenResponse` |
| `POST /auth/refresh` | JSON `{ refresh_token }` | 200 `TokenResponse` (новая пара) |
| `POST /auth/logout` | JSON `{ refresh_token }` | 204 |
| `POST /auth/logout-all` | — (нужен access-токен) | 204 |
| `GET /users/me` | — | 200 `UserResponse` |
| `PATCH /users/me` | JSON `{ city_id }` (только город; лишнее поле — 422) | 200 `UserResponse` |
| `GET /cities` | — ? `country=XX` | 200 `City[]` — с фильтром города одной страны, без него весь справочник по алфавиту |
| `GET /countries` | — | 200 `Country[]` — страны, в которых есть города справочника |

Логин — единственный эндпоинт с form-encoded телом (так его отдаёт `OAuth2PasswordRequestForm`);
остальные — JSON.

```
VerificationRequiredResponse { email, verification_required: true }
UserResponse  { id, username | null, created_at, city: City | null, city_changed_at | null }
City          { id, name_ru, name_en, country_ru, country_en, country_code, latitude, longitude }
Country       { country_code, name_ru, name_en, city_count }
```

**Регистрация токенов не выдаёт.** `POST /auth/register` заводит аккаунт и отвечает 202
`VerificationRequiredResponse`: пароли и внешние идентичности хранит Firebase, а адрес сначала
подтверждают письмом. Пока адрес не подтверждён, `/auth/login` отвечает 403 `email_not_verified`
и повторно отправляет письмо; письмо подтверждения и страницу смены пароля рисует Firebase —
клиент их не рисует.

**Сброс пароля не раскрывает аккаунты.** `POST /auth/password/reset` отвечает 204 без тела и
для существующего, и для неизвестного адреса — различить их по ответу нельзя. 422
`validation_error` — адрес не проходит формат. 502 `identity_unavailable` — Firebase недоступен:
письмо не ушло, и показывать «письмо отправлено» нельзя.

`city_changed_at` — когда город выбран или сменён в последний раз; от него клиент
считает, с какой даты смена снова доступна. `null` в `city` — город ещё не выбран.

`country_code` — код страны ISO 3166-1 alpha-2; им же фильтруется `GET /cities` и
идентифицируется страна в `GET /countries` — названия стран клиенту нужны только для показа.
Выбор города двухшаговый: клиент спрашивает страны, затем города выбранной страны;
весь справочник целиком клиент не запрашивает — городов в нём сотни.

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

`LetterResponse`: `{ view, id, status, recipient_username | null, body, wrapper, sender_city | null,
recipient_city | null, created_at, sealed_at | null, sent_at | null, deliver_at | null, read_at | null }`.
`IncomingLetter`: `{ view, id, status, sender_username | null, body, wrapper, sender_city | null,
recipient_city | null, delivered_at, read_at | null }`.
`IncomingLetterPreview`: `{ view, id, status: "in_transit", sender_username | null, wrapper,
sender_city | null, recipient_city | null }`.

`sender_city` / `recipient_city` — **снимок** городов на момент отправки: у черновика и
запечатанного письма их нет, у летящего и доставленного — есть, если оба пользователя выбрали
город. Смена города после отправки путь уже летящего письма не меняет.
`wrapper`: `{ postcard_id | null, seal_id | null, stamp_id | null }`.

`status` ∈ `draft | sealed | in_transit | delivered | read | cancelled`. Статус вычисляется
сервером на момент ответа; клиент его не считает. `deliver_at` получателю не отдаётся —
в конверте нет и не должно быть времени доставки.

`postcard_id` / `seal_id` / `stamp_id` — идентификаторы ещё не созданного каталога
обёрток; сервер их не проверяет, каталога в первом билде нет.

### Чаты

| Метод и путь | Тело запроса | Успех |
|---|---|---|
| `GET /conversations` | — | 200 `{ items: ConversationCard[] }` |
| `GET /conversations/{id}/letters` | — (`?limit` 1–200, по умолчанию 50; `?before` — курсор) | 200 `ConversationFeed` |

```
ConversationCard   { id, is_self, peer_username | null, can_write, last_event_at,
                     preview: ConversationPreview }
ConversationPreview text:        { letter_id, kind: "text", body }
                    in_transit:  { letter_id, kind: "in_transit", body: null }
ConversationFeed   { conversation: { id, is_self, peer_username | null, can_write },
                     items: (LetterResponse | IncomingLetter | IncomingLetterPreview)[],
                     next_cursor | null }
```

- Чат — диалог пары участников (письма принадлежат ему по совпадению пары), поэтому список
  отдаётся целиком, без пагинации. Порядок задаёт сервер: по `last_event_at` новые вперёд,
  чат «Себе» — в конце. Момент письма в ленте: своё — `sent_at`, чужое — `deliver_at`.
- `peer_username` у чата «Себе» — `null`; `can_write: false` после удаления из друзей: история
  читается, писать нельзя.
- `preview` есть всегда: чат без видимых мне писем в список не попадает. `preview.body`
  `null` — ровно у `kind: "in_transit"`: у чужого летящего письма ни текста, ни времени
  доставки контракт не отдаёт (как и в `IncomingLetterPreview`).
- Лента отдаёт письма в тех же трёх формах, что `/letters` (`поле view`), новые вперёд;
  `next_cursor` — непрозрачная строка, передаётся обратно в `before`, `null` — страниц больше нет.
  Не-участник чата получает 404 `not_found`: для него чата не существует.
- Счётчика непрочитанных в API нет (определение согласовано: доставленное мне письмо без `read_at`).

### Realtime-канал чатов (WebSocket)

`WS /ws?token=<access_token>` — браузерный сокет без заголовков, поэтому токен идёт в query.
Push (FCM) остаётся каналом для фонового режима, веб получает события только пока вкладка открыта.

```
letter.sent | letter.delivered | letter.read →
{ type, letter_id, conversation_id, sender_id, recipient_id, at }
```

- Сервер **принимает соединение и сразу закрывает** его кодом **4401**, если токен не передан,
  невалиден или просрочен. Токен проверяется только при подключении: живое соединение
  переживает истечение access-токена.
- Клиент отправляет только `"ping"`, получает `{"type": "pong"}` (keepalive); запись идёт по HTTP.
- Событие получают оба участника пары; клиент решает, что обновить. `letter.sent` — письмо
  отправлено, `letter.delivered` — долетело, `letter.read` — прочитано.
- `conversation_id` обязателен у всех трёх событий: `letter.read` публикует его так же, как
  отправка, — через общий get-or-create диалога пары. WS-эндпоинт умеет достроить id по паре
  (кэш на время соединения), но это страховка для внутренних `None`, а не часть контракта:
  клиенту id приходит всегда, и по нему обновляется один чат.
- Шина — не источник правды: события могут дублироваться (ретраи sweep), оффлайн-клиент их не
  получает. Состояние всегда догоняется `GET /conversations` и лентой.

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
| 401 | `not_authenticated`, `invalid_credentials`, `invalid_refresh_token`, `invalid_token` |
| 403 | `forbidden`, `email_not_verified` |
| 404 | `not_found`, `user_not_found`, `friend_request_not_found` |
| 409 | `email_taken`, `email_registered`, `username_taken`, `username_already_set`, `not_friends`, `already_friends`, `friend_request_exists`, `incoming_friend_request_exists`, `friend_request_not_pending`, `invalid_state`, `letter_empty`, `recipient_missing`, `city_change_too_soon`, `sender_city_missing`, `recipient_city_missing` |
| 422 | `recipient_not_found`, `friend_request_to_self`, `city_not_found`, `validation_error` (с `details`) |
| 502 | `identity_unavailable` — Firebase недоступен (вход, регистрация, сброс пароля) |

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
- Существование чата и право писать: не-участник получает 404 `not_found`, `can_write: false`
  после удаления из друзей. Клиент рисует диалог по этим полям, а не по своему списку друзей.
- Город обязателен для отправки: `send` без города у отправителя — 409 `sender_city_missing`,
  без города у получателя — 409 `recipient_city_missing`. Клиент ведёт на шаг выбора города,
  но решает это не он: отказ приходит от сервера.
- Смена города — не чаще раза в неделю от `city_changed_at`; повторная отправка того же
  города — успех без изменения даты. Нарушение — 409 `city_change_too_soon`; клиент показывает лимит
  заранее, но ответ сервера всё равно показывает.
- Какой город назвать на языке интерфейса, клиент решает сам: справочник отдаёт обе колонки.
