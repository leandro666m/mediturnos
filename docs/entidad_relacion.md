# MediTurnos — Documentación Técnica de Base de Datos Relacional

Este documento contiene la especificación completa del modelo relacional para **PostgreSQL**, el diagrama **Entidad-Relación (ERD)** en sintaxis estándar Mermaid y las instrucciones paso a paso para importarlo y visualizarlo en **MySQL Workbench**, **pgAdmin 4**, **DBeaver** o **Microsoft Visio**.

---

## 1. Diagrama Entidad-Relación (Mermaid ERD)

```mermaid
erDiagram
    PROFESIONALES ||--o{ SERVICIOS : "ofrece"
    PROFESIONALES ||--o{ FRANJAS_HORARIAS : "configura"
    PROFESIONALES ||--o{ PACIENTES : "atiende"
    PROFESIONALES ||--o{ TURNOS : "agenda"
    PROFESIONALES ||--o{ PLANTILLAS_MENSAJES : "personaliza"
    PROFESIONALES ||--o{ BLOQUEOS_TEMPORALES : "retiene (hold)"

    FRANJAS_HORARIAS ||--o{ DESCANSOS_HORARIOS : "contiene"

    PACIENTES ||--o{ TURNOS : "solicita"
    PACIENTES ||--|| FICHAS_CLINICAS : "posee (1:1)"
    PACIENTES ||--o{ ADJUNTOS_PACIENTE : "tiene"

    SERVICIOS ||--o{ TURNOS : "clasifica"

    TURNOS ||--o| NOTAS_EVOLUCION : "origina (0..1)"
    TURNOS ||--o{ AUDITORIA_TURNOS : "registra historial"
    TURNOS ||--o| TURNOS : "reprograma de (auto-referencia)"

    FICHAS_CLINICAS ||--o{ NOTAS_EVOLUCION : "contiene evoluciones"
    NOTAS_EVOLUCION ||--o{ ADJUNTOS_PACIENTE : "referencia estudios"

    PROFESIONALES {
        uuid id PK
        varchar slug UK
        varchar email UK
        varchar nombre
        varchar apellido
        varchar titulo
        varchar especialidad
        varchar matricula_nacional
        varchar matricula_provincial
        varchar telefono_contacto
        varchar cbu_cvu
        varchar alias_mp
        varchar titular_cuenta
        boolean agenda_pausada
        int intervalo_turnos_min
        int anticipacion_minima_hs
        int horizonte_maximo_dias
        int margen_entre_turnos_min
        timestamp created_at
        timestamp updated_at
    }

    SERVICIOS {
        uuid id PK
        uuid profesional_id FK
        varchar nombre
        text descripcion
        int duracion_min
        bigint arancel_centavos
        varchar moneda
        enum modalidad
        boolean activo
        int orden
        timestamp created_at
        timestamp updated_at
    }

    FRANJAS_HORARIAS {
        uuid id PK
        uuid profesional_id FK
        smallint dia_semana
        time hora_inicio
        time hora_fin
        enum modalidad_permitida
        boolean activo
        timestamp created_at
    }

    DESCANSOS_HORARIOS {
        uuid id PK
        uuid franja_id FK
        time hora_inicio
        time hora_fin
        varchar motivo
    }

    PACIENTES {
        uuid id PK
        uuid profesional_id FK
        varchar dni
        varchar nombre
        varchar apellido
        varchar telefono_e164
        varchar email
        varchar cobertura_medica
        varchar nro_afiliado
        text notas_administrativas
        timestamp created_at
        timestamp updated_at
    }

    TURNOS {
        uuid id PK
        uuid profesional_id FK
        uuid paciente_id FK
        uuid servicio_id FK
        timestamptz inicio_utc
        timestamptz fin_utc
        enum modalidad
        enum estado
        enum estado_pago
        bigint arancel_acordado_centavos
        text motivo_consulta
        text notas_cancelacion
        uuid turno_origen_id FK
        timestamp created_at
        timestamp updated_at
    }

    BLOQUEOS_TEMPORALES {
        uuid id PK
        uuid profesional_id FK
        timestamptz slot_inicio
        timestamptz slot_fin
        varchar session_id
        timestamptz expires_at
        timestamp created_at
    }

    FICHAS_CLINICAS {
        uuid id PK
        uuid paciente_id FK,UK
        uuid profesional_id FK
        text antecedentes_personales
        text antecedentes_patologicos
        text alergias
        text medicacion_habitual
        timestamp created_at
        timestamp updated_at
    }

    NOTAS_EVOLUCION {
        uuid id PK
        uuid ficha_id FK
        uuid turno_id FK
        timestamptz fecha_atencion
        text motivo_consulta
        text subjetivo_s
        text objetivo_o
        text evaluacion_a
        text plan_p
        jsonb contenido_tiptap
        int version
        timestamp created_at
        timestamp updated_at
    }

    ADJUNTOS_PACIENTE {
        uuid id PK
        uuid paciente_id FK
        uuid nota_id FK
        varchar nombre_archivo
        varchar tipo_mime
        bigint tamano_bytes
        text storage_uri
        text storage_thumbnail_uri
        timestamp created_at
    }

    PLANTILLAS_MENSAJES {
        uuid id PK
        uuid profesional_id FK
        enum tipo_mensaje
        enum canal
        varchar titulo
        text cuerpo_plantilla
        boolean activo
        timestamp created_at
        timestamp updated_at
    }

    AUDITORIA_TURNOS {
        uuid id PK
        uuid turno_id FK
        varchar estado_anterior
        varchar estado_nuevo
        text motivo_cambio
        varchar autor_email
        varchar ip_origen
        timestamp created_at
    }
```

