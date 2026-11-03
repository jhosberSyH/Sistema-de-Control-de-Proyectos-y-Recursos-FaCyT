import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useInactividad } from './use-inactividad'

const MINUTO = 60_000

describe('useInactividad (aviso de sesión por expirar, WCAG 2.2.1)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('avisa 2 minutos antes, "Seguir trabajando" reinicia la cuenta y al llegar a cero cierra', () => {
    const alRenovar = vi.fn()
    const alExpirar = vi.fn()
    const { result } = renderHook(() => useInactividad({ minutos: 30, alRenovar, alExpirar }))

    act(() => vi.advanceTimersByTime(27 * MINUTO))
    expect(result.current.restante).toBeNull()

    act(() => vi.advanceTimersByTime(MINUTO + 1000))
    expect(result.current.restante).toBe(119)

    // Con el aviso abierto, un clic cualquiera no cuenta como actividad
    act(() => {
      window.dispatchEvent(new Event('pointerdown'))
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.restante).toBe(118)

    act(() => result.current.seguir())
    expect(result.current.restante).toBeNull()
    expect(alRenovar).toHaveBeenCalledTimes(1)

    act(() => vi.advanceTimersByTime(30 * MINUTO))
    expect(alExpirar).toHaveBeenCalledTimes(1)
  })

  it('mientras hay actividad renueva la sesión cada 5 minutos y no avisa', () => {
    const alRenovar = vi.fn()
    const alExpirar = vi.fn()
    const { result } = renderHook(() => useInactividad({ minutos: 30, alRenovar, alExpirar }))

    for (let i = 0; i < 40; i++) {
      act(() => {
        window.dispatchEvent(new Event('keydown'))
        vi.advanceTimersByTime(MINUTO)
      })
    }
    expect(result.current.restante).toBeNull()
    expect(alExpirar).not.toHaveBeenCalled()
    expect(alRenovar).toHaveBeenCalledTimes(8)
  })
})
