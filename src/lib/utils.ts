import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Склейка Tailwind-классов: поздний класс побеждает конфликтующий ранний (shadcn). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
