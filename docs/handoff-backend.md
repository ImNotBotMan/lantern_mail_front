# Хендофф: привести backend к контракту, на который рассчитан веб-клиент

Документ для исполнителя. Это не спека-граф, а рабочий бриф: что сломано, что должно быть,
как проверить. Спеки монорепозитория — `docs/specs/`, процесс — `docs/constitution.md`.

Адресовано: backend. Источник задачи: веб-клиент `lantern_mail_front/` специфицирован по
контракту, который backend сейчас не отдаёт (`lantern_mail_front/docs/specs/api-contract.md`).

**Уже принято пользователем, не пересматривать без него:**

1. Источник правды по друзьям — `docs/friends.md` (целевой дизайн), а не текущий код.
2. Письмо можно отправить только взаимному другу или самому себе. Формулировки в
   `docs/friends.md` («ограничения нет») и в разделе «Открытые вопросы» — устарели.
3. Формат ошибок `{ "error": "<код>", "message": "..." }` не меняется.
4. Реалтайм (SSE/WebSocket) и web push — **вне** этой задачи.

---

## 0. Сначала: репозиторий не собирается

Родительский репозиторий посреди мержа. Ничего не запускается, включая тесты.

```
git status → 5 файлов с конфликтами:
  backend/app/api/deps.py                конфликты на строках 12–15, 23–27, 91–103
  backend/app/db/models.py               конфликты на строках 4–8, 87–193
  backend/tests/api/test_letters_api.py  конфликт
  backend/uv.lock                        конфликт (ломает `uv`: TOML parse error на строке 130)
  docs/letter-lifecycle.md               конфликт на строках 45–49

неотслеживаемые файлы «той» стороны (их надо сохранить, они про Relationship):
  backend/tests/test_friendship_domain.py
  backend/tests/test_friendship_service.py
  backend/tests/api/test_user_search_api.py
```

`uv run python -c "import app.main"` сейчас падает на `uv.lock`. Первым делом — свести мерж,
начиная с `uv.lock` (там конфликт в служебном блоке; правильный вариант собирается
`uv lock` заново).

Две стороны мержа — это две разные модели дружбы:

| | «Updated upstream» (в HEAD) | «Stashed changes» (по `docs/friends.md`) |
|---|---|---|
| Домен | `Friendship{id: int, requester_id, addressee_id, status, created_at, responded_at}` | `{id: uuid, sender_id, recipient_id, created_at, accepted_at}` |
| Сервис | `FriendService` — полный | `FriendshipService` — только `search_users` |
| Поиск | `UserBrief{id, username}`, подстрока | `UserSearchResult{username, relationship, request_id}`, префикс |
| Заявки | `GET /friends/requests` (оба списка) | `/requests/incoming`, `/requests/outgoing` |

Цель — сторона «Stashed changes» (она соответствует `docs/friends.md`), но она **недописана**.
Подробности ниже.

---

## 1. Домен дружбы (главный блокер)

В коде, который пришёл из stash, используется то, чего нет:

- `from app.domain.friendship import Relationship` — **класса `Relationship` не существует**.
  Его импортируют `app/schemas/users.py:5`, `app/services/friendships.py:4`,
  `tests/test_friendship_domain.py:4`, `tests/test_friendship_service.py:4`.
- `friendship.relationship_for(user_id)` — такого метода у `Friendship` нет.
- `FriendshipRepository.list_between(...)` — такого метода нет
  (`app/services/friendships.py:31` его вызывает).

Нужно добавить:

```python
class Relationship(str, Enum):
    NONE = "none"
    OUTGOING_REQUEST = "outgoing_request"
    INCOMING_REQUEST = "incoming_request"
    FRIEND = "friend"
```

`Friendship.relationship_for(user_id)`: `accepted_at` заполнен → `FRIEND`; иначе
`OUTGOING_REQUEST`, если `user_id == sender_id`, иначе `INCOMING_REQUEST`.

`FriendshipRepository.list_between(user_id, other_ids) -> list[Friendship]` — записи, где одна
сторона `user_id`, вторая из `other_ids`.

Плюс переименование модели (по `docs/friends.md`, таблица `friendships`):

