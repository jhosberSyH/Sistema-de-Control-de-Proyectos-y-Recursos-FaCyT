# Prompts principales

Prompts principales que el equipo usó con herramientas de IA generativa durante el análisis y el desarrollo del proyecto, como lo exige el enunciado (RNF-09).

Cada prompt aparece con un título que dice para qué se usó y su texto tal como se escribió. Las rutas que mencionan algunos prompts son las que tenían los archivos en ese momento; la ubicación actual está en la [estructura del proyecto](../README.md#8-estructura-del-proyecto).

## Contenido

1. [Documento de requisitos y benchmarking](#1-documento-de-requisitos-y-benchmarking)
2. [Investigación UX y diagramas de flujo por módulo](#2-investigación-ux-y-diagramas-de-flujo-por-módulo)
3. [Stack tecnológico y README](#3-stack-tecnológico-y-readme)
4. [Diagrama de arquitectura en draw.io](#4-diagrama-de-arquitectura-en-drawio)
5. [Estructura de carpetas del repositorio](#5-estructura-de-carpetas-del-repositorio)

---

## 1. Documento de requisitos y benchmarking

> Necesito que me ayudes a armar el documento de requisitos del proyecto. El PDF con los requisitos está en "C:\Users\jynojosa\Documents\Proyectos Personales\Proyecto Web Nuevo\enunciado Control de Proyectos Quimicos.pdf" y el skill de documentos que vamos a usar al final es /documento-de-requisitos.
>
> Primero lee el PDF completo y saca todos los requisitos funcionales y no funcionales, sin resumir ni dejar nada por fuera. Ponles un ID (RF-01, RNF-01, etc.) y respeta la redacción original. Si algo no está claro, no lo interpretes por tu cuenta. Pregúntame qué enfoque le damos y dame dos o tres propuestas concretas de cómo podría quedar redactado, explicando en una línea qué implica cada una, para que yo elija. Junta todas las dudas y pregúntamelas en un solo bloque, no una por una. Cuando te responda, guarda todo en requisitos_base.md.
>
> Después quiero que investigues en internet proyectos parecidos al nuestro. Que sean de 2021 para acá, que estén citados o bien documentados (papers, casos publicados, repos serios) y que no sean tutoriales ni demos de juguete. De cada uno anota el nombre, el año, la fuente, qué hace, sus funcionalidades principales y si usa IA y para qué. Guarda todo en benchmarking.md.
>
> Con eso compara sus funcionalidades contra las nuestras y dime qué tienen ellos que nosotros no. A partir de ahí propónme nuevos requisitos funcionales y no funcionales. Aparte, si alguno de esos proyectos tiene un módulo de IA, toma el que más aplique y adáptalo a nuestro proyecto: qué resolvería, cómo encaja con lo que ya tenemos y qué requisitos nuevos implica.
>
> Pásame todas las propuestas en una sola lista ordenada de la que más aporta a la que menos, con el ID propuesto, si es RF, RNF o IA, la propuesta, por qué aporta y de qué proyecto sale. Guárdala en propuestas.md. No inventes nada, cada propuesta tiene que venir de un proyecto real con su fuente.
>
> Cuando tengas la lista para ahí, no generes el documento todavía. Yo te digo cuáles aprobamos y cuáles no.
>
> Ya con eso definido, usas /documento-de-requisitos, lees el skill completo y armas el documento final con todos los requisitos del PDF más las propuestas que aprobemos, siguiendo el formato del skill al pie de la letra.

## 2. Investigación UX y diagramas de flujo por módulo

> Ahora con los requisitos que ya tenemos en el proyecto quiero que trabajes como un experto en UI/UX con experiencia y me ayudes a armar los diagramas de flujo de cada módulo.
>
> Antes de diseñar nada, investiga en los proyectos que tomamos como referencia en benchmarking.md cómo es su experiencia de usuario: cómo están organizados los flujos, cómo navega el usuario, qué pasos tiene cada proceso. Busca también en foros, reseñas y comunidades qué opinan los usuarios de la interacción con esas aplicaciones, qué les gusta, qué les frustra y dónde se traban. No inventes opiniones, cada hallazgo tiene que tener su fuente. Guarda todo en investigacion_ux.md y dime en pocas líneas qué aprendimos que nos sirva para nuestro proyecto.
>
> Con eso y los requisitos, arma los diagramas de flujo de cada módulo aplicando lo bueno que encontraste y evitando lo que a los usuarios no les gusta. Cada flujo tiene que poder rastrearse a los requisitos que cubre, así que anota los IDs (RF-XX) que toca cada uno.
>
> Genera los diagramas con el MCP de MC Modeler en la carpeta del proyecto "C:\Users\jynojosa\Documents\Proyectos Personales\Proyecto Web Nuevo", un diagrama por módulo.
>
> Cuando los tengas para ahí. Yo los reviso y los valido en MC Modeler. Si te pido cambios, los ajustas sobre el mismo diagrama.
>
> Una vez que te diga que están validados, los mueves a la carpeta diagramas dentro del proyecto y los agregas al documento de requisitos en la sección que corresponda a cada módulo, respetando el formato del skill /documento-de-requisitos.

## 3. Stack tecnológico y README

> Ahora con base en los requisitos y todo lo que ya tenemos en el proyecto (requisitos_base.md, benchmarking.md, propuestas aprobadas, investigacion_ux.md y los diagramas), quiero que me propongas el stack tecnológico y armemos el README.
>
> Primero revisa el PDF "C:\Users\jynojosa\Documents\Proyectos Personales\Proyecto Web Nuevo\enunciado Control de Proyectos Quimicos.pdf" y ubica el requisito obligatorio que tiene que ver con el README o la documentación del stack. Dime cuál es y qué exige exactamente, porque todo lo que hagamos tiene que cumplirlo al pie de la letra. Si el PDF pide alguna tecnología, lenguaje o restricción en particular, también respétala.
>
> Después investiga en internet cómo lo hacen otros proyectos: qué stack usan los proyectos de benchmarking.md (si está documentado) y cómo estructuran sus README los proyectos serios y bien mantenidos. Quiero fuentes reales, nada inventado.
>
> Con eso propónme el stack completo (frontend, backend, base de datos, autenticación, IA si aplica, despliegue y lo que haga falta). Para cada pieza dime por qué la elegiste, qué requisitos cubre (RF/RNF) y una alternativa por si no me convence. Si hay que decidir entre dos opciones que pesan parecido, plantéamelas para que yo elija.
>
> Cuando tengas la propuesta para ahí, no escribas el README todavía. Yo reviso el stack y te digo qué va y qué cambiamos.
>
> Ya con el stack aprobado, genera el README.md en la raíz del proyecto con todo lo fundamental: descripción del proyecto, objetivo, módulos, resumen de los requisitos principales, stack tecnológico con su justificación, estructura del proyecto y cómo levantarlo. Que quede claro, profesional y que cumpla con lo que pide el PDF.

## 4. Diagrama de arquitectura en draw.io

> Ahora vamos a generar un diagrama de arquitectura del sistema usando el MCP de draw.io. La idea es representarla de forma simple, que se entienda de un vistazo sin tener que ser técnico.
>
> Organízalo por carriles (swimlanes), uno por cada capa: Frontend, Backend, Datos y Servicios externos. Cada componente va en el carril que le corresponde, así queda claro qué vive en cada capa y si el sistema depende de algo de afuera. Si no hay servicios externos, igual deja el carril y me avisas.
>
> Básate en el stack que aprobamos en el README.md y en los módulos del documento de requisitos. Muestra las piezas principales (usuario, frontend, backend, base de datos, autenticación, módulo de IA si lo incluimos y cualquier API o servicio de terceros) y conéctalas con flechas claras y etiquetas cortas que digan qué se comunica (por ejemplo: peticiones HTTP, consultas, archivos, llamadas a la API de IA). Nada de detalle de más: si algo no aporta a entender cómo funciona el sistema, déjalo fuera.
>
> Usa los íconos o formas estándar de draw.io para cada tecnología cuando existan, un color por carril y una distribución ordenada.
>
> Guárdalo en la carpeta diagramas del proyecto como arquitectura.drawio y para ahí. Yo lo reviso en draw.io y si te pido cambios los haces sobre el mismo archivo.
>
> Cuando te lo valide, agrégalo al README.md en la sección del stack tecnológico y al documento de requisitos donde corresponda según el skill /documento-de-requisitos.

## 5. Estructura de carpetas del repositorio

> Ahora vamos a armar la estructura de carpetas de todo el repositorio para dejarlo organizado y empezar a trabajar sobre él.
>
> Básate en el stack que aprobamos en el README.md y en la arquitectura de diagramas/arquitectura.drawio. Investiga cómo estructuran sus repos los proyectos serios que usan ese mismo stack y sigue las convenciones oficiales de cada framework, nada inventado.
>
> La idea es que quede bien separado dónde va el frontend, dónde va el backend y dónde va todo lo demás: documentación (requisitos, benchmarking, investigación UX, propuestas), diagramas, configuración, scripts y lo que haga falta. Si tiene sentido organizar por módulos dentro del frontend y del backend según los módulos de los requisitos, hazlo así para que cada cosa se pueda ubicar fácil.
>
> Primero muéstrame el árbol completo de carpetas con una línea explicando qué va en cada una y para ahí. No crees nada todavía. Yo lo reviso y te digo qué cambiamos.
>
> Cuando te lo apruebe, crea la estructura completa en el repositorio. Mueve los archivos que ya tenemos (los .md de documentación y los diagramas) a donde les toque sin perder nada. Pon un .gitkeep en las carpetas vacías para que se suban, arma un .gitignore adecuado para el stack y un .env.example con las variables que vamos a necesitar, sin valores reales. Actualiza la sección de estructura del README.md para que refleje cómo quedó.
>
> No hagas commit ni push. Cuando termines dime qué creaste y qué moviste, y yo me encargo de subirlo.
