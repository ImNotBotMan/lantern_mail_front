# Lantern Mail — веб-клиент

Веб-клиент «медленной почты» Lantern Mail: письмо пишут, запечатывают и отправляют, а
получатель видит, что оно «летит» к нему, но прочитать может только после доставки.
React · TypeScript · Vite · React Router · TanStack Query · i18next · CSS-модули.

## Запуск

Бэкенд должен быть на `localhost:8000` (см. `../README.md` в монорепозитории).

```bash
npm install
npm run dev        # http://localhost:5173, /api проксируется на :8000
```

- `VITE_API_BASE_URL` — базовый адрес API (по умолчанию `/api`).
- `API_PROXY_TARGET` — адрес бэкенда для dev-прокси (по умолчанию `http://localhost:8000`).

## Скрипты

| Скрипт                 | Что делает                       |
| ---------------------- | -------------------------------- |
| `npm run dev`          | Vite dev-сервер                  |
| `npm run build`        | `tsc -b` + production-сборка     |
| `npm run preview`      | предпросмотр production-сборки   |
| `npm run typecheck`    | `tsc -b --noEmit`                |
| `npm test`             | Vitest + Testing Library + MSW   |
| `npm run test:watch`   | Vitest в watch-режиме            |
| `npm run test:e2e`     | Playwright против живого бэкенда |
| `npm run lint`         | ESLint                           |
| `npm run format`       | Prettier `--write`               |
| `npm run format:check` | Prettier `--check`               |

## Архитектура

Спеки — в `docs/specs/`: цель и требования, архитектура, модули, контракт бэкенда.
Структура:

```
src/
  app/       провайдеры, роутер, layout
  pages/     экраны по адресам
  features/  доменные хуки и компоненты: letters, friends, session
  api/       транспорт и формы контракта
  shared/    UI-кит, i18n, утилиты
```

## Тесты

- `npm test` — компонентные и хуковые тесты на MSW.
- `npm run test:e2e` — Playwright на живом бэкенде: сессия, друзья, письма, аккаунт,
  язык, 404, ошибки, удаление и распечатывание. Бэкенд — на `localhost:8000`, фронт
  Playwright поднимает на `:5174`.

## CI

`.github/workflows/ci.yml` — на каждый PR и push в `main`: типы, линт, формат, тесты,
сборка. E2E — вне CI: сценариям нужен живой бэкенд, а его репозиторий приватный.
