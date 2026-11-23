import { api } from '../client'
import type { Stamp } from '../types'

export const stampsApi = {
  /**
   * Каталог марок с остатками текущего пользователя. Сервер отдаёт весь каталог сразу:
   * виды с нулевым остатком тоже в ответе, «закончилось» решает клиент.
   */
  list(): Promise<Stamp[]> {
    return api.request<Stamp[]>('GET', '/stamps')
  },
}
