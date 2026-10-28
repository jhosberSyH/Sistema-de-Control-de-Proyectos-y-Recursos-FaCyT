# Investigación de usuarios, accesibilidad y personalidad del aplicativo

Fecha de la investigación: 27 de octubre de 2026.

Este documento complementa a [investigacion_ux.md](investigacion_ux.md). Aquel estudia los productos de referencia (NEMO, eLabFTW, ERPNext); este estudia a las personas que van a usar el sistema en la FaCyT de la Universidad de Carabobo: desde qué equipos entran, con qué conexión, qué esperan, qué les cuesta y qué necesitan en accesibilidad. De ahí salen la personalidad del aplicativo, los criterios de accesibilidad y las implicaciones U1 a U14, que se suman a las lecciones L1 a L10.

## Método

- **Fuentes revisadas:**
  - Cifras oficiales y de mercado: CONATEL (IV trimestre de 2024), StatCounter (septiembre de 2026), DataReportal (Digital 2026, con datos de Ookla y GSMA Intelligence).
  - ONG y observatorios venezolanos: VE sin Filtro, Observatorio Venezolano de Servicios Públicos (OVSP), Observatorio del Gasto Público de Cedice, Consultores 21 (vía prensa), Freedom House.
  - Estudios académicos sobre universidades venezolanas y latinoamericanas (Encuentro Educacional, Utopía y Praxis Latinoamericana, Springer LNCS y CCIS).
  - Normas y guías: WCAG 2.2 del W3C, Apple Human Interface Guidelines, Google Accessibility (Android), U.S. Web Design System, MDN, Nielsen Norman Group, guía de estilo de Microsoft para español, guía de Mercado Pago.
  - Legislación: Ley Orgánica para la Inclusión, Igualdad y Desarrollo Integral de las Personas con Discapacidad (Gaceta Oficial N.° 6.817 Extraordinario, 2024).
  - Salud: OMS, National Eye Institute (NEI) y una revisión de 2025 sobre daltonismo.
- **Etiquetas de cada hallazgo:**
  - **[DATO]**: cifra medida por un organismo, un observatorio o una herramienta de analítica.
  - **[ESTUDIO]**: resultado de una investigación académica o de una encuesta con método publicado.
  - **[GUÍA]**: recomendación de una norma, una guía de diseño o una ley.
  - **[SUPUESTO]**: rasgo que no pudimos respaldar con una fuente. Se marca para validarlo con usuarios reales.
- **Citas:** van textuales en el idioma original, con su traducción si no están en español.
- **Cómo leer las cifras:** StatCounter mide páginas vistas en los sitios que tienen su código, no personas. CONATEL publica cifras preliminares y cuenta suscripciones, no usuarios únicos. Las encuestas de Flores Nessi y Romero Matos (2021) y del OVSP (2020) son de la pandemia; las usamos porque no encontramos encuestas más recientes de universitarios venezolanos, y lo indicamos cada vez.
- **Lectura de PDF:** los PDF de CONATEL, VE sin Filtro, la Gaceta Oficial, Encuentro Educacional, EDUCAUSE y Microsoft se descargaron y se extrajo su texto localmente, porque la herramienta web no los podía leer. Las cifras que en esos PDF solo están dentro de gráficos (imágenes) no se usaron.

### Fuentes que fallaron

| Fuente | Qué pasó |
|---|---|
| StatCounter, varias vistas de Venezuela | El buscador mostró instantáneas de junio y agosto de 2026 con mayoría de escritorio (75 % a 88 %) que contradicen la vista actual. Al abrir las páginas, todas dieron septiembre de 2026 con mayoría móvil (70 %). Solo usamos la cifra que pudimos abrir |
| Speedtest Global Index (speedtest.net) | La herramienta no tiene acceso al sitio. Las velocidades salen de DataReportal, que cita datos de Ookla |
| ResearchGate, "Educación a distancia en las universidades venezolanas ante la pandemia COVID-19" | Error 403. No se usa |
| La Patilla (OVSP, enero de 2024) | Error 403. La misma encuesta se leyó en NTN24 |
| PubMed 40769301 (metaanálisis de daltonismo, *Ophthalmology*, 2025) | Página de verificación reCAPTCHA. No se usa |
| UN DESA, texto de la Ley para las Personas con Discapacidad de 2007 | Error 403. Esa ley quedó derogada en 2024; se usó la ley vigente desde la Gaceta |
| Apple Human Interface Guidelines y Material Design 3 (páginas HTML) | Se renderizan con JavaScript y llegan vacías. Apple se leyó desde su JSON público; para Android se usó la ayuda de accesibilidad de Google |
| uc.edu.ve | Conexión cerrada por el servidor. Se usó facyt.uc.edu.ve |
| EDUCAUSE (library.educause.edu) | Error 403. Se leyó una copia del mismo informe alojada por ACCJC |
| University of Iowa EHS (uso del teléfono en el laboratorio) y redi.cedia.edu.ec 80237 | Error 404 |

**Buscado sin resultado verificable:** datos de conectividad o equipos de la ENCOVI 2024; encuestas del OVSP de 2024 a 2026 con cifras de Valencia; una encuesta cuantitativa de estudiantes de la UC sobre dispositivos; un estudio sobre alfabetización digital del personal administrativo de universidades venezolanas; el manual de identidad gráfica de la UC. Donde esos datos harían falta, el documento lo dice y marca el rasgo como [SUPUESTO].

---

## 1. Quiénes son los usuarios

### 1.1 Roles del sistema y población universitaria

| Rol del sistema | Quién lo ocupa en la FaCyT | Población universitaria | Qué hace con más frecuencia |
|---|---|---|---|
| Coordinador de Proyecto | Docente-investigador o estudiante de postgrado (tesista) que coordina un proyecto de física, química o biología | Docentes-investigadores y estudiantes | Consultar el estado de sus solicitudes, reservar equipos, registrar uso de materia prima y avance de hitos, confirmar cargos antes del cierre |
| Aprobador / Gestor de Inventario | Personal administrativo o técnico de laboratorio | Personal administrativo y técnico | Revisar la bandeja de pendientes, aprobar o rechazar, recibir y despachar lotes, cerrar el período y ejecutar el prorrateo |
| Administrador del Sistema | Personal administrativo con perfil técnico, o un docente con encargo administrativo [SUPUESTO] | Personal administrativo y técnico | Gestionar usuarios y catálogos, registrar proyectos, consultar el dashboard y la auditoría |

**Contexto de la facultad [DATO].** La FaCyT tiene departamentos y licenciaturas de Química, Computación, Física, Matemáticas y Biología, y entre sus postgrados figura un Doctorado en Química Tecnológica (sitio web de la FaCyT). Es decir, hay tesistas de postgrado que pueden coordinar proyectos de laboratorio.

**Lo que dice la evidencia de cada grupo:**

