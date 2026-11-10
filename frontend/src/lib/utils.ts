import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Une clases condicionales (utilidad de shadcn/ui). */
export function cn(...clases: ClassValue[]) {
  return twMerge(clsx(clases))
}
