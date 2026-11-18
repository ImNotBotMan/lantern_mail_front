export const countriesQueryKey = ['countries'] as const

/** Города фильтруются по стране на втором шаге выбора; без страны — весь справочник. */
export const citiesQueryKey = (country?: string | null) =>
  country ? (['cities', country] as const) : (['cities'] as const)