- **Estudiantes.** En una encuesta a 80 estudiantes y 40 docentes de la Universidad Politécnica Territorial del Zulia, el 83 % de los estudiantes tenía un teléfono Android, ninguno un iPhone, el 6 % un teléfono básico y el 11 % ningún teléfono. El 68 % usaba el smartphone como "principal medio de acceso a internet"; el 48 % se conectaba desde su casa, el 31 % gracias a "un amigo o vecino que le suministra conexión o Wifi" y el 18 % no tenía internet (Flores Nessi y Romero Matos, 2021) [ESTUDIO, pandemia].
- **Docentes-investigadores.** En la misma encuesta, el 88 % de los docentes tenía Android y el 3 % iOS; el 78 % usaba el smartphone como acceso principal y el 65 % se conectaba desde su casa [ESTUDIO, pandemia]. Meleán Romero y Contreras Bustamante (2020) describen los recursos de los docentes universitarios venezolanos como "escasos y en el mejor de los casos obsoletos" y señalan la "necesidad de actualización de competencias TIC de sus docentes" [ESTUDIO cualitativo]. Un docente entrevistado por El Diario en 2023 dice que su sueldo "no llega a 50 dólares mensuales" [DATO periodístico], lo que hace improbable que renueven sus equipos personales con frecuencia [SUPUESTO].
- **Personal administrativo y técnico.** No encontramos estudios sobre sus competencias digitales en universidades venezolanas. Por analogía usamos dos hallazgos ya citados en investigacion_ux.md: en Chimote et al. (2022) el personal "did not recognize some of the capabilities" (no reconoció algunas funciones) del sistema nuevo y los autores recomiendan un entorno de pruebas; en LIME (2026) las hojas de cálculo recibían datos incorrectos de "inexperienced users" (usuarios sin experiencia) [ESTUDIO, otros países]. Hoy la organización lleva el control en hojas de cálculo (README §1), así que ese es su modelo mental de partida [DATO del proyecto].

### 1.2 Proto-personas

Son proto-personas: hipótesis basadas en fuentes secundarias, no en entrevistas. Cada rasgo lleva su respaldo o la marca [SUPUESTO]. Los nombres son ficticios.

#### Daniela, Coordinadora de Proyecto (tesista de postgrado)

> "Quiero saber si me aprobaron el retiro del solvente sin tener que bajar al almacén a preguntar."

| Rasgo | Respaldo |
|---|---|
| 27 años, cursa el Doctorado en Química Tecnológica y coordina un proyecto de su línea de investigación | Programa existente en la FaCyT [DATO]; edad [SUPUESTO] |
| Su acceso principal a internet es un Android de gama media | 83 % de estudiantes con Android y 68 % con el smartphone como acceso principal (Flores Nessi y Romero Matos, 2021) [ESTUDIO]; Android es el 93,43 % del tráfico móvil en Venezuela (StatCounter, sept. 2026) [DATO] |
| Su teléfono no es nuevo: corre Android 11, 12 o 13 | Esas tres versiones suman 44,33 % del tráfico Android en Venezuela (StatCounter, sept. 2026) [DATO]; que sea su caso [SUPUESTO] |
| Navega en Chrome, en una pantalla de unos 360 px de ancho | Chrome tiene el 87,05 % del tráfico; 360×806 y 360×800 son las resoluciones móviles más comunes (StatCounter, sept. 2026) [DATO] |
| Raciona los datos móviles | Diez de los trece planes de internet que cuestan menos de un salario mínimo son planes de datos móviles con límites de 50 MB a 10 GB al mes (VE sin Filtro, 2023) [DATO] |
| En casa la conexión falla; a veces usa el wifi de un vecino | 31 % de estudiantes se conecta por un amigo o vecino (Flores Nessi y Romero Matos, 2021) [ESTUDIO]; en Valencia, 60,3 % estaba insatisfecho con su internet fijo (OVSP, 2020) [DATO] |
| En el laboratorio trabaja con guantes y no toca el teléfono hasta quitárselos | Norma de Warwick: "You must never handle a mobile phone or other personal electronic device whilst wearing lab gloves" (nunca manipules un teléfono con guantes de laboratorio) [GUÍA]; que la FaCyT aplique una norma igual [SUPUESTO] |
| Usa una laptop para la tesis y para revisar reportes | [SUPUESTO] |
| Ya usa Google Drive para su trabajo académico | 74 % de los estudiantes lo usa (Flores Nessi y Romero Matos, 2021) [ESTUDIO] |
| Le frustra perder lo que escribió cuando se va la luz | Más del 54 % de los encuestados del OVSP pasó a tener cortes diarios, el 69 % de 2 a 6 horas (NTN24, enero de 2024) [DATO]; la frustración [SUPUESTO] |

#### Carmen, Aprobadora / Gestora de Inventario (técnica de laboratorio)

> "Si apruebo algo por error, después no hay cómo deshacerlo. Prefiero que el sistema me pregunte."

| Rasgo | Respaldo |
|---|---|
| 48 años, técnica a cargo del almacén de reactivos de la facultad | Rol del sistema (README §3) [DATO del proyecto]; edad [SUPUESTO] |
| Trabaja en un PC de escritorio de la facultad, con varios años de uso | Recursos tecnológicos universitarios "escasos y en el mejor de los casos obsoletos" (Meleán Romero y Contreras Bustamante, 2020) [ESTUDIO]; su equipo concreto [SUPUESTO] |
| Los cortes de luz la interrumpen en plena jornada | 68 % de 2.300 encuestados dice que los cortes ocurren sobre todo en "horas aprovechables del día" (Cedice, enero de 2025) [DATO] |
| Domina las hojas de cálculo con las que hoy lleva el control | README §1 [DATO del proyecto] |
| Aprende un sistema nuevo usándolo y no descubre solas las funciones que no ve | Chimote et al. (2022) [ESTUDIO, otro país]; su caso [SUPUESTO] |
| Lee mejor con texto grande y buen contraste | La presbicia es la principal causa de deficiencia de la visión de cerca, con 826 millones de personas (OMS, 2026) [DATO]; que ella la tenga [SUPUESTO] |
| Le preocupa aprobar por accidente | "it's easy to accidentally click on one of these actions… There's no confirmation prompt" (es fácil hacer clic por accidente; no hay confirmación), foro de Frappe, citado en investigacion_ux.md [ESTUDIO de referencia] |
| Revisa la bandeja desde el teléfono cuando no está en su puesto | 78 % de los docentes usa el smartphone como acceso principal (Flores Nessi y Romero Matos, 2021) [ESTUDIO]; extenderlo al personal técnico [SUPUESTO] |

#### José, Administrador del Sistema (personal administrativo con perfil técnico)

> "Necesito saber quién hizo qué y cuándo, sin pedirle a nadie que me explique."

| Rasgo | Respaldo |
|---|---|
| 38 años, analista en la administración de la facultad | [SUPUESTO] |
| Trabaja casi siempre en escritorio, con varias pestañas y tablas largas | [SUPUESTO] |
| Recibe las dudas de quienes no encuentran una función | En NEMO un investigador principal no encontraba el consumo de su proyecto porque la opción no estaba en el menú (investigacion_ux.md, L8) [ESTUDIO de referencia] |
| Responde por la trazabilidad ante la facultad | `audit_log` inmutable y consulta de auditoría global (README §3 y §5) [DATO del proyecto] |
| Conoce bien la red de la facultad y sus caídas | 86 interrupciones de conectividad registradas en 2022, el 34,88 % de los eventos por cortes eléctricos (VE sin Filtro, 2023) [DATO]; su conocimiento [SUPUESTO] |
| Usa gestor de contraseñas o pega su clave desde otro lugar | [SUPUESTO]; ver criterio 3.3.8 en §6 |

---

## 2. Desde qué dispositivos y en qué contexto entran

### 2.1 Datos de Venezuela

