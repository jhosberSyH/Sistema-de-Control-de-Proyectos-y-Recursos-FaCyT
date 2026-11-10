import { useId } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ErrorBar,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export type Columna = {
  clave: string
  /** Etiqueta corta bajo la columna ("Abr"). */
  etiqueta: string
  /** Para el tooltip y la tabla ("Abril de 2026"). */
  etiquetaLarga: string
  valor: number
  /** Columna pronosticada: va rayada y con su intervalo (plan §7.4). */
  pronostico?: { minimo: number; maximo: number }
  /** Mes en curso: va rayado, con su valor, porque todavía no está completo (mockup 03). */
  enCurso?: boolean
}

type Props = {
  columnas: Columna[]
  /** Formato de los valores: "6,2 L". */
  formato: (valor: number) => string
  /** Línea de referencia punteada, como el stock mínimo. */
  referencia?: { valor: number; etiqueta: string }
  alto?: number
  /** Texto sobre cada columna ("8,8 mil"); por defecto, el número de `formato` sin la unidad. */
  etiquetaValor?: (valor: number) => string
  /** Marcas del eje ("4.000"); por defecto, `formato`. */
  formatoEje?: (valor: number) => string
}

/** Escala de 4 o 5 marcas redondas: con un máximo de 7,5 da 0, 2, 4, 6 y 8 (mockup 10). */
function escala(maximo: number) {
  const bruto = Math.max(maximo, 1) / 4
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto) ?? bruto
  const tope = Math.ceil(maximo / paso) * paso || paso
  return Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => Math.round(i * paso * 1000) / 1000)
}

/**
 * Columnas de una sola serie en el color primario (vistas 03 y 10), hechas con Recharts para que se vean
 * como el mockup. Sin animaciones; el teclado recorre las columnas con la capa de accesibilidad de
 * Recharts 3. Junto al gráfico va siempre "Ver como tabla" (WCAG 1.1.1), que pinta la vista que lo usa.
 */
export function GraficoColumnas({
  columnas,
  formato,
  referencia,
  alto = 220,
  etiquetaValor,
  formatoEje = formato,
}: Props) {
  const rayado = `rayado${useId().replace(/:/g, '')}`
  const maximo = Math.max(...columnas.map((c) => c.pronostico?.maximo ?? c.valor), referencia?.valor ?? 0)
  const marcas = escala(maximo)
  const datos = columnas.map((c) => ({
    ...c,
    // ErrorBar recibe cuánto baja y cuánto sube desde el valor
    rango: c.pronostico ? [c.valor - c.pronostico.minimo, c.pronostico.maximo - c.valor] : undefined,
  }))

  return (
    <div className="grafico-columnas" style={{ height: alto }}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 520, height: alto }}>
        <BarChart data={datos} margin={{ top: 22, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
          <defs>
            <pattern
              id={rayado}
              width="8"
              height="8"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="5" height="8" fill="var(--primary)" />
            </pattern>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis
            dataKey="etiqueta"
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            tick={{ fill: 'var(--muted)', fontSize: 12.5 }}
          />
          <YAxis
            width={48}
            domain={[0, marcas[marcas.length - 1]]}
            ticks={marcas}
            tickFormatter={(v: number) => (v === 0 ? '0' : formatoEje(v))}
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--muted)', fontSize: 12.5 }}
          />
          {referencia && (
            <ReferenceLine
              y={referencia.valor}
              stroke="var(--err)"
              strokeWidth={2}
              strokeDasharray="6 4"
              // Encima de la línea, a la izquierda, con un borde del color de la tarjeta para que se lea
              // aunque cruce el valor de una columna (mockup 10: .min span con fondo de superficie)
              label={({ viewBox }) => {
                const { x = 0, y = 0 } = viewBox as { x?: number; y?: number }
                return (
                  <text
                    x={x + 6}
                    y={y - 6}
                    fontSize={12}
                    fill="var(--text)"
                    stroke="var(--surface)"
                    strokeWidth={4}
                    paintOrder="stroke"
                  >
                    {referencia.etiqueta}
                  </text>
                )
              }}
            />
          )}
          <Tooltip
            cursor={{ fill: 'var(--surface-2)' }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              const c = active ? (payload?.[0]?.payload as Columna | undefined) : undefined
              if (!c) return null
              return (
                <div className="grafico-tip">
                  <b>{c.etiquetaLarga}</b>
                  <span>
                    {formato(c.valor)}
                    {c.pronostico && ` (${formato(c.pronostico.minimo)} a ${formato(c.pronostico.maximo)})`}
                  </span>
                </div>
              )
            }}
          />
          <Bar dataKey="valor" maxBarSize={30} radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {datos.map((c) => (
              <Cell
                key={c.clave}
                fill={c.pronostico || c.enCurso ? `url(#${rayado})` : 'var(--primary)'}
                stroke={c.pronostico || c.enCurso ? 'var(--primary)' : undefined}
                strokeWidth={c.pronostico || c.enCurso ? 2 : 0}
              />
            ))}
            <LabelList
              dataKey="valor"
              position="top"
              content={({ x, y, width, value, index }) =>
                index !== undefined && !datos[index]?.pronostico ? (
                  <text
                    x={Number(x) + Number(width) / 2}
                    y={Number(y) - 6}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={600}
                    fill="var(--text)"
                  >
                    {etiquetaValor
                      ? etiquetaValor(Number(value))
                      : formato(Number(value)).replace(/\s.*$/, '')}
                  </text>
                ) : null
              }
            />
            <ErrorBar dataKey="rango" width={14} stroke="var(--text)" strokeWidth={2} direction="y" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