---

## 2. Diccionario de Datos y Reglas de Negocio

### A. Dominio de Profesionales y Configuración
1. **`profesionales`**:
   - Clave primaria UUID.
   - `slug`: Nombre único para la URL pública del portal (ej: `/lic-martin-benitez`).
   - `intervalo_turnos_min`: Granularidad del turnero (15, 20, 30, 45 o 60 minutos).
   - `anticipacion_minima_hs`: Horas mínimas requeridas para que un paciente tome un turno online (evita turnos inmediatos imprevistos).
   - `horizonte_maximo_dias`: Cuántos días a futuro se abren turnos en el portal (ej: 30 días).

2. **`servicios`**:
   - Define el arancel en centavos (`BIGINT` para evitar errores de coma flotante, ej: `$22.000` = `2200000`).
   - `modalidad`: Enum `'presencial'`, `'videollamada'` o `'ambas'`.
   - `duracion_min`: Duración en minutos que ocupará el turno en la agenda.

3. **`franjas_horarias` y `descansos_horarios`**:
   - `dia_semana`: 1 (Lunes) a 7 (Domingo).
   - Permite que el profesional defina turnos mañana y tarde con un corte para almuerzo.
   - Restricción `CHECK (hora_inicio < hora_fin)`.

### B. Dominio de Pacientes y Agenda
4. **`pacientes`**:
   - Identificación unívoca compuesta: `UNIQUE (profesional_id, dni)`. Permite que un paciente se atienda con varios profesionales sin conflicto de claves.
   - Teléfono almacenado en estándar internacional E.164 (`+54911xxxxxxxx`).

5. **`turnos`**:
   - Almacena horarios en UTC con zona horaria (`TIMESTAMPTZ`), renderizándose en cliente en `America/Argentina/Buenos_Aires`.
   - Estados de ciclo de vida: `'pendiente'`, `'atendido'`, `'ausente'`, `'cancelado'`, `'reprogramado'`.
   - Trazabilidad de reprogramaciones mediante `turno_origen_id`.

6. **`bloqueos_temporales` (Hold)**:
   - Bloqueo transaccional de 10 minutos cuando el paciente hace clic en "Completar mis datos".
   - Si no se completa la reserva, el registro expira y el horario vuelve a liberarse.

### C. Dominio Médico y Documental
7. **`fichas_clinicas` y `notas_evolucion`**:
   - Cada paciente tiene exactamente una ficha clínica (`1:1`).
   - La ficha acumula notas de evolución (`1:N`) redactadas bajo el método **SOAP**:
     - **S**ubjetivo: Lo que relata el paciente.
     - **O**bjetivo: Hallazgos de la exploración médica.
     - **A**preciación / Diagnóstico: Diagnóstico presuntivo o de certeza.
     - **P**lan: Indicaciones, tratamiento farmacológico, ejercicios o pautas de alarma.
   - `contenido_tiptap`: Almacena el árbol JSON enriquecido generado por el editor visual.

8. **`adjuntos_paciente`**:
   - Registra metadatos de archivos de estudios (PDF, JPG, DICOM).
   - `storage_uri`: Ruta o URL del archivo en el sistema de almacenamiento.

---

## 3. Guía de Importación para Generar el Diagrama Visual

### En MySQL Workbench:
1. Abre **MySQL Workbench**.
2. Ve al menú superior: **File** > **New Model**.
3. Selecciona **Database** > **Reverse Engineer...** (o pulsa `Ctrl + R`).
4. Selecciona tu conexión de base de datos o ejecuta el script SQL desde **File** > **Open SQL Script** y abre `docs/schema.sql`.
5. Si deseas generar el diagrama EER directamente desde el script DDL:
   - Ve a **File** > **Import** > **Reverse Engineer MySQL / ANSI Create Script...**
   - Selecciona el archivo `docs/schema.sql`.
   - Marca la casilla *"Place imported objects on a new diagram"*.
   - Haz clic en **Execute** y MySQL Workbench dibujará automáticamente las tablas, columnas, relaciones y claves foráneas en el lienzo gráfico.

### En pgAdmin 4:
1. Abre **pgAdmin 4** y conéctate a tu base de datos PostgreSQL.
2. Abre la **Herramienta de Consulta (Query Tool)** sobre tu base de datos.
3. Carga y ejecuta `docs/schema.sql`.
4. En el panel izquierdo del explorador de objetos, haz clic derecho sobre la base de datos o esquema `public` y selecciona **Generate ERD** (Generar diagrama Entidad-Relación).
5. pgAdmin construirá el diagrama interactivo de todas las tablas y sus relaciones.

### En Microsoft Visio:
1. Abre Microsoft Visio y selecciona la plantilla **Diagrama de Modelo de Base de Datos** (Database Model Diagram).
2. En la pestaña **Base de datos**, haz clic en **Ingeniería inversa** (Reverse Engineer).
3. Selecciona el origen de datos ODBC para PostgreSQL y Visio generará las entidades gráficas y conectores de cardinalidad.

### En herramientas en línea (dbdiagram.io / Eraser):
- El archivo `docs/schema.sql` es compatible con el importador automático de **dbdiagram.io** (menú *"Import from PostgreSQL script"*).