| Indicador | Valor | Fecha | Fuente |
|---|---|---|---|
| Tráfico web por plataforma | Móvil 69,97 %, escritorio 29,71 %, tablet 0,32 % | Sept. 2026 | StatCounter [DATO] |
| Sistema operativo móvil | Android 93,43 %, iOS 6,57 % | Sept. 2026 | StatCounter [DATO] |
| Versiones de Android | 13: 18,45 %; 16: 18,19 %; 15: 17,62 %; 12: 14,87 %; 14: 14,84 %; 11: 11,01 % | Sept. 2026 | StatCounter [DATO] |
| Navegador (todas las plataformas) | Chrome 87,05 %, Safari 3,99 %, Firefox 3,56 %, Edge 3,01 % | Sept. 2026 | StatCounter [DATO] |
| Resoluciones móviles más comunes | 360×806 (3,91 %), 360×800 (3,89 %), 1080×2400 (2,04 %), 720×1600 (1,98 %) | Sept. 2026 | StatCounter [DATO] |
| Usuarios de internet | 17,6 millones, 61,6 % de la población | Fin de 2025 | DataReportal, Digital 2026 [DATO] |
| Velocidad mediana de descarga | Móvil 25,42 Mbps; fija 92,09 Mbps | Fin de 2025 | DataReportal con datos de Ookla [DATO] |
| Suscriptores de internet | 25.200.760, incluidos los que acceden por la red móvil; 4.322.356 de internet "tradicional" (fijo), 44,586 % de ellos por fibra óptica | IV trim. 2024 | CONATEL, cifras preliminares [DATO] |
| Usuarios de internet en Carabobo | 1.936.111, cuarta entidad después de Distrito Capital, Miranda y Zulia | IV trim. 2024 | CONATEL [DATO] |
| Telefonía móvil | 61 líneas en uso por cada 100 habitantes; "un suscriptor de teléfono inteligente consume en promedio 8,95 Gigabytes" en el trimestre | IV trim. 2024 | CONATEL [DATO] |
| Hogares con internet | 48 %; 68 % se conecta por smartphone; solo el 54 % dice tener datos de navegación | Mayo 2023 | Consultores 21, vía El Diario [DATO] |
| Costo del servicio | Solo el 13,27 % de los planes cuesta menos de un salario mínimo mensual; el precio medio equivale a 6,93 salarios mínimos | 1.er trim. 2023 | VE sin Filtro [DATO] |
| Interrupciones de internet | 86 incidentes nacionales en 2022 (83 % más que en 2021); 34,88 % de los eventos por cortes eléctricos | 2022 | VE sin Filtro [DATO] |
| Cortes eléctricos | Más del 54 % pasó de cortes semanales a diarios; 69 % de 2 a 6 horas | Nov. 2023 | OVSP, vía NTN24 [DATO] |
| Horario de los cortes | 68 % dice que ocurren sobre todo en horas útiles del día; 44 % reporta daños en dos o más electrodomésticos | Ene. 2025 | Cedice, Monitor de Servicios Básicos [DATO] |
| Calidad percibida | "Power outages are regularly reported, often occurring without notice and lasting several hours at a time" (los cortes se reportan con regularidad, a menudo sin aviso y duran varias horas) | 2024 | Freedom House, *Freedom on the Net 2024* [DATO] |
| Valencia en 2020 | 60,3 % insatisfecho con su internet fijo; al menos siete de cada diez usuarios con smartphone y plan de datos | May. 2019 a abr. 2020 | OVSP, vía El Diario [DATO] |

### 2.2 Qué significa para el sistema

- **El teléfono Android con Chrome es el dispositivo de referencia.** Siete de cada diez páginas vistas en Venezuela llegan desde un móvil, casi todas desde Android y casi todas en Chrome. En la universidad, el smartphone fue el acceso principal del 68 % de los estudiantes y del 78 % de los docentes encuestados. Safari en iPhone queda como caso secundario que igual debe funcionar.
- **Los teléfonos no son nuevos.** Cerca de 44 % del tráfico Android viene de Android 11 a 13, versiones que ya tienen varios años. Hay que probar en teléfonos de gama media con poca memoria, no solo en el emulador de un equipo de desarrollo [SUPUESTO sobre la gama].
- **El ancho de diseño es 360 px.** Las resoluciones más comunes tienen 360 px CSS de ancho. El criterio de reflow de WCAG pide además que todo funcione a 320 px.
- **La conexión es aceptable en promedio y mala en los bordes.** La mediana móvil (25,42 Mbps) es mejor que la referencia global de Alex Russell para el percentil 75 (7,2 Mbps), pero la mediana deja a la mitad de los usuarios por debajo, y VE sin Filtro recuerda que la conectividad venezolana "puede describirse como intermitente". El problema no es solo la velocidad: es la conexión que se cae a mitad de una operación.
- **Los datos cuestan.** Con planes de 50 MB a 10 GB al mes, cada megabyte que descarga la aplicación lo paga el usuario.
- **Hay dos contextos de uso.** El trabajo pesado (aprobar en lote, recibir lotes, prorratear, revisar auditoría, exportar) ocurre en un escritorio de la facultad [SUPUESTO]. Las consultas rápidas (¿me aprobaron?, ¿está libre el equipo?, ¿cuánto queda de este reactivo?) ocurren en el teléfono, a menudo de pie, en el pasillo o en el laboratorio, después de quitarse los guantes.
- **Un corte puede llegar en cualquier momento.** Con cortes diarios de varias horas, casi siempre en horas útiles, la aplicación debe dar por hecho que una sesión se interrumpe sin aviso.

---

## 3. Qué esperan y qué les cuesta

### 3.1 Expectativas

| Expectativa | Respaldo |
|---|---|
| Que la tecnología de su institución esté al día. La satisfacción depende de eso | En EE. UU., el 69 % de los estudiantes está satisfecho con los servicios tecnológicos de su institución, pero la cifra sube a 85 % si ven a su institución a la vanguardia y cae a 34 % si la ven atrasada (EDUCAUSE, 2025; 6.468 encuestados de 37 instituciones) [ESTUDIO, otro país] |
| Que se vea confiable antes que simpático | La confianza predice mucho mejor que la simpatía la disposición a recomendar una marca; "casual, conversational, and moderately enthusiastic tones performed best" (los tonos casuales, conversacionales y moderadamente entusiastas funcionaron mejor) y "Serious doesn't necessarily have to be cold and formal" (serio no tiene por qué ser frío y formal) (Moran, NN/g) [ESTUDIO] |
| Que funcione bien en el teléfono | Smartphone como acceso principal (Flores Nessi y Romero Matos, 2021) [ESTUDIO]; tráfico mayoritariamente móvil (StatCounter) [DATO] |
| Que se parezca a las herramientas que ya conocen | Uso de Google Drive por 74 % de estudiantes y 68 % de docentes (Flores Nessi y Romero Matos, 2021) [ESTUDIO]; hojas de cálculo como herramienta actual (README §1) [DATO del proyecto] |
| Saber en qué estado está su trámite sin preguntar | "is the customer updated on the order's status throughout the process?" (¿se informa al cliente el estado de su pedido?), Chimote et al. (2022), citado en investigacion_ux.md [ESTUDIO] |
| Llenar la información una sola vez | Smith et al. (2021): "the same information … once" (la misma información una sola vez), citado en investigacion_ux.md [ESTUDIO] |

### 3.2 Barreras y frustraciones

