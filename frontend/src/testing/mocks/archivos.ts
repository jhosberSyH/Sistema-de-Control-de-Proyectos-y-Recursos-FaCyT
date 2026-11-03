/*
 * Archivos de los reportes (F8.2 a F8.4) armados en los mocks: un PDF de texto y un Excel (.xlsx) de
 * una hoja, con los datos y los filtros de la consulta. Bastan para probar la descarga; el formato final
 * (logos, tablas con bordes, varias hojas) lo genera el backend con sus bibliotecas.
 */

export type Columna = { titulo: string; formato: 'texto' | 'moneda' | 'porcentaje' | 'numero'; ancho: number }

export type Tabla = {
  /** Título sobre la tabla; la primera no lleva. */
  titulo?: string
  columnas: Columna[]
  /** Valores crudos: los números van como número para que el Excel los sume. */
  filas: (string | number)[][]
}

/** Lo que lleva un reporte: título, líneas de filtros, tablas y nota al pie. */
export type Hoja = { titulo: string; lineas: string[]; tablas: Tabla[]; nota: string | null }

const fmt2 = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt1 = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const fmt0 = new Intl.NumberFormat('es-VE', { maximumFractionDigits: 1 })

/** Un valor como se lee en el PDF y en la vista previa: "3.150,00", "32,6 %". */
export function texto(v: string | number, formato: Columna['formato']) {
  if (typeof v === 'string') return v
  if (formato === 'moneda') return fmt2.format(v)
  if (formato === 'porcentaje') return `${fmt1.format(v)} %`
  return fmt0.format(v)
}

// ---------------------------------------------------------------- PDF

/** Caracteres fuera de Latin-1 que WinAnsiEncoding sí tiene, o su equivalente. */
const WIN_ANSI: Record<string, string> = {
  '—': '\x97',
  '–': '\x96',
  '…': '\x85',
  '−': '-',
  '“': '"',
  '”': '"',
}

function pdfTexto(s: string) {
  return [...s]
    .map((c) => WIN_ANSI[c] ?? (c.charCodeAt(0) <= 255 ? c : '?'))
    .join('')
    .replace(/[\\()]/g, (c) => `\\${c}`)
}

/** Anchos de Helvetica (milésimas) de los caracteres de las cifras, para alinearlas a la derecha. */
const ANCHO: Record<string, number> = { '.': 278, ',': 278, ' ': 278, '%': 889, '-': 333, U: 722, S: 667 }
const anchoDe = (s: string, tam: number) => ([...s].reduce((t, c) => t + (ANCHO[c] ?? 556), 0) * tam) / 1000

