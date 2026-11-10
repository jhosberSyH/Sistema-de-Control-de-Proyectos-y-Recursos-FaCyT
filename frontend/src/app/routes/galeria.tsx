import { useState, type ReactNode } from 'react'
import { AvisoSesion } from '@/components/layout/aviso-sesion'
import { Icono } from '@/components/icono'
import { Aviso } from '@/components/ui/aviso'
import { Boton } from '@/components/ui/boton'
import { AreaTexto, Campo, Clave, Entrada, EntradaPrefijo, Selector } from '@/components/ui/campo'
import { Dialogo, DialogoAlerta } from '@/components/ui/dialogo'
import { EncabezadoPagina } from '@/components/ui/encabezado-pagina'
import { ChipEstado, ChipPrioridad } from '@/components/ui/estado'
import { Cargando, ErrorCarga, EstadoVacio } from '@/components/ui/estados-vista'
import { Contador, Lista, ListaClaveValor, ListaPendientes } from '@/components/ui/listas'
import { OpcionesTarjeta } from '@/components/ui/opciones'
import { Pestanas } from '@/components/ui/pestanas'
import { BarraProgreso, MiniBarra } from '@/components/ui/progreso'
import { Paginacion, TablaDatos } from '@/components/ui/tabla'
import { Bloque, Tarjeta } from '@/components/ui/tarjeta'

/*
 * Galería de los componentes compartidos, solo en desarrollo (no existe en el build de producción).
 * Sirve para revisar el paso 1 del plan contra los mockups. Los textos de ejemplo son fijos de esta
 * página de revisión y no salen de ningún dato del sistema.
 */

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Bloque titulo={titulo}>
      <div className="galeria-seccion">{children}</div>
    </Bloque>
  )
}