| Barrera | Qué pasa | Respaldo |
|---|---|---|
| Cortes de luz y de internet | La sesión se corta a mitad de un formulario o de una aprobación, y el usuario no sabe si se guardó | OVSP 2023, Cedice 2025, VE sin Filtro 2023, Freedom House 2024 [DATO]; "el mayor desafío que enfrenta la comunidad académica es lidiar con los constantes cortes del servicio eléctrico" (Flores Nessi y Romero Matos, 2021) [ESTUDIO] |
| Datos caros y limitados | Pantallas pesadas consumen el plan del mes | VE sin Filtro 2023 [DATO] |
| Equipos viejos o de gama media | Animaciones y gráficos pesados se traban | StatCounter (versiones de Android) [DATO]; Meleán Romero y Contreras Bustamante (2020) [ESTUDIO] |
| Competencias digitales desiguales | Funciones que nadie descubre, datos mal cargados | "necesidad de actualización de competencias TIC de sus docentes" (Meleán Romero y Contreras Bustamante, 2020) [ESTUDIO]; Chimote et al. (2022) y LIME (2026) [ESTUDIO, otros países] |
| Comunicación fragmentada | Los avisos se pierden en grupos de mensajería o en el correo | Al cerrar la universidad en 2020, la mayoría de los participantes "no contaban con la totalidad de los contactos telefónicos ni correo electrónico" y recurrieron a redes sociales (Flores Nessi y Romero Matos, 2021) [ESTUDIO] |
| Interfaces abrumadoras | Demasiados campos y menús en la primera pantalla | ERPNext: "in the early stages, it's just overwhelming" (al principio es abrumador); eLabFTW #6234 (investigacion_ux.md) [ESTUDIO de referencia] |
| Errores que no explican | El usuario no sabe qué corregir | Frappe 113401 y 36424 (investigacion_ux.md, L4) [ESTUDIO de referencia] |
| Manos ocupadas o con guantes | No pueden usar el teléfono durante el procedimiento | Warwick (2018) [GUÍA] |
| Sesión que expira sin aviso | Se pierde lo escrito al volver | La sesión cierra tras 30 minutos sin actividad (README §6) [DATO del proyecto]; criterio 2.2.1 de WCAG [GUÍA] |

---

## 4. Necesidades de accesibilidad

| Necesidad | Por qué importa aquí | Respaldo |
|---|---|---|
| Visión reducida y presbicia | "Globally, at least 2.2 billion people have a near or distance vision impairment" (al menos 2.200 millones de personas tienen una deficiencia de visión de cerca o de lejos); la presbicia afecta a 826 millones. Entre docentes y personal técnico habrá lectores con presbicia [SUPUESTO sobre la distribución] | OMS, 10 de febrero de 2026 [DATO] |
| Daltonismo | "About 1 in 12 men have color vision deficiency" (alrededor de 1 de cada 12 hombres); el tipo más común confunde rojo y verde, justo los colores típicos de "aprobado" y "rechazado" | NEI [DATO] |
| Daltonismo, cifra de referencia | "affects up to 8% of males and 0.5% of females of Northern European descent" (afecta hasta al 8 % de los hombres y al 0,5 % de las mujeres de ascendencia norte-europea). La revisión no trae cifras de Latinoamérica | Almustanyir, *Healthcare*, 2025 [ESTUDIO] |
| Discapacidad en general | "An estimated 1.3 billion people experience significant disability" (unos 1.300 millones de personas, 16 % de la población mundial) | OMS, 2023 [DATO] |
| Baja visión que prefiere fondo oscuro | Las personas con medios oculares turbios, como cataratas, leen mejor en modo oscuro; por eso conviene ofrecerlo en todas las pantallas | Budiu, NN/g, 2020 [ESTUDIO] |
| Trastornos vestibulares | Animaciones de escala o desplazamiento grandes "can be vestibular motion triggers" (pueden provocar malestar vestibular) | MDN, `prefers-reduced-motion` [GUÍA] |
| Uso solo con teclado o lector de pantalla | Personal que trabaja con tablas largas y usuarios de lectores de pantalla | WCAG 2.2, 2.1.1 y 4.1.3 [GUÍA] |
| Obligación legal en Venezuela | El Estado debe asegurar el acceso de las personas con discapacidad "a la información y las comunicaciones, incluidos los sistemas y las tecnologías de la información y comunicación" (art. 37) y "Promover el diseño, el desarrollo, la producción y la distribución de sistemas y tecnologías de la información y las comunicaciones accesibles en una etapa temprana" (art. 38, num. 5). El art. 30 garantiza "El derecho a cursar estudios universitarios, en equiparación e igualdad de condiciones" | Ley Orgánica para la Inclusión, Igualdad y Desarrollo Integral de las Personas con Discapacidad, G.O. N.° 6.817 Extraordinario, 27/06/2024 [GUÍA legal] |
| Situación regional | Los sitios universitarios latinoamericanos fallan sobre todo en contraste: 1.238 errores y 1.393 problemas de contraste en 50 universidades evaluadas con WCAG 2.2, el 67,23 % en el principio "Perceptible"; los autores concluyen que "accessibility barriers in university websites are primarily systemic" (las barreras son sobre todo sistémicas) | Acosta-Vargas et al., 2026 [ESTUDIO] |
| Situación regional, universidades mejor rankeadas | 434 errores de contraste, 210 textos alternativos faltantes y 262 problemas de navegación en las 20 mejores universidades de la región | Acosta-Vargas et al., 2025 [ESTUDIO] |
| Discapacidad situacional | Pantalla al sol en un pasillo, manos con guantes, conexión lenta, corte de luz. No es una discapacidad permanente, pero produce las mismas barreras | Warwick (2018) [GUÍA]; VE sin Filtro (2023) [DATO]; la analogía [SUPUESTO] |

**Alcance.** El README (§16) deja fuera la *certificación* WCAG. Los criterios de §6 son metas de diseño y de prueba del equipo, sin auditoría formal.

---

## 5. Ingeniería de personalidad del aplicativo

### 5.1 Rasgos

| Rasgo | Es | No es | Cómo se nota en la interfaz |
|---|---|---|---|
| Confiable | Muestra el estado real de cada cosa y deja rastro de cada acción | Burocrático | Estado visible en cada solicitud, historial a un clic, confirmación antes de lo irreversible, nada de pasos que no aportan |
| Claro | Dice qué pasó y qué hacer después | Simplista | Una acción principal por pantalla, mensajes con la solución, términos del dominio (lote, hito, prorrateo) explicados la primera vez |
| Sereno | Ordenado, con aire y jerarquía | Frío | Mucho espacio en blanco, poca decoración, color reservado para el estado y la acción principal |
| Preciso | Cifras exactas, fechas y unidades completas | Técnico o críptico | "Quedan 2,5 L (mínimo: 5 L)", no "stock_low: true" |
| Ligero | Carga rápido y gasta pocos datos | Recargado | Una o dos fuentes web livianas en woff2 (33 a 90 KiB, ver identidad_visual.md §3), íconos SVG, gráficos solo donde aportan, carga diferida por módulo |
| Institucional | Reconocible como de la UC | Acartonado o gubernamental | Azul de la UC en la marca y en la acción principal; sin sellos, banderas ni textos de oficio |
| Cercano | Habla de tú, con respeto | Coloquial o chistoso | Ni jerga ni chistes; los errores nunca bromean (NN/g: "do you really think they want that error message to be a joke?", ¿de verdad crees que quieren que el mensaje de error sea un chiste?) |

### 5.2 Colores

La paleta exacta (valores, tokens y pares claro/oscuro) se define en `docs/identidad-visual/identidad_visual.md`. Aquí va la dirección y sus razones.

- **Azul institucional de la UC como color primario.** Se usa para la marca, la acción principal y los enlaces. No encontramos el manual de identidad de la UC, así que el tono exacto se toma de su logotipo oficial y se documenta en identidad_visual.md.
- **Neutros para casi todo lo demás.** Grises fríos ligeramente azulados para superficies, bordes y texto secundario, para que el azul no compita. En modo oscuro, fondos casi negros pero no negro puro, y elevación con superficies un poco más claras en vez de sombras [decisión de diseño].
- **Colores de estado, siempre con ícono y texto.** WCAG 1.4.1 prohíbe que el color sea el único medio de transmitir información, y el daltonismo rojo-verde afecta a cerca de 1 de cada 12 hombres (NEI). La correspondencia es fija en todo el sistema:

