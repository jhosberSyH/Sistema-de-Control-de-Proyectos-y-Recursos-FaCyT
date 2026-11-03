import type { ReactNode } from 'react'
import { Tabs } from 'radix-ui'

export type Pestana = { valor: string; etiqueta: ReactNode; contenido: ReactNode }

type Props = {
  pestanas: Pestana[]
  valor?: string
  alCambiar?: (valor: string) => void
  valorInicial?: string
  etiqueta: string
}

/**
 * Pestañas del mockup (.pestanas): mono mayúscula con subrayado primario en la activa.
 * Radix da el patrón de teclado de WAI-ARIA (flechas entre pestañas).
 */
export function Pestanas({ pestanas, valor, alCambiar, valorInicial, etiqueta }: Props) {
  return (
    <Tabs.Root value={valor} onValueChange={alCambiar} defaultValue={valorInicial ?? pestanas[0]?.valor}>
      <Tabs.List className="pestanas" aria-label={etiqueta}>
        {pestanas.map((p) => (
          <Tabs.Trigger key={p.valor} value={p.valor}>
            {p.etiqueta}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {pestanas.map((p) => (
        <Tabs.Content key={p.valor} value={p.valor} style={{ paddingTop: 18 }}>
          {p.contenido}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  )
}