| Было | Стало |
|---|---|
| `id: int` | `id: uuid.UUID` |
| `requester_id` | `sender_id` |
| `addressee_id` | `recipient_id` |
| `status: "pending"/"accepted"` | нет поля; статус вычисляется из `accepted_at` |
| `responded_at` | `accepted_at` |

Затрагивает: `app/db/models.py`, `app/domain/friendship.py`, `app/repositories/friendships.py`,
`app/services/friends.py` (→ `friendships.py`), `app/schemas/friends.py`, `app/api/friends.py`,
`tests/*friendship*`, `tests/api/*friends*`. Нужна миграция Alembic.

**Если менять тип `id` и имена полей слишком дорого** — допустимая альтернатива: оставить
`id: int` и `requester/addressee`, но тогда привести `docs/friends.md` к коду (таблица данных
и примеры), и всё равно добавить `Relationship` + `relationship_for` + `list_between`, потому
что от них зависит `/users/search`. Веб-клиент от этого не меняется: в его контракте тип `id`
не зафиксирован. Решение по этому пункту согласовать с пользователем до начала.

---

## 2. API друзей: привести к `docs/friends.md`

Сейчас в коде (`app/api/friends.py` + `app/api/users.py`):

| Сейчас | Должно быть |
|---|---|
| `GET /friends/requests` → `{incoming: [], outgoing: []}` | `GET /friends/requests/incoming` → `IncomingFriendRequest[]`; `GET /friends/requests/outgoing` → `OutgoingFriendRequest[]` |
| `POST /friends/requests` тело `{username}` → `FriendRequestResponse` | тело `{recipient_username}` → 201 `OutgoingFriendRequest` |
| `POST /friends/requests/{id}/accept` → `FriendRequestResponse` | → 200 `Friend` |
| `DELETE /friends/requests/{id}` — отказ и отзыв вместе | `POST /friends/requests/{id}/decline` → 204 (отказ); `DELETE /friends/requests/{id}` → 204 (отзыв) |
| `DELETE /friends/{friend_id}` (int) | `DELETE /friends/{username}` → 204 |
| `GET /friends` → `{friends: [{id, username}]}` | `GET /friends` → `Friend[]` |

Формы (`docs/friends.md`, раздел «Формы ответа»):

```
Friend                 { username, friends_since }
IncomingFriendRequest  { id, sender_username, created_at }
OutgoingFriendRequest  { id, recipient_username, created_at }
UserSearchResult       { username, relationship, request_id | null }
```

Сортировка: друзья — по `username`, заявки — новые вперёд.

### Ловушка: два маршрута на одном пути

`app/main.py` регистрирует и `users.router`, и `friends.search_router` — оба объявляют
`GET /users/search`. FastAPI берёт первый зарегистрированный, поэтому сейчас молча выигрывает
старый (`UserBrief`). После мержа:

- `GET /users/search` оставить **только** в `app/api/users.py` (вариант с `UserSearchResult`);
- из `app/api/friends.py` удалить `search_router` и его регистрацию в `main.py`;
- `FriendService.search` / `repositories/users.py::search_by_username` (подстрока) больше не
  нужны — остаётся `search_by_username_prefix` (использует `startswith(prefix, autoescape=True)`,
  это правильно: `_` экранируется).

---

## 3. Коды ошибок друзей

`app/services/errors.py` и таблица `STATUS_CODES` в `app/api/errors.py` расходятся с
`docs/friends.md`:

| Нужно | Сейчас |
|---|---|
| `friend_request_to_self` → 422 | `self_friend_request` → 409 |
| `incoming_friend_request_exists` → 409 | нет такого класса |
| `friend_request_not_pending` → 409 | вместо него `friend_request_not_found` (404) при повторном accept/decline |
| `forbidden` (403): отправитель пытается принять/отклонить свою заявку, получатель отзывает чужую | `FriendRequestNotFound` (404) в `_get_request` |
| `friend_request_not_found` → 404 | есть |

Порядок проверок при `POST /friends/requests` — строго как в `docs/friends.md`, таблица
«Проверки при отправке заявки»: сам себе → нет получателя → уже друзья → моя заявка ждёт →
его заявка мне ждёт. Сейчас порядок другой (сам себе проверяется после `get_by_username`).