| Significado | Color | Ícono (lineal) | Ejemplos |
|---|---|---|---|
| Neutro o en preparación | Gris | Lápiz o documento | Borrador, Propuesta |
| En espera de alguien | Ámbar | Reloj | Pendiente de Aprobación, lote próximo a vencer, stock cerca del mínimo |
| Positivo o completado | Verde | Marca de verificación | Aprobado, Ejecutado, En ejecución, reserva confirmada |
| Negativo o bloqueado | Rojo | Círculo con X o triángulo | Rechazado, lote vencido, stock bajo el mínimo, equipo fuera de servicio |
| Informativo | Azul | Círculo con "i" | Avisos de la bandeja, reposición automática creada |

- **Contraste en los dos temas.** Texto 4,5:1 y componentes 3:1 se verifican en claro y en oscuro, como pide Apple: "If your app supports Dark Mode, make sure to check the minimum contrast in both light and dark appearances" (si tu app tiene modo oscuro, verifica el contraste mínimo en ambos). El contraste es el error más frecuente en los sitios universitarios de la región (Acosta-Vargas et al., 2025 y 2026).
- **Modo claro por defecto, oscuro disponible.** NN/g encontró que con visión normal "light mode leads to better performance most of the time" (el modo claro rinde mejor la mayoría de las veces) y recomienda no imponer el oscuro, pero ofrecerlo en todas las pantallas y respetar la preferencia del sistema operativo (Budiu, 2020). El sistema sigue `prefers-color-scheme` y tiene un selector manual (README §6).

### 5.3 Formas

- **Radios.** Esquinas redondeadas moderadas, coherentes con el estilo Apple de RNF-03: más redondeado en contenedores grandes (tarjetas, diálogos) que en controles pequeños (campos, insignias). Los valores van en identidad_visual.md [decisión de diseño].
- **Densidad en dos modos.** Cómoda en móvil (controles de 44 px, una columna) y compacta en las tablas de escritorio del Aprobador y el Administrador, sin bajar nunca de 24×24 px por objetivo (WCAG 2.5.8).
- **Señales de clic visibles.** Un estudio de eyetracking con 71 usuarios encontró que las interfaces con señales de clic débiles tomaron 22 % más tiempo y 25 % más fijaciones; NN/g recomienda cuidado con el diseño ultraplano cuando hay "a substantial amount of potentially overwhelming content" (mucho contenido potencialmente abrumador) (Moran, 2017). Por eso el estilo Apple se aplica con botones rellenos o con borde, enlaces de color subrayados dentro del texto y campos con borde visible.
- **Iconografía lineal.** Íconos de trazo uniforme (el juego que trae shadcn/ui), siempre con etiqueta de texto en la navegación y en las acciones. Un ícono solo se permite en acciones universales (cerrar, buscar) y lleva nombre accesible.
- **Sombras.** Solo para indicar elevación: menús, diálogos y elementos flotantes. Nada de sombras decorativas en tarjetas planas.
- **Tipografía.** Una familia de Google Fonts con licencia OFL, distinta en cada versión de los mockups, autoalojada en woff2 con el subconjunto latino y la fuente del sistema como respaldo (`docs/identidad-visual/identidad_visual.md` §3). Texto base de 16 px como mínimo, según el U.S. Web Design System: "For most text, including body copy, use at least an effective size of 16px" (para la mayoría del texto, usa al menos 16 px efectivos). Apple usa 17 pt como tamaño por defecto en iOS. Interlineado de 1,5 en textos largos y líneas de 45 a 90 caracteres (USWDS).

### 5.4 Tono y voz

**Decisión: la interfaz trata al usuario de tú, con registro serio; los botones usan infinitivo y los documentos oficiales generados (PDF) van en forma impersonal.**

Por qué:

1. **En Venezuela, tú y usted marcan distancia o cercanía, solidaridad o poder.** "En Venezuela es común hacer la distinción social de distancia y cercanía, de solidaridad y poder entre el usted y el tú" (Rojas Saavedra, 2020). Un sistema de trabajo que se usa a diario, por estudiantes y personal, se beneficia de la cercanía; la seriedad la da el registro, no el pronombre.
2. **La propia FaCyT usa los dos según el tipo de mensaje.** En su sitio, los avisos oficiales van de usted ("podrá verificar su admisión y deberá acudir a la Dirección de Asuntos Estudiantiles") y la promoción va de tú ("¡Asegura tu éxito universitario!"). Nuestro sistema no emite actos administrativos: es una herramienta de trabajo. Los reportes PDF, que sí pueden circular como documento oficial, van en forma impersonal ("Se aprobó la solicitud…").
3. **La práctica de la industria en español latinoamericano no es uniforme.** La guía de Microsoft para español neutro recomienda tú para su voz moderna ("the informal second person singular pronoun 'tú' is recommended"), aunque sus productos empresariales usan usted. Mercado Pago pide evitar "usted" y "vos" y prefiere construcciones sin pronombre. Tomamos de ambas lo útil: tú en los mensajes y nada de pronombre en los botones ("Guardar borrador", "Enviar a aprobación", "Aprobar").
4. **El tono conversacional genera más confianza, siempre que sea serio.** "Serious doesn't necessarily have to be cold and formal" (Moran, NN/g).
5. **Es coherente con el estilo Apple de RNF-03 y con la documentación del proyecto**, que ya está escrita de tú (README).

**Riesgo.** Parte del personal administrativo de mayor edad podría sentir el tuteo como falta de respeto, sobre todo en contextos de poder (Rojas Saavedra, 2020). Se valida con 3 a 5 personas del personal administrativo y técnico antes de cerrar el texto de la interfaz [SUPUESTO por validar]. Si hay rechazo, la alternativa es pasar los mensajes a construcciones impersonales sin cambiar los botones.

**Reglas de redacción:**

- Los mensajes de error dicen qué pasó, dónde y cómo corregirlo, junto al campo, sin culpar al usuario y conservando lo que escribió. Es la lección L4 y lo que pide NN/g: "Take a positive tone and don't blame the user" (usa un tono positivo y no culpes al usuario) y "offer some potential remedies" (ofrece posibles soluciones) (Neusesser y Sunwall, 2023). Se evitan "inválido" e "incorrecto".
- Se usan los términos del dominio tal como están en los requisitos: Borrador, Pendiente de Aprobación, Aprobado, Rechazado, Ejecutado, lote, hito, prorrateo.
- Números con coma decimal y punto de miles, como los publica CONATEL ("25.200.760", "1,66 %"); fechas dd/mm/aaaa y hora de Caracas (`APP_TIMEZONE`, README §11).
- Sin signos de exclamación en mensajes de error ni de rechazo.

| Situación | Evitar | Usar |
|---|---|---|
| Código de proyecto repetido | "Error: código inválido." | "Ya existe un proyecto con el código QUI-024. Usa otro código o abre el proyecto existente." |
| Reserva que choca | "No se pudo crear la reserva." | "El espectrofotómetro está reservado de 10:00 a 12:00 para BIO-011. Hay espacio libre de 12:00 a 15:00." |
| Pesos de hitos que no suman 100 | "Los pesos son incorrectos." | "Los hitos suman 90 %. Faltan 10 % para llegar a 100 %." |
| Retiro mayor que el stock | "Cantidad no permitida." | "Solo quedan 2,5 L de acetona en el lote L-0425. Pide 2,5 L o menos, o elige otro lote." |
| Rechazo de una solicitud | "Su solicitud fue rechazada." | "Carmen Pérez rechazó tu solicitud SOL-118: «Falta la cotización del proveedor». Puedes crear una nueva con la cotización adjunta." |
| Sesión por expirar | (cerrar sin aviso) | "Tu sesión se cerrará en 2 minutos por inactividad. [Seguir trabajando]" |
| Sin conexión al enviar | "Error de red." | "No hay conexión. Tu borrador está guardado y lo enviaremos cuando vuelva la conexión. [Reintentar ahora]" |

