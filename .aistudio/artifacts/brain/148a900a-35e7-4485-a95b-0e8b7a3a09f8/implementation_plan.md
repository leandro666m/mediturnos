# MediTurnos — Plan de Desarrollo (v6)

Plataforma SaaS integral de gestión de turnos para profesionales de la salud independientes en Argentina (médicos, kinesiólogos, nutricionistas, odontólogos), compuesta por dos zonas sincronizadas: el **Portal del Paciente** (PWA mobile-first, reserva en 3 pasos sin cuenta) y el **Dashboard del Profesional** (agenda, turnos, fichas con notas clínicas, configuración de horarios y mensajería WhatsApp).

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Decisiones confirmadas en la Fase 1 y acuerdos clave para el desarrollo del Hito 1:

- **Paleta e Identidad Visual**: Azul médico profundo (`#0369A1` / `#0284C7`) y pizarra refinada (`#0F172A` / `#334155`) con acentos esmeralda clínico (`#059669`) para estados confirmados y acciones clave.
- **Alcance Prioritario**: **Hito 1 completo** con datos demo integrados del **Lic. Martín Benítez** (Kinesiología, M.N. 14.892 / M.P. 8.420), 4 servicios representativos y 10 turnos en diversos estados de ciclo de vida, dejando el modelo de datos preparado para el Hito 2 (Google Drive/Sheets y recordatorios automáticos).
- **Acceso al Dashboard**: Perfil activo directo con selector de profesional en la cabecera (incluyendo opción de alternar profesionales o simular nuevos perfiles), garantizando pruebas fluidas en AI Studio sin fricción de credenciales.
- **Fuente de Verdad & Persistencia**: Estado reactivo centralizado con almacenamiento local estructurado (IndexedDB / LocalStorage) e historial auditable de transiciones de estado, garantizando tolerancia a cortes de red e integridad de turnos.

---

## 1. Overview & Core Concept

### Qué resuelve MediTurnos
Los profesionales de la salud pierden de 1,5 a 3 horas diarias coordinando horarios por WhatsApp, anotando citas en cuadernos o planillas propensas a errores, sufriendo ausentismo por falta de confirmaciones oportunas y desorden en el cobro de consultas particulares y por obras sociales.

### Actores del Sistema
1. **Paciente**: Accede por enlace público (`/[slug]`) o escaneando un código QR (`/r/[id]`). Reserva su turno en menos de 1 minuto sin crear usuario, recibe resumen, enlace de WhatsApp y archivo `.ics` de calendario.
2. **Profesional**: Gestiona su agenda en tiempo real, registra cobros, atiende consultas escribiendo notas clínicas con autoguardado y adjuntos, configura sus franjas horarias y modalidades, y comparte su enlace de difusión.

---

## 2. User Experience & Visual Design

### A. Portal del Paciente (PWA Mobile-First)
Diseñado con ergonomía táctil (360px a 430px en móvil, expandible en escritorio) cumpliendo la regla de 3 pasos claros:

1. **Cabecera Institucional**:
   - Nombre profesional, título, matrículas nacional/provincial, direcciones de atención y estado de la agenda (Abierta / Pausada).
   - *Regla D-17*: El número telefónico del profesional **nunca** se expone al paciente.
2. **Paso 1 — Consulta (Servicio)**:
   - Lista de servicios activos con duración, arancel formateado en moneda argentina (`$22.000`) y modalidades disponibles (Presencial, Videollamada por WhatsApp o Ambas con íconos claros).
3. **Paso 2 — Fecha y Hora**:
   - Tira interactiva de días (`Jue 15 oct`) con contador de turnos disponibles y badge de modalidad.
   - Selector de mes y acceso rápido *"Próximo turno disponible"*.
   - Grilla de horarios agrupados en **Mañana** y **Tarde** con leyenda *"Horario de Argentina"*.
   - Reserva temporal (*Hold* de 10 minutos) con cronómetro visual visible al presionar *"Completar mis datos"*.
4. **Paso 3 — Tus Datos**:
   - Nombre completo, DNI (7-8 dígitos), Teléfono WhatsApp (formato `+54 9...` validado), Email (opcional), Cobertura Médica (catálogo oficial: Particular, OSDE, Swiss Medical, Galeno, IOMA, PAMI, etc.), Motivo breve y casilla de consentimiento de tratamiento de datos con enlace a políticas.
   - Si es videollamada, aclaración destacada: *"El profesional te va a llamar por WhatsApp a este número a la hora del turno"*.
   - Confirmación explícita del número: *"Te vamos a escribir a +54 9 11..., ¿es correcto?"*.
5. **Confirmación**:
   - Resumen del turno confirmado con código, botón *"Agregar al calendario"* (descarga `.ics`) y botón *"Confirmar por WhatsApp"* (abre mensaje armado según plantilla).

