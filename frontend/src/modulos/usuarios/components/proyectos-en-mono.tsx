/** Códigos de proyecto en Plex Mono, unidos como en el mockup: "FIS-008 y FIS-010". */
export function ProyectosEnMono({ codigos }: { codigos: string[] }) {
  return (
    <>
      {codigos.map((c, i) => (
        <span key={c}>
          {i > 0 && (i === codigos.length - 1 ? ' y ' : ', ')}
          <span className="mono codigo">{c}</span>
        </span>
      ))}
    </>
  )
}