### 5.5 Movimiento

- **Duración y curva.** De 100 a 300 ms con *ease-out*: unos 100 ms para respuestas simples (interruptores, casillas) y de 200 a 300 ms para cambios grandes como abrir un diálogo; lo que sale de pantalla dura un poco menos que lo que entra (Laubheimer, NN/g, 2020).
- **Movimiento con función.** Solo se anima lo que explica un cambio de estado: un diálogo que aparece, una fila que se agrega, un panel que se despliega. Nada de animaciones decorativas, *parallax* ni efectos de carga elaborados, que además castigan a los teléfonos de gama media.
- **Movimiento reducido.** Con `prefers-reduced-motion: reduce` (MDN), los desplazamientos y escalados se cambian por fundidos breves o desaparecen, como recomienda Apple: "Replacing transitions in x-, y-, and z-axes with fades to avoid motion" (reemplazar transiciones en los ejes x, y, z por fundidos) y "Avoiding animating into and out of blurs" (evitar animar desenfoques).
- **Espera.** Hasta 1 s no hace falta indicador. Entre 1 y 10 s se muestra un esqueleto de la pantalla o un indicador discreto. Más de 10 s (por ejemplo, un reporte grande) lleva barra de progreso y opción de cancelar (Nielsen, NN/g).

---

## 6. Criterios de accesibilidad que vamos a seguir

Norma de referencia: WCAG 2.2, Recomendación del W3C del 12 de diciembre de 2024, nivel AA, más algunos criterios AAA y guías de plataforma donde aportan.

| Criterio | Valor concreto en el sistema | Norma |
|---|---|---|
| Contraste de texto | 4,5:1 como mínimo; 3:1 para texto grande (18 pt, unos 24 px, o 14 pt en negrita, unos 18,7 px). Se verifica en modo claro y en modo oscuro | WCAG 1.4.3 (AA) |
| Contraste de componentes y gráficos | 3:1 para bordes de campos, foco, íconos con significado, series y ejes de los gráficos del dashboard | WCAG 1.4.11 (AA) |
| Texto base | 16 px como mínimo para el cuerpo; menos solo en notas al pie o leyendas | USWDS [GUÍA]; Apple usa 17 pt por defecto |
| Ampliación de texto | Todo sigue usable al 200 % de zoom, sin perder contenido ni funciones | WCAG 1.4.4 (AA) |
| Reflow | Sin desplazamiento horizontal a 320 px CSS de ancho, salvo tablas de datos y calendario, que se desplazan dentro de su propio contenedor | WCAG 1.4.10 (AA) |
| Espaciado de texto | Nada se corta si el usuario aumenta interlineado y espaciado entre letras, palabras y párrafos | WCAG 1.4.12 (AA) |
| Tamaño del objetivo | Mínimo 24×24 px CSS en todo el sistema; preferido 44×44 px en móvil y en las acciones principales | WCAG 2.5.8 (AA) y 2.5.5 (AAA, 44×44); Apple, 44×44 pt por defecto en iOS; Google, 48×48 dp en Android |
| Foco visible | Anillo de foco de al menos 2 px con 3:1 de contraste en todos los elementos interactivos | WCAG 2.4.7 (AA) y 1.4.11 |
| Foco no tapado | La barra superior fija, los avisos y los paneles no pueden cubrir el elemento con foco | WCAG 2.4.11 (AA) |
| Teclado completo | Todo se opera con teclado, incluido el calendario de reservas (alternativa de formulario con fecha y hora de inicio y fin) y las aprobaciones | WCAG 2.1.1 (A) |
| Saltar al contenido | Enlace "Saltar al contenido" como primer elemento enfocable de cada página | WCAG 2.4.1 (A) |
| Orden de foco y de lectura | El orden de tabulación sigue el orden visual; los diálogos atrapan el foco y lo devuelven al cerrarse (Radix) | WCAG 2.4.3 (A) y 1.3.2 (A) |
| Etiquetas visibles | Todo campo tiene etiqueta visible encima; el *placeholder* nunca reemplaza la etiqueta; los obligatorios se marcan con texto, no solo con asterisco de color | WCAG 3.3.2 (A) |
| Errores identificados y con sugerencia | El error se describe en texto junto al campo, se anuncia al lector de pantalla y dice cómo corregir (ver §5.4) | WCAG 3.3.1 (A) y 3.3.3 (AA); L4 |
| No pedir dos veces lo mismo | Lo ya capturado en el proceso se autocompleta (proyecto único, datos del solicitante) | WCAG 3.3.7 (A); L10 |
| Inicio de sesión accesible | Se permite pegar la contraseña y usar gestores de contraseñas; sin acertijos ni CAPTCHA cognitivos | WCAG 3.3.8 (AA) |
| No depender solo del color | Estados, alertas de stock y vencimiento llevan ícono y texto además del color; las series de los gráficos se distinguen también por forma o etiqueta | WCAG 1.4.1 (A) |
| Mensajes de estado | Avisos como "Solicitud enviada" o "Stock actualizado" se anuncian con `aria-live` sin mover el foco | WCAG 4.1.3 (AA) |
| Contenido al pasar el cursor | Los *tooltips* se pueden cerrar con Esc, se pueden recorrer con el puntero y no desaparecen solos; nada esencial vive solo en un *tooltip* | WCAG 1.4.13 (AA) |
| Alternativas de texto | Íconos con nombre accesible; cada gráfico del dashboard tiene su tabla de datos o un resumen en texto | WCAG 1.1.1 (A) |
| Tablas | Encabezados de fila y columna marcados (`th`, `scope`) en inventario, solicitudes y auditoría | WCAG 1.3.1 (A) |
| Idioma | `lang="es"` en el documento | WCAG 3.1.1 (A) |
| Tiempo de sesión | Cierre a los 30 min sin actividad (README §6). Aviso 2 min antes con botón "Seguir trabajando", que basta para extender (WCAG pide al menos 20 s y una acción simple). Aviso también antes del cierre absoluto de las 8 h | WCAG 2.2.1 (A) |
| Volver sin perder datos | Los formularios guardan borrador; al volver a iniciar sesión, el usuario sigue donde estaba | WCAG 2.2.5 (AAA) y 2.2.6 (AAA); cortes de luz (§2) |
| Movimiento reducido | Con `prefers-reduced-motion: reduce`, las animaciones se reemplazan por fundidos o se eliminan | MDN [GUÍA]; WCAG 2.3.3 (AAA); Apple HIG |
| Tema claro y oscuro | Sigue `prefers-color-scheme` y tiene selector manual que se recuerda; disponible en todas las pantallas | MDN [GUÍA]; NN/g (Budiu, 2020); RNF-03 |
| Peso de la página | Carga inicial de 650 KiB comprimidos como máximo, con 300 KiB de JavaScript para la ruta inicial. FullCalendar, Recharts y las vistas de reportes se cargan solo en su ruta. Compresión en Nginx, caché de archivos estáticos y fuentes woff2 con subconjunto latino y `font-display: swap` | Decisión del equipo: la mitad del techo de 1,3 MiB que propone Russell (2024) para cargar en 5 s con un enlace de 7,2 Mbps, por el costo de los datos en Venezuela (VE sin Filtro). La mediana móvil mundial es de 2.311 KB con 570 KB de JavaScript (HTTP Archive, 2024), así que el límite es exigente a propósito |
| Ancho de prueba | Chrome en Android con 360×800 como referencia y 320 px para reflow; escritorio en Chrome, Edge y Firefox | StatCounter (sept. 2026) [DATO]; WCAG 1.4.10 |