```
[ FLUJO ERGONÓMICO DEL PORTAL DEL PACIENTE ]
┌──────────────────────────────────────────────┐
│  Lic. Martín Benítez · Kinesiología         │
│  M.N. 14.892 · M.P. 8.420 · Consultorio CABA │
├──────────────────────────────────────────────┤
│  Paso 1: Consulta ───► Paso 2: Horario ───►  │
│  Paso 3: Tus Datos ──► ¡Turno Confirmado!    │
├──────────────────────────────────────────────┤
│  [ Cronómetro Reserva Temporal: 09:42 min ]  │
│  • Resumen flotante de fecha y modalidad     │
│  • Botón CTA táctil principal (h-12, min 44px)│
└──────────────────────────────────────────────┘
```

### B. Dashboard del Profesional
Diseñado para escritorio y tablets con alta densidad de información, contraste AA y atajos accesibles:

1. **Top Bar & Perfil**:
   - Identificación del profesional activo, matrículas, switch rápido de profesional demo, botón *"Ver portal como paciente"*, botón *"Nuevo turno"* y botón *"Exportar CSV"*.
   - Modal de Perfil para editar matrículas, alias de cobro, CBU/titular, direcciones y slug público.
2. **Pestaña Agenda & Turnos**:
   - Filtros rápidos: `Hoy` (con contador de atendidos/pendientes), `Mañana`, `Próximos 7 días`, `Todos`, selector de estado y buscador general.
   - Tarjetas de turnos con horario, paciente, servicio, modalidad, cobertura, arancel y controles:
     - Selector de estado (`Pendiente`, `Atendido`, `Ausente`, `Cancelado`, `Reprogramado`).
     - Check *"Confirmado/Pagado"*.
     - Acciones de WhatsApp: *"Confirmar por WhatsApp"* y *"Recordar por WhatsApp"* (con advertencia fuera de horario 22:00 a 08:00).
     - Reprogramación atómica con enlace al turno original.
3. **Pestaña Cargar Turno**:
   - Para pacientes presenciales o telefónicos. Búsqueda por DNI con autocompletado inmediato de datos de contacto y cobertura.
   - Detección de huecos disponibles o carga de sobreturno justificado.
4. **Pestaña Pacientes & Notas Clínicas**:
   - Directorio de pacientes con historial clínico.
   - Editor de notas enriquecidas (Tiptap) con negrita, listas, títulos, plantillas rápidas (ej. SOAP) y zona de adjuntos (estudios médicos).
   - Indicador de guardado continuo: `Guardando...` / `Guardado` / `Sin conexión`.
5. **Pestaña Horarios & Especialidad**:
   - Configuración de franjas por día con descansos y modalidad obligatoria (Presencial / Videollamada / Ambas).
   - Parámetros globales: grilla (15/30 min), anticipación mínima, horizonte máximo, margen entre turnos y horario de descanso de mensajes.
   - Gestión de servicios, precios en ARS y plantillas de WhatsApp con variables editables (`{paciente}`, `{fecha}`, `{hora}`, etc.).
6. **Pestaña Difusión & QR**:
   - Enlace personalizado, código QR descargable en PNG/SVG y visualización en formato cartel A4 para sala de espera.
   - Switch *"Pausar agenda online"* y textos prearmados para compartir en Instagram/WhatsApp.

---

## 3. Key Product Decisions & Business Rules