export function pdf(h: Hoja): { bytes: Uint8Array; paginas: number } {
  const X0 = 50
  const t = (x: number, y: number, s: string, tam = 9, negrita = false) =>
    `BT /${negrita ? 'F2' : 'F1'} ${tam} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${pdfTexto(s)}) Tj ET\n`

  const encabezado = () =>
    t(X0, 752, 'Universidad de Carabobo · FaCyT', 11, true) +
    t(X0, 740, 'Facultad Experimental de Ciencias y Tecnología · Control de Proyectos y Recursos', 8.5) +
    // Doble filete del mockup: primario y acento
    '0 0.227 0.416 RG 2 w 50 730 m 562 730 l S 0 0.573 0.816 RG 1 w 50 727 m 562 727 l S 0 0 0 RG\n'

  /** Posición y ancho de cada columna en los 512 puntos útiles de la página. */
  const medidas = (columnas: Columna[]) => {
    const total = columnas.reduce((s, c) => s + c.ancho, 0)
    let x = X0
    return columnas.map((c) => {
      const m = { x, ancho: (c.ancho / total) * 512 }
      x += m.ancho
      return m
    })
  }
  const celda = (c: Columna, m: { x: number; ancho: number }, y: number, s: string, negrita = false) =>
    c.formato === 'texto'
      ? t(m.x, y, s, 9, negrita)
      : t(m.x + m.ancho - anchoDe(s, 9) * (negrita ? 1.05 : 1), y, s, 9, negrita)

  // Páginas: la primera lleva título y filtros; cada tabla repite su cabecera al pasar de página
  const paginas: string[] = []
  let actual = encabezado()
  let y = 700
  actual += t(X0, y, h.titulo, 16, true)
  y -= 22
  for (const l of h.lineas) {
    actual += t(X0, y, l, 9.5)
    y -= 14
  }
  y -= 10
  const nueva = () => {
    paginas.push(actual)
    actual = encabezado()
    y = 700
  }
  for (const tabla of h.tablas) {
    const m = medidas(tabla.columnas)
    const cabecera = () => {
      actual +=
        tabla.columnas.map((c, i) => celda(c, m[i], y, c.titulo, true)).join('') +
        `0.85 0.85 0.85 RG 0.5 w 50 ${y - 5} m 562 ${y - 5} l S 0 0 0 RG\n`
      y -= 18
    }
    if (y < 130) nueva()
    if (tabla.titulo) {
      actual += t(X0, y, tabla.titulo, 11, true)
      y -= 18
    }
    cabecera()
    for (const f of tabla.filas) {
      if (y < 90) {
        nueva()
        cabecera()
      }
      actual += f
        .map((v, i) => celda(tabla.columnas[i], m[i], y, texto(v, tabla.columnas[i].formato)))
        .join('')
      y -= 15
    }
    y -= 16
  }
  if (h.nota) {
    if (y < 100) nueva()
    actual += t(X0, y, h.nota, 8.5)
  }
  paginas.push(actual)

  const objetos: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${paginas.map((_, i) => `${5 + i * 2} 0 R`).join(' ')}] /Count ${paginas.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ]
  paginas.forEach((contenido, i) => {
    const pie = t(X0, 50, `Documento generado por el sistema. Página ${i + 1} de ${paginas.length}.`, 8)
    const flujo = contenido + pie
    objetos.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`,
      `<< /Length ${flujo.length} >>\nstream\n${flujo}endstream`,
    )
  })

  let salida = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'
  const posiciones: number[] = []
  objetos.forEach((o, i) => {
    posiciones.push(salida.length)
    salida += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = salida.length
  salida += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`
  salida += posiciones.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')
  salida += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return { bytes: Uint8Array.from(salida, (c) => c.charCodeAt(0)), paginas: paginas.length }
}

// ---------------------------------------------------------------- Excel

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(datos: Uint8Array) {
  let c = 0xffffffff
  for (const b of datos) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** ZIP sin compresión (método "store"): lo que necesita un .xlsx para abrirse. */
function zip(archivos: { nombre: string; contenido: string }[]) {
  const codificador = new TextEncoder()
  const partes: Uint8Array[] = []
  const central: Uint8Array[] = []
  let desplazamiento = 0
  for (const a of archivos) {
    const nombre = codificador.encode(a.nombre)
    const datos = codificador.encode(a.contenido)
    const crc = crc32(datos)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, datos.length, true)
    local.setUint32(22, datos.length, true)
    local.setUint16(26, nombre.length, true)
    partes.push(new Uint8Array(local.buffer), nombre, datos)
    const dir = new DataView(new ArrayBuffer(46))
    dir.setUint32(0, 0x02014b50, true)
    dir.setUint16(4, 20, true)
    dir.setUint16(6, 20, true)
    dir.setUint32(16, crc, true)
    dir.setUint32(20, datos.length, true)
    dir.setUint32(24, datos.length, true)
    dir.setUint16(28, nombre.length, true)
    dir.setUint32(42, desplazamiento, true)
    central.push(new Uint8Array(dir.buffer), nombre)
    desplazamiento += 30 + nombre.length + datos.length
  }
  const tamCentral = central.reduce((t, p) => t + p.length, 0)
  const fin = new DataView(new ArrayBuffer(22))
  fin.setUint32(0, 0x06054b50, true)
  fin.setUint16(8, archivos.length, true)
  fin.setUint16(10, archivos.length, true)
  fin.setUint32(12, tamCentral, true)
  fin.setUint32(16, desplazamiento, true)
  const todo = [...partes, ...central, new Uint8Array(fin.buffer)]
  const salida = new Uint8Array(todo.reduce((t, p) => t + p.length, 0))
  todo.reduce((pos, p) => {
    salida.set(p, pos)
    return pos + p.length
  }, 0)
  return salida
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const columnaExcel = (i: number) => String.fromCharCode(65 + i)

export function xlsx(h: Hoja): Uint8Array {
  // Estilos: 0 normal, 1 monto (#,##0.00), 2 negrita
  type Celda = { v: string | number; s?: 1 | 2 }
  const filas: Celda[][] = [[{ v: h.titulo, s: 2 }], ...h.lineas.map((l) => [{ v: l }])]
  for (const tabla of h.tablas) {
    filas.push([])
    if (tabla.titulo) filas.push([{ v: tabla.titulo, s: 2 }])
    filas.push(tabla.columnas.map((c) => ({ v: c.titulo, s: 2 as const })))
    for (const f of tabla.filas) {
      filas.push(
        f.map((v, i) => ({
          v,
          s: tabla.columnas[i].formato === 'moneda' && typeof v === 'number' ? (1 as const) : undefined,
        })),
      )
    }
  }
  if (h.nota) filas.push([], [{ v: h.nota }])
  const hoja = filas
    .map(
      (f, r) =>
        `<row r="${r + 1}">${f
          .map((c, i) => {
            const ref = `${columnaExcel(i)}${r + 1}`
            const s = c.s ? ` s="${c.s}"` : ''
            return typeof c.v === 'number'
              ? `<c r="${ref}"${s}><v>${c.v}</v></c>`
              : `<c r="${ref}" t="inlineStr"${s}><is><t>${xml(c.v)}</t></is></c>`
          })
          .join('')}</row>`,
    )
    .join('')
  const anchos = h.tablas[0].columnas
    .map(
      (c, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.max(12, c.ancho / 2)}" customWidth="1"/>`,
    )
    .join('')
  return zip([
    {
      nombre: '[Content_Types].xml',
      contenido:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    },
    {
      nombre: '_rels/.rels',
      contenido:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    },
    {
      nombre: 'xl/workbook.xml',
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(h.titulo.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      nombre: 'xl/_rels/workbook.xml.rels',
      contenido:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    },
    {
      nombre: 'xl/styles.xml',
      contenido:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf/><xf numFmtId="4" applyNumberFormat="1"/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>',
    },
    {
      nombre: 'xl/worksheets/sheet1.xml',
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${anchos}</cols><sheetData>${hoja}</sheetData></worksheet>`,
    },
  ])
}