---

## 7. Implicaciones de diseño

| # | Implicación | Qué hacemos | Respaldo |
|---|---|---|---|
| U1 | Diseñar primero para un Android de 360 px | Las pantallas de consulta, reserva, solicitud y aprobación se diseñan primero en una columna de 360 px. Las tablas densas, el prorrateo y la auditoría se optimizan para escritorio, pero también funcionan en el teléfono | StatCounter (69,97 % móvil, 93,43 % Android, 360×800); Flores Nessi y Romero Matos (2021) |
| U2 | Gastar pocos datos | Presupuesto de peso de §6, carga diferida por módulo, fuentes woff2 livianas, íconos SVG, sin imágenes decorativas. Las listas se paginan desde el servidor | VE sin Filtro (planes de 50 MB a 10 GB); Russell (2024); HTTP Archive (2024) |
| U3 | Sobrevivir a un corte | Todo formulario largo guarda borrador mientras se escribe. Cada envío muestra si llegó o falló y se puede reintentar sin duplicar el registro. Si se cae la conexión, la pantalla lo dice y conserva lo escrito | OVSP (2023), Cedice (2025), VE sin Filtro (2023), Freedom House (2024); LIME en investigacion_ux.md |
| U4 | Avisar antes de cerrar la sesión | Aviso 2 minutos antes del cierre por inactividad, con un botón para seguir; al volver a entrar, el usuario recupera su borrador | WCAG 2.2.1, 2.2.5 y 2.2.6; README §6 |
| U5 | El estado nunca depende solo del color | Cada estado de RN-03, cada alerta de stock y cada vencimiento lleva ícono y texto, con la tabla de colores de §5.2 | WCAG 1.4.1; NEI (1 de cada 12 hombres); Almustanyir (2025) |
| U6 | Objetivos táctiles amplios | 44×44 px en móvil y en acciones principales; nunca menos de 24×24 px en tablas compactas | WCAG 2.5.8 y 2.5.5; Apple HIG; Google (48 dp) |
| U7 | Estilo Apple con señales de clic claras | Botones rellenos o con borde, enlaces subrayados en el texto, íconos con etiqueta. La limpieza visual no puede costar descubribilidad | Moran, NN/g (2017): 22 % más tiempo con señales débiles |
| U8 | Errores que enseñan a corregir | Mensaje junto al campo, con la causa y la solución, sin culpar y sin borrar lo escrito (ejemplos de §5.4) | Neusesser y Sunwall, NN/g (2023); WCAG 3.3.1 y 3.3.3; L4 |
| U9 | Tú, en serio | Mensajes de tú, botones en infinitivo, PDF impersonales. Se valida con el personal administrativo antes de cerrar los textos | Rojas Saavedra (2020); sitio de la FaCyT; Microsoft; Mercado Pago; Moran, NN/g |
| U10 | Claro por defecto, oscuro disponible | Se sigue la preferencia del sistema operativo y hay selector manual en todas las pantallas; contraste verificado en ambos temas | Budiu, NN/g (2020); Apple HIG; RNF-03 |
| U11 | Movimiento corto y opcional | 100 a 300 ms con *ease-out*; fundidos o nada con movimiento reducido; esqueletos de carga después de 1 s | Laubheimer, NN/g (2020); MDN; Apple HIG; Nielsen, NN/g |
| U12 | Captura rápida al salir del laboratorio | Registrar un uso o un retiro desde el teléfono toma pocos toques: proyecto preseleccionado, lote sugerido, cantidad con teclado numérico, y el último valor usado a mano | Warwick (2018); L10 y L5 en investigacion_ux.md |
| U13 | Aprender usando | Estados vacíos que explican qué hacer y enlazan a la acción; el seed con datos de prueba (README §13) sirve de entorno para practicar; ayudas breves junto a los términos del dominio | Chimote et al. (2022); Meleán Romero y Contreras Bustamante (2020) |
| U14 | Avisos dentro del sistema, completos | Cada aviso de la bandeja dice qué pasó, quién lo hizo y enlaza al registro, porque la comunicación por otros canales se pierde | Flores Nessi y Romero Matos (2021); NEMO-CE #31 y L8 en investigacion_ux.md |

---

## 8. Fuentes

### Datos de conectividad, dispositivos y servicios

1. StatCounter Global Stats. *Desktop vs Mobile vs Tablet Market Share Venezuela*, septiembre de 2026. https://gs.statcounter.com/platform-market-share/desktop-mobile-tablet/venezuela
2. StatCounter Global Stats. *Mobile Operating System Market Share Venezuela*, septiembre de 2026. https://gs.statcounter.com/os-market-share/mobile/venezuela
3. StatCounter Global Stats. *Mobile Android Version Market Share Venezuela*, septiembre de 2026. https://gs.statcounter.com/android-version-market-share/mobile/venezuela
4. StatCounter Global Stats. *Browser Market Share Venezuela*, septiembre de 2026. https://gs.statcounter.com/browser-market-share/all/venezuela
5. StatCounter Global Stats. *Mobile Screen Resolution Stats Venezuela*, septiembre de 2026. https://gs.statcounter.com/screen-resolution-stats/mobile/venezuela
6. DataReportal (Kepios). *Digital 2026: Venezuela*, 2026. https://datareportal.com/reports/digital-2026-venezuela
7. CONATEL. *Cifras del sector de telecomunicaciones. Servicio de Internet, IV trimestre 2024*. https://conatel.gob.ve/wp-content/uploads/2025/08/Presentacion_Internet_IV-2024.pdf
8. CONATEL. *Cifras del sector de telecomunicaciones. Telefonía móvil, IV trimestre 2024*. https://conatel.gob.ve/wp-content/uploads/2025/08/Presentacion_TelfMovil_IV-2024.pdf
9. VE sin Filtro. *Reporte 2022 + 2023*, 2023. https://vesinfiltro.org/res/files/reporte-2022-2023.pdf
10. Freedom House. *Freedom on the Net 2024: Venezuela*, 2024. https://freedomhouse.org/country/venezuela/freedom-net/2024
11. Tagliafico, F. "Encuesta reveló que solo 48 % de los hogares venezolanos tienen acceso a Internet" (datos de Consultores 21). *El Diario*, 22/06/2023. https://eldiario.com/2023/06/22/encuesta-hogares-venezolanos-acceso-a-internet/
12. "Se incrementan las fallas eléctricas en Venezuela, según el OVSP". *NTN24*, 31/01/2024. https://www.ntn24.com/noticias-actualidad/se-incrementan-las-fallas-electricas-en-venezuela-segun-el-ovsp-470374
13. "Apagones y fallas eléctricas en Venezuela, enero 2025" (datos del Observatorio del Gasto Público de Cedice). *Finanzas Digital*, 13/02/2025. https://finanzasdigital.com/apagones-fallas-electricas-venezuela-enero-2025/
14. "Fallas en las telecomunicaciones aumentaron durante la cuarentena" (datos del OVSP). *El Diario*, 09/10/2020. https://eldiario.com/2020/10/09/fallas-telecomunicaciones-aumentaron-cuarentena/

### Estudios sobre la población universitaria