| ID | Regla / Decisión | Justificación y Comportamiento |
| :--- | :--- | :--- |
| **D-01** | **Base de Datos como Fuente de Verdad** | La persistencia de la aplicación maneja el estado canónico. Google Drive/Sheets se concibe como espejo de respaldo (Hito 2). |
| **D-08** | **Manejo de Fechas & Moneda** | Almacenamiento en UTC/ISO, cálculo y renderizado estricto en `America/Argentina/Buenos_Aires`. Moneda en centavos con formateador argentino (`$22.000`). |
| **D-17** | **Videollamadas WhatsApp** | Iniciadas siempre por el profesional llamando al paciente. El teléfono del profesional **nunca** se divulga. |
| **D-18** | **Modalidad Obligatoria por Franja** | La disponibilidad requiere intersección entre las modalidades que admite el servicio y las que admite la franja horaria. |
| **D-20** | **Estado de Turno vs. Estado de Pago** | Conceptos ortogonales: un turno puede estar `Pendiente` y tener pago registrado, o estar `Atendido` con pago pendiente de cobro. |
| **I-02** | **Algoritmo de Disponibilidad Pura** | Función pura y determinista que cruza franjas, descansos, feriados/bloqueos, turnos activos, reservas temporales y duración del servicio con su margen. |
| **I-05** | **Máquina de Estados del Turno** | Transiciones auditadas (`Pendiente` ➔ `Atendido` / `Ausente` / `Cancelado` / `Reprogramado`). Al cancelar o reprogramar se libera el hueco. |
| **I-06** | **Mensajería WhatsApp Fase 1** | Generación de enlaces `wa.me` codificados con variables reemplazadas y bloques condicionales según sea presencial o videollamada. |

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ARQUITECTURA MEDITURNOS                         │
└────────────────────────────────────────────────────────────────────────┘

    [ PACIENTE (Móvil/Web) ]                 [ PROFESIONAL (Desktop/Tablet) ]
               │                                            │
               ▼                                            ▼
    ┌──────────────────────┐                    ┌──────────────────────┐
    │  Portal Paciente PWA │                    │ Dashboard Profesional│
    │  - /[slug] Reserva   │                    │ - /app Agenda & Hoy  │
    │  - /r/[id] Redirect  │                    │ - /app Pacientes     │
    │  - Pasos 1, 2, 3     │                    │ - /app Notas Tiptap  │
    │  - Hold 10 min       │                    │ - /app Horarios & WA │
    └──────────┬───────────┘                    └──────────┬───────────┘
               │                                           │
               ▼                                           ▼
    ┌──────────────────────────────────────────────────────────────────┐
    │                       MÓDULOS DE DOMINIO                         │
    │  • availabilityEngine (cálculo puro de huecos + márgenes)        │
    │  • appointmentStateMachine (transiciones e historial auditado)   │
    │  • messageTemplateResolver (reemplazo de variables + bloques)    │
    │  • argentinianFormatters (Intl es-AR, teléfonos E.164, fechas)   │
    └──────────────────────────────────┬───────────────────────────────┘
                                       │
                                       ▼
    ┌──────────────────────────────────────────────────────────────────┐
    │                     CAPA DE ESTADO & ALMACÉN                     │
    │  • Storage Service (IndexedDB / LocalStorage resiliente)         │
    │  • Entidades: Professionals, Services, WorkingHours,             │
    │               Appointments, Holds, Patients, Notes, Templates    │
    │  • Seed Demo: Lic. Martín Benítez (Kinesiología) + 10 turnos     │
    └──────────────────────────────────────────────────────────────────┘
```

### Entidades de Datos Principales
- **Professional**: Identificador inmutable (`public_id`), slug (`/lic-martin-benitez`), título, especialidad, matrículas, alias/CBU, agenda pausada, parámetros globales.
- **Service**: Nombre, descripción, duración en minutos, arancel en centavos, modalidades admitidas (`presencial`, `videollamada`, `ambas`), estado activo.
- **WorkingHours & WorkingBreak**: Días de atención (1 a 7), rangos horarios, descansos y modalidad asignada.
- **Appointment**: Paciente, servicio, horario (`inicio`, `fin`), modalidad, estado (`pendiente`, `atendido`, `ausente`, `cancelado`, `reprogramado`), estado de pago, arancel acordado, notas breves, motivo.
- **AppointmentHold**: Bloqueo temporal por 10 minutos para evitar doble reserva concurrente.
- **Patient**: DNI (clave de negocio por profesional), nombre y apellido, teléfono normalizado E.164, email, obra social/cobertura y número de afiliado.
- **ConsultationNote**: Ficha clínica asociada al paciente, fecha, especialidad, contenido estructurado Tiptap, versión y adjuntos (estudios).
- **MessageTemplate**: Plantillas de confirmación y recordatorio con marcadores dinámicos y bloques específicos para atención presencial y virtual.

---

## 5. Verification & Acceptance Plan

| Criterio | Descripción | Método de Verificación |
| :--- | :--- | :--- |
| **1. Reserva Móvil < 1 min** | Un paciente puede completar la reserva en 3 pasos fluidos en pantalla móvil de 360px. | Recorrido E2E del portal del paciente seleccionando servicio, fecha/hora y cargando datos. |
| **2. Cero Superposición** | El motor de disponibilidad y la reserva temporal impiden turnos simultáneos en el mismo horario. | Intento de selección de horario ocupado o bajo reserva temporal vigente (*Hold*). |
| **3. Ciclo de Vida y Pago** | El check *"Confirmado/Pagado"* y los cambios de estado operan de acuerdo a la matriz de negocio. | Cambio a Atendido, Ausente, Cancelado y Reprogramado verificando persistencia e historial. |
| **4. Notas Clínicas Resilientes** | El editor de notas clínicas guarda en tiempo real y tolera recargas sin perder texto. | Redacción en el editor Tiptap, verificación de estado guardado y persistencia en la ficha. |
| **5. Formato Rioplatense** | Moneda en `$22.000`, fechas en español (`Jueves 15 de octubre`) y teléfonos en formato nacional. | Inspección visual en pantallas y mensajes generados. |
| **6. Enlaces de WhatsApp** | Los botones de confirmación y recordatorio generan URLs `wa.me` válidas con variables resueltas. | Comprobación del texto generado para consulta presencial y videollamada. |
| **7. Exportación CSV** | El profesional puede descargar el listado de turnos filtrados en formato compatible con Excel en español. | Descarga y verificación del archivo `.csv` con separador `;` y codificación UTF-8 con BOM. |