export function Galeria() {
  const [dialogo, setDialogo] = useState(false)
  const [alerta, setAlerta] = useState(false)
  const [sesion, setSesion] = useState<number | null>(null)
  const [prioridad, setPrioridad] = useState<'Crítica' | 'Alta' | 'Media' | 'Baja'>('Alta')
  const [pagina, setPagina] = useState(1)

  return (
    <>
      <EncabezadoPagina
        migas={[{ texto: 'Desarrollo' }, { texto: 'Componentes' }]}
        titulo="Componentes compartidos"
        subtitulo="Paso 1 del plan del frontend. Compara cada pieza con docs/mockups/_fuente/compartido."
        acciones={
          <>
            <Boton variante="sec">
              <Icono nombre="descarga" />
              Secundario
            </Boton>
            <Boton variante="pri">
              <Icono nombre="mas" />
              Primario
            </Boton>
          </>
        }
      />

      <Seccion titulo="Botones">
        <div className="galeria-fila">
          <Boton variante="pri">Primario</Boton>
          <Boton variante="sec">Secundario</Boton>
          <Boton variante="txt">Texto</Boton>
          <Boton variante="peligro">Peligro</Boton>
          <Boton variante="pri" disabled>
            Desactivado
          </Boton>
          <Boton variante="sec" chico>
            Chico
          </Boton>
        </div>
      </Seccion>

      <Seccion titulo="Campos">
        <div className="form-rejilla">
          <Campo etiqueta="Nombre" ayuda="Texto de ayuda bajo el campo.">
            {(c) => <Entrada {...c} defaultValue="Síntesis verde de nanopartículas de plata" />}
          </Campo>
          <Campo
            etiqueta="Código institucional"
            error="Ya existe un proyecto con ese código. Usa otro código o abre ese proyecto."
          >
            {(c) => <Entrada {...c} className="mono" defaultValue="QUI-024" />}
          </Campo>
          <Campo etiqueta="Área">
            {(c) => (
              <Selector {...c}>
                <option>Química</option>
                <option>Física</option>
                <option>Biología</option>
              </Selector>
            )}
          </Campo>
          <Campo etiqueta="Presupuesto asignado" ayuda="Mayor que cero.">
            {(c) => (
              <EntradaPrefijo
                {...c}
                prefijo="US$"
                className="num"
                inputMode="decimal"
                defaultValue="9.500,00"
              />
            )}
          </Campo>
          <Campo etiqueta="Contraseña">{(c) => <Clave {...c} defaultValue="Demo2026*" />}</Campo>
          <Campo etiqueta="Observaciones" opcional className="ancho">
            {(c) => <AreaTexto {...c} />}
          </Campo>
          <div className="ancho">
            <OpcionesTarjeta
              leyenda="Prioridad"
              opciones={(['Crítica', 'Alta', 'Media', 'Baja'] as const).map((p) => ({
                valor: p,
                etiqueta: p,
              }))}
              valor={prioridad}
              alCambiar={setPrioridad}
            />
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Estados, prioridad y progreso">
        <div className="galeria-fila">
          <ChipEstado tipo="ok">En ejecución</ChipEstado>
          <ChipEstado tipo="warn">Pendiente de Aprobación</ChipEstado>
          <ChipEstado tipo="err">Rechazado</ChipEstado>
          <ChipEstado tipo="info">Finalizado</ChipEstado>
          <ChipEstado tipo="neutro">Borrador</ChipEstado>
        </div>
        <div className="galeria-fila">
          <ChipPrioridad prioridad="Crítica" />
          <ChipPrioridad prioridad="Alta" />
          <ChipPrioridad prioridad="Media" />
          <ChipPrioridad prioridad="Baja" />
        </div>
        <div style={{ display: 'grid', gap: 10, maxWidth: 360 }}>
          <BarraProgreso valor={62} etiqueta="Avance de ejemplo" />
          <BarraProgreso valor={104} etiqueta="Ejecución de ejemplo" alto />
          <MiniBarra valor={48} etiqueta="Ejecución de ejemplo" />
        </div>
      </Seccion>

      <Seccion titulo="Avisos">
        <Aviso tipo="info">Información: el lote sugerido es el que vence primero.</Aviso>
        <Aviso tipo="warn">
          Advertencia: la cantidad supera el stock disponible, pero puedes guardar el borrador.
        </Aviso>
        <Aviso tipo="err">Error: faltan 2 datos. Complétalos para enviar la solicitud.</Aviso>
        <Aviso tipo="ok">Listo: la solicitud quedó aprobada.</Aviso>
      </Seccion>

      <Seccion titulo="Tabla y paginación">
        <TablaDatos titulo="Tabla de ejemplo" apilable>
          <thead>
            <tr>
              <th scope="col">Código</th>
              <th scope="col">Nombre</th>
              <th scope="col">Estatus</th>
              <th scope="col" className="n">
                Presupuesto
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="mono" data-e="Código">
                QUI-024
              </td>
              <td data-e="Nombre">Síntesis de catalizadores de óxido de cerio</td>
              <td data-e="Estatus">
                <ChipEstado tipo="ok">En ejecución</ChipEstado>
              </td>
              <td className="n" data-e="Presupuesto">
                US$ 10.000,00
              </td>
            </tr>
            <tr>
              <td className="mono" data-e="Código">
                FIS-008
              </td>
              <td data-e="Nombre">Caracterización de películas delgadas</td>
              <td data-e="Estatus">
                <ChipEstado tipo="warn">Suspendido</ChipEstado>
              </td>
              <td className="n" data-e="Presupuesto">
                US$ 6.200,00
              </td>
            </tr>
          </tbody>
        </TablaDatos>
        <Paginacion pagina={pagina} paginas={3} alCambiar={setPagina} resumen="2 de 6 filas de ejemplo" />
      </Seccion>

      <Seccion titulo="Pestañas">
        <Pestanas
          etiqueta="Pestañas de ejemplo"
          pestanas={[
            { valor: 'resumen', etiqueta: 'Resumen', contenido: <p>Contenido de la primera pestaña.</p> },
            { valor: 'gastos', etiqueta: 'Gastos', contenido: <p>Contenido de la segunda pestaña.</p> },
            { valor: 'historial', etiqueta: 'Historial', contenido: <p>Contenido de la tercera pestaña.</p> },
          ]}
        />
      </Seccion>

      <div className="rejilla">
        <div className="col">
          <Seccion titulo="Listas">
            <ListaPendientes
              items={[
                {
                  id: '1',
                  tipo: 'warn',
                  icono: 'reloj',
                  titulo: 'Pendiente de ejemplo',
                  detalle: 'Detalle del pendiente.',
                  accion: { texto: 'Revisar', a: '/componentes', primaria: true },
                },
                { id: '2', tipo: 'ok', icono: 'ok', titulo: 'Otro pendiente', detalle: 'Ya resuelto.' },
              ]}
            />
            <Lista
              items={[
                {
                  id: 'a',
                  principal: 'Elemento',
                  secundario: 'Línea secundaria',
                  derecha: <ChipEstado tipo="ok">Aprobada</ChipEstado>,
                },
                {
                  id: 'b',
                  principal: 'Otro elemento',
                  secundario: 'Otra línea',
                  derecha: <ChipEstado tipo="warn">Pendiente</ChipEstado>,
                },
              ]}
            />
          </Seccion>
        </div>
        <div className="col">
          <Seccion titulo="Clave y valor">
            <ListaClaveValor
              datos={[
                { clave: 'Proyecto', valor: <span className="mono">QUI-024</span> },
                { clave: 'Monto', valor: 'US$ 640,00' },
                { clave: 'Pedido el', valor: '26/10/2026' },
              ]}
            />
          </Seccion>
          <div className="contadores" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <Contador valor={9} etiqueta="Por decidir" a="/componentes" />
            <Contador valor={2} etiqueta="Por despachar" a="/componentes" />
          </div>
        </div>
      </div>

      <Seccion titulo="Diálogos">
        <div className="galeria-fila">
          <Boton onClick={() => setDialogo(true)}>Abrir diálogo</Boton>
          <Boton variante="peligro" onClick={() => setAlerta(true)}>
            Abrir confirmación
          </Boton>
          <Boton onClick={() => setSesion(118)}>Probar aviso de sesión por expirar</Boton>
        </div>
        <Dialogo
          abierto={dialogo}
          alCambiar={setDialogo}
          titulo="Diálogo de ejemplo"
          descripcion="Línea secundaria del diálogo."
          alEnviar={(e) => {
            e.preventDefault()
            setDialogo(false)
          }}
        >
          <Campo etiqueta="Motivo">{(c) => <AreaTexto {...c} />}</Campo>
          <div className="acc-form">
            <Boton onClick={() => setDialogo(false)}>Cancelar</Boton>
            <Boton variante="pri" type="submit">
              Guardar
            </Boton>
          </div>
        </Dialogo>
        <DialogoAlerta
          abierto={alerta}
          alCambiar={setAlerta}
          titulo="¿Confirmar la acción de ejemplo?"
          descripcion="Esto es lo que pasa al confirmar."
          confirmar="Confirmar"
          peligro
          alConfirmar={() => setAlerta(false)}
        />
        <AvisoSesion restante={sesion} alSeguir={() => setSesion(null)} alSalir={() => setSesion(null)} />
      </Seccion>

      <Seccion titulo="Estados de la vista">
        <EstadoVacio titulo="Sin historial suficiente para pronosticar">
          Explica por qué no hay datos y qué hacer.
        </EstadoVacio>
        <ErrorCarga
          mensaje="No pudimos cargar los datos. Revisa tu conexión e inténtalo de nuevo."
          alReintentar={() => undefined}
        />
        <Tarjeta style={{ padding: 20 }}>
          <Cargando />
        </Tarjeta>
      </Seccion>
    </>
  )
}