15. Flores Nessi, E. M. y Romero Matos, G. A. "Implicaciones de la brecha digital en la educación a distancia forzada por la pandemia COVID-19". *Encuentro Educacional*, 28(1), 2021, pp. 87-104. https://produccioncientifica.luz.edu.ve/index.php/encuentro/article/download/37217/40543
16. Meleán Romero, R. y Contreras Bustamante, J. R. A. "Universidad venezolana en tiempos de pandemia: ¿acción o reacción? Ante la nueva normalidad". *Utopía y Praxis Latinoamericana*, 25(Esp. 13), 2020, pp. 194-209. https://www.redalyc.org/journal/279/27965287014/movil/
17. Penzo, G. "Profesores universitarios de Venezuela se mantienen en las aulas pese a bajos salarios". *El Diario*, 05/12/2023. https://eldiario.com/2023/12/05/profesores-universitarios-venezuela-se-mantienen-aulas-pese-bajos-salarios/
18. Muscanell, N. y Gay, K. *2025 EDUCAUSE Students and Technology Report*. EDUCAUSE, 14/04/2025. https://library.educause.edu/resources/2025/4/2025-educause-students-and-technology-report (leído en la copia de ACCJC: https://accjc.org/wp-content/uploads/Educause-2025-Students-and-Technology-Report_-Shaping-the-Future-of-Higher-Education-Through-Technology-Flexibility-and-Well-Being-_-EDUCAUSE.pdf)
19. Facultad Experimental de Ciencias y Tecnología, Universidad de Carabobo. Sitio web, consultado el 27/10/2026. https://www.facyt.uc.edu.ve/

### Accesibilidad, salud y legislación

20. W3C. *Web Content Accessibility Guidelines (WCAG) 2.2*. Recomendación, 12/12/2024. https://www.w3.org/TR/WCAG22/
21. W3C WAI. *Understanding Success Criterion 2.2.1: Timing Adjustable*. https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html
22. Organización Mundial de la Salud. *Blindness and vision impairment*, 10/02/2026. https://www.who.int/news-room/fact-sheets/detail/blindness-and-visual-impairment
23. Organización Mundial de la Salud. *Disability*, 07/03/2023. https://www.who.int/news-room/fact-sheets/detail/disability-and-health
24. National Eye Institute (NIH). *Color Blindness*. https://www.nei.nih.gov/learn-about-eye-health/eye-conditions-and-diseases/color-blindness
25. Almustanyir, A. "A Global Perspective of Color Vision Deficiency: Awareness, Diagnosis, and Lived Experiences". *Healthcare*, 13(16):2031, 2025. https://pmc.ncbi.nlm.nih.gov/articles/PMC12385717/
26. Asamblea Nacional de Venezuela. *Ley Orgánica para la Inclusión, Igualdad y Desarrollo Integral de las Personas con Discapacidad*. Gaceta Oficial N.° 6.817 Extraordinario, 27/06/2024 (copia de la Gaceta: https://www.traviesoevans.com/travieso/wp-content/uploads/gacetas/2024/06-junio/2024-06-27-6817-extraordinario.pdf). Ficha de Acceso a la Justicia: https://accesoalajusticia.org/ley-organica-para-la-inclusion-igualdad-y-desarrollo-integral-de-las-personas-con-discapacidad/
27. Acosta-Vargas, P., Acosta-Vargas, G., Salvador-Acosta, B., Salvador-Ullauri, L. y Arias Flores, H. P. "Towards Accessible and Sustainable Universities: Web Accessibility and Human–Computer Interaction in Latin America". En *Universal Access in Human-Computer Interaction*, LNCS, Springer, 2026. DOI 10.1007/978-3-032-29653-5_34. https://cris.indoamerica.edu.ec/handle/123456789/10070
28. Acosta-Vargas, P., Acosta-Vargas, G., Salvador-Acosta, B., Chacon-Castro, M. y Jadán-Guerrero, J. "Web Accessibility in Latin American Universities: A Path to Global Rankings and Digital Inclusion". En *HCI International 2025 Posters*, CCIS vol. 2524, Springer, 2025, pp. 3-14. DOI 10.1007/978-3-031-94156-6_1. https://puceinvestiga.puce.edu.ec/es/publications/web-accessibility-in-latin-american-universities-a-path-to-global/
29. University of Warwick, School of Engineering. *Policy on use of Mobile Phones and other Personal Electronic Devices in Laboratories and Workshop Areas*, 27/09/2018. https://warwick.ac.uk/fac/sci/eng/local/hands/soehspolicies/personalelectronicdevices

### Guías de diseño, rendimiento y redacción

30. Apple. *Human Interface Guidelines: Accessibility*. https://developer.apple.com/design/human-interface-guidelines/accessibility (leído desde https://developer.apple.com/tutorials/data/design/human-interface-guidelines/accessibility.json)
31. Google. *Touch target size* (Accessibility Scanner, Android). https://support.google.com/accessibility/android/answer/7101858
32. U.S. Web Design System. *Typography*. https://designsystem.digital.gov/components/typography/
33. MDN Web Docs. *prefers-reduced-motion*. https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
34. Neusesser, T. y Sunwall, E. "Error-Message Guidelines". Nielsen Norman Group, 14/05/2023. https://www.nngroup.com/articles/error-message-guidelines/
35. Moran, K. "The Impact of Tone of Voice on Users' Brand Perception". Nielsen Norman Group, 2016 (revisado 2024). https://www.nngroup.com/articles/tone-voice-users/
36. Moran, K. "Flat UI Elements Attract Less Attention and Cause Uncertainty". Nielsen Norman Group, 03/09/2017. https://www.nngroup.com/articles/flat-ui-less-attention-cause-uncertainty/
37. Budiu, R. "Dark Mode vs. Light Mode: Which Is Better?". Nielsen Norman Group, 02/02/2020. https://www.nngroup.com/articles/dark-mode/
38. Laubheimer, P. "Executing UX Animations: Duration and Motion Characteristics". Nielsen Norman Group, 09/02/2020. https://www.nngroup.com/articles/animation-duration/
39. Nielsen, J. "Response Times: The 3 Important Limits". Nielsen Norman Group, 1993 (actualizado 2014). https://www.nngroup.com/articles/response-times-3-important-limits/
40. Russell, A. "The Performance Inequality Gap, 2024". *Infrequently Noted*, 31/01/2024. https://infrequently.org/2024/01/performance-inequality-gap-2024/
41. Smart, D. e Indigo, J. "Page Weight". *Web Almanac 2024*, HTTP Archive. https://almanac.httparchive.org/en/2024/page-weight
42. Microsoft. *Spanish (Neutral) Style Guide*. https://download.microsoft.com/download/4/3/1/431d9836-40dc-4f2b-aafc-def5c7b5d0f3/spa-neu-StyleGuide.pdf (índice de guías: https://learn.microsoft.com/en-us/globalization/reference/microsoft-style-guides)
43. Mercado Pago Developers. *Style guide: translations, language specifics*. https://www.mercadopago.com.ar/developers/en/docs/style-guide/translations-language-specifics.md
44. Rojas Saavedra, J. A. "Usted, tú, vos, marico, papi: formas actuales de tratamiento de segunda persona del singular en los Andes venezolanos". *Cambios y Permanencias*, 11(2), 2020, pp. 789-831. https://noesis.uis.edu.co/handle/20.500.14071/43418

### Fuentes citadas a través de investigacion_ux.md

Chimote et al. (2022), Smith et al. (2021), LIME (2026), los foros de Frappe (150602, 113401, 36424, 88513), NEMO-CE #31 y eLabFTW #6234. Las URL están en [investigacion_ux.md](investigacion_ux.md).
