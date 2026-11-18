import { describe, expect, it } from 'vitest'

import { socketUrl } from './client'

describe('адрес realtime-шины', () => {
  it('относительная база достраивается от страницы: в разработке /api/ws идёт через прокси', () => {
    expect(socketUrl('/ws', { token: 'a b' }, '/api', 'http://localhost:5173/chats')).toBe(
      'ws://localhost:5173/api/ws?token=a+b',
    )
  })

  it('https-страница получает защищённый сокет', () => {
    expect(socketUrl('/ws', { token: 't' }, '/api', 'https://mail.example.com/')).toBe(
      'wss://mail.example.com/api/ws?token=t',
    )
  })

  it('абсолютная база API даёт сокет на её хосте, без префикса /api', () => {
    expect(socketUrl('/ws', { token: 't' }, 'https://api.example.com', 'http://localhost/')).toBe(
      'wss://api.example.com/ws?token=t',
    )
  })
})