---

## 4. CORS

Не настроен вообще — браузер не сможет обратиться к API с `http://localhost:5173`.

- `CORSMiddleware` с origin из переменной окружения (по умолчанию `http://localhost:5173`).
- Разрешённые заголовки: `Authorization`, `Content-Type`; методы — все используемые.
- Credentials не нужны: клиент шлёт `Authorization: Bearer`, cookie не используются —
  `allow_credentials=False`.
- В разработке клиент частично обходится Vite-прокси, но прод-сборке CORS обязателен.

---

## 5. Письма: поведение не менять, но сверить

Код уже правильный (`friend_check` в `LetterService.send`, отмена летящих писем в `unfriend`).
Требуется только:

- `docs/letter-lifecycle.md` — убрать маркеры конфликта (строки 45–49), оставить версию про
  «письмо в будущее»;
- `docs/friends.md` — в «Решениях» убрать «письмо можно отправить любому» и из «Открытых
  вопросов» — «писать письма только друзьям?»: ответ дан (только друзьям или себе).

Ничего в `app/services/letters.py` менять не нужно.

---

## 6. Документы, которые разъедутся

По конституции (`docs/constitution.md`, Статья 2) спека правится тем же изменением:

- `backend/SUMMARY.md` — таблица эндпоинтов и раздел «Не сделано» (там всё ещё «заявки не
  реализованы», хотя код есть);
- `backend/README.md` — если меняется список эндпоинтов;
- `docs/specs/api.md` — точки входа (`/friends/requests` → три маршрута; `DELETE /friends/{username}`);
- `docs/specs/architecture.md` — если `FriendService` переименовывается в `FriendshipService`;
- `docs/specs/db.md` — если модель дружбы меняется (uuid, sender/recipient, accepted_at);
- `docs/friends.md` — таблица данных и формы ответа под фактическое решение из п. 1.

---

## 7. Тесты

Сейчас не собираются (Relationship отсутствует), а после починки должны покрывать:

- `tests/test_friendship_domain.py` — матрица `relationship_for` (уже написаны, починить);
- `tests/test_friendship_service.py` — поиск: `none`/`outgoing`/`incoming`/`friend`,
  `request_id` только у ожидающих заявок, лимит 20 (уже написаны, починить);
- `tests/api/test_user_search_api.py` — контракт `/users/search`, включая 422 на `q` короче 3;
- `tests/api/` — по каждому эндпоинту друзей: успех, 403, 404, 409 (все коды из п. 3),
  отмена летящих писем при unfriend, `DELETE /friends/{username}` для незнакомца → 404;
- существующие 66 тестов писем и авторизации — зелёные без правок поведения.

---

## 8. Критерии приёмки

```bash
cd backend
uv lock                                   # uv.lock собирается без конфликтов
uv run python -c "import app.main"         # импорт проходит
uv run alembic upgrade head                # миграции накатываются на пустую БД
uv run pytest                              # всё зелёное
uv run fastapi dev app/main.py             # сервер поднимается
curl -s localhost:8000/openapi.json | jq '.paths | keys'   # целевые маршруты на месте
curl -si -X OPTIONS localhost:8000/letters \
  -H 'Origin: http://localhost:5173' \
  -H 'Access-Control-Request-Method: GET'                 # 200 и заголовки CORS
```

Сверка контракта — по `lantern_mail_front/docs/specs/api-contract.md`: каждый эндпоинт,
каждая форма и каждый код ошибки оттуда должны существовать на бэкенде.

---

## 9. Чего не делать

- Не менять формат тела ошибок и не вводить `PATCH {status}` для писем или заявок.
- Не реализовывать SSE/WebSocket и web push — это отдельная задача.
- Не трогать `mobile-app/`: экран друзей там — заглушка (`FriendsRepo.fetchFriends()` возвращает
  пустой список), этот API ему ещё не нужен.
- Не «починить» конфликты выбором одной стороны целиком: сторона «Updated upstream» не содержит
  `Relationship`, сторона «Stashed» не содержит рабочих сервисов и роутеров.
