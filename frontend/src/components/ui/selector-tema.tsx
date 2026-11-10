import { useTema } from '@/hooks/use-tema'
import { ETIQUETAS_TEMA, type Tema } from '@/lib/tema'

const TEMAS: Tema[] = ['sistema', 'light', 'dark']

/** Control segmentado Sistema / Claro / Oscuro (RNF-03). La elección se recuerda en este navegador. */
export function SelectorTema({ etiquetadoPor }: { etiquetadoPor?: string }) {
  const [tema, cambiar] = useTema()
  return (
    <div
      className="tema-seg"
      role="group"
      aria-labelledby={etiquetadoPor}
      aria-label={etiquetadoPor ? undefined : 'Tema'}
    >
      {TEMAS.map((t) => (
        <button key={t} type="button" aria-pressed={tema === t} onClick={() => cambiar(t)}>
          {ETIQUETAS_TEMA[t]}
        </button>
      ))}
    </div>
  )
}
