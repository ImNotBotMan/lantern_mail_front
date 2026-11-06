# Хендофф: привести backend к контракту веб-клиента — выполнен

**Статус: выполнено** на бэкенде (PR #4, коммит `3258687`, влит в `main` 2026-11-06).
Файл больше не бриф для исполнителя, а запись о том, что сделано и чем это подтверждается:
в бэкенд-репозитории (корень монорепозитория) спеки `docs/specs/api.md`, `services.md`,
`db.md`, `domain.md` обновлены тем же изменением, а `docs/friends.md` описывает итоговый
дизайн друзей.

Актуальный контракт, который потребляет веб-клиент, — `docs/specs/api-contract.md`
в этом репозитории. Расхождений по формам и кодам с живым `/openapi.json` нет.

## Что сделано

| Пункт | Итог |
|---|---|
| Мерж репозитория | Сведён; `uv.lock`, `deps.py`, `models.py`, тесты писем и `letter-lifecycle.md` больше не в конфликте |
| Домен дружбы | `Friendship{id: UUID, sender_id, recipient_id, created_at, accepted_at}`, `Relationship` и `relationship_for(user_id)`, статус вычисляется из `accepted_at` |
| Миграция | `b7d3e2a91c04` — UUID id, `accepted_at`, переименование колонок, пересоздание индексов и внешних ключей с сохранением существующих связей |
| API друзей | `GET /friends` → `Friend[]`; `GET /friends/requests/{incoming,outgoing}` раздельно; `POST /friends/requests` → `{recipient_username}` и 201; `POST .../{id}/accept` → `Friend`; `POST .../{id}/decline` → 204; `DELETE .../{id}` — отзыв; `DELETE /friends/{username}` — unfriend |
| Поиск | `GET /users/search` остался единственным в `app/api/users.py`, `search_router` из `friends.py` удалён; ответ `UserSearchResult{username, relationship, request_id}`, префикс, `q` 3–32 символа, короче — 422 |
| Коды ошибок | `friend_request_to_self` 422, `recipient_not_found` 422, `incoming_friend_request_exists` / `friend_request_not_pending` 409, `forbidden` 403 для чужих действий по заявке; порядок проверок — по `docs/friends.md` |
| CORS | `CORSMiddleware`, `allow_origins` из `CORS_ORIGINS` (по умолчанию `http://localhost:5173`), `allow_credentials=False` |
| Письма | Поведение не менялось: `friend_check` в `send`, отмена летящих писем пары в `unfriend` |
| Тесты | `tests/test_friendship_domain.py`, `tests/test_friendship_service.py`, `tests/api/test_user_search_api.py`, расширенный `tests/api/test_friends_api.py`, новый `tests/api/test_cors.py` |

## Что осталось на стороне окружения

- База должна быть на ревизии `b7d3e2a91c04`: `cd backend && uv run alembic upgrade head`.
  Пока миграция не применена, код и `/openapi.json` новые, а `/friends*` и `/users/search`
  отвечают 500 — схема таблицы `friendships` старая.
- `mobile-app/` не трогали: экран друзей там по-прежнему заглушка.
