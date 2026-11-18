import { describe, expect, it } from 'vitest'

import { resources } from './index'

function keyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix]
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  )
}

/** Формы множественного числа схлопываются в один ключ: их набор у языков разный. */
function collapsePlurals(keys: string[]): string[] {
  return keys.map((key) => key.replace(/_(zero|one|two|few|many|other)$/, '_plural'))
}

describe('словари', () => {
  it.each(Object.keys(resources.ru))('набор ключей %s совпадает в ru и en', (namespace) => {
    const ru = [
      ...new Set(collapsePlurals(keyPaths(resources.ru[namespace as keyof typeof resources.ru]))),
    ].sort()
    const en = [
      ...new Set(collapsePlurals(keyPaths(resources.en[namespace as keyof typeof resources.en]))),
    ].sort()
    expect(en).toEqual(ru)
  })
})
