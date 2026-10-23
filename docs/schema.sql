-- ============================================================================
-- PROYECTO: MEDITURNOS — ESQUEMA DE BASE DE DATOS RELACIONAL
-- Motor: PostgreSQL 14+ / ANSI SQL
-- Compatibilidad: pgAdmin 4, MySQL Workbench (Ingeniería Inversa / DDL), DBeaver, DataGrip
-- ============================================================================

-- Extensión para generación de identificadores únicos universales (UUIDv4)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. TIPOS ENUMERADOS (ENUMS)
-- ----------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE modalidad_atencion AS ENUM ('presencial', 'videollamada', 'ambas');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE estado_turno AS ENUM ('pendiente', 'atendido', 'ausente', 'cancelado', 'reprogramado');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE estado_pago AS ENUM ('pendiente', 'pagado', 'exento');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE canal_mensaje AS ENUM ('whatsapp', 'email', 'sms');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE tipo_plantilla AS ENUM ('confirmacion', 'recordatorio', 'reprogramacion', 'cancelacion');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 2. TABLA: profesionales
-- Entidad central de los médicos o especialistas de salud independientes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profesionales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    titulo VARCHAR(100) NOT NULL DEFAULT 'Licenciado en Kinesiología',
    especialidad VARCHAR(100) NOT NULL DEFAULT 'Kinesiología y Fisiatría',
    matricula_nacional VARCHAR(50),
    matricula_provincial VARCHAR(50),
    telefono_contacto VARCHAR(50),
    cbu_cvu VARCHAR(22),
    alias_mp VARCHAR(50),
    titular_cuenta VARCHAR(150),
    agenda_pausada BOOLEAN NOT NULL DEFAULT FALSE,
    intervalo_turnos_min INT NOT NULL DEFAULT 30 CHECK (intervalo_turnos_min > 0),
    anticipacion_minima_hs INT NOT NULL DEFAULT 2 CHECK (anticipacion_minima_hs >= 0),
    horizonte_maximo_dias INT NOT NULL DEFAULT 30 CHECK (horizonte_maximo_dias > 0),
    margen_entre_turnos_min INT NOT NULL DEFAULT 0 CHECK (margen_entre_turnos_min >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_profesionales_slug ON profesionales(slug);
CREATE INDEX IF NOT EXISTS idx_profesionales_email ON profesionales(email);

-- ----------------------------------------------------------------------------
-- 3. TABLA: servicios
-- Catálogo de prestaciones que ofrece el profesional con sus aranceles y duraciones
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS servicios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profesional_id UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    duracion_min INT NOT NULL DEFAULT 30 CHECK (duracion_min > 0),
    arancel_centavos BIGINT NOT NULL DEFAULT 0 CHECK (arancel_centavos >= 0),
    moneda VARCHAR(3) NOT NULL DEFAULT 'ARS',
    modalidad modalidad_atencion NOT NULL DEFAULT 'ambas',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    orden INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_servicios_profesional ON servicios(profesional_id, activo);

-- ----------------------------------------------------------------------------
-- 4. TABLA: franjas_horarias
-- Horarios recurrentes semanales de atención configurados por el profesional
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS franjas_horarias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profesional_id UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
    dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 1 AND 7), -- 1: Lunes, ..., 7: Domingo
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    modalidad_permitida modalidad_atencion NOT NULL DEFAULT 'ambas',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_orden_horas CHECK (hora_inicio < hora_fin)
);

CREATE INDEX IF NOT EXISTS idx_franjas_profesional_dia ON franjas_horarias(profesional_id, dia_semana, activo);

-- ----------------------------------------------------------------------------
-- 5. TABLA: descansos_horarios
-- Bloqueos de descanso/almuerzo dentro de cada franja horaria
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS descansos_horarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    franja_id UUID NOT NULL REFERENCES franjas_horarias(id) ON DELETE CASCADE,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    motivo VARCHAR(100) DEFAULT 'Almuerzo / Descanso',
    CONSTRAINT check_orden_descanso CHECK (hora_inicio < hora_fin)
);

CREATE INDEX IF NOT EXISTS idx_descansos_franja ON descansos_horarios(franja_id);

-- ----------------------------------------------------------------------------
-- 6. TABLA: pacientes
-- Ficha administrativa del paciente indexada por DNI y profesional
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pacientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profesional_id UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
    dni VARCHAR(20) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    telefono_e164 VARCHAR(30) NOT NULL,
    email VARCHAR(255),
    cobertura_medica VARCHAR(100) NOT NULL DEFAULT 'Particular',
    nro_afiliado VARCHAR(50),
    notas_administrativas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_profesional_paciente_dni UNIQUE (profesional_id, dni)
);

CREATE INDEX IF NOT EXISTS idx_pacientes_dni ON pacientes(dni);
CREATE INDEX IF NOT EXISTS idx_pacientes_profesional ON pacientes(profesional_id, apellido, nombre);

-- ----------------------------------------------------------------------------
-- 7. TABLA: turnos
-- Registro de citas agendadas, estados del ciclo de vida y control de cobro
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS turnos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profesional_id UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
    paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
    servicio_id UUID NOT NULL REFERENCES servicios(id) ON DELETE RESTRICT,
    inicio_utc TIMESTAMPTZ NOT NULL,
    fin_utc TIMESTAMPTZ NOT NULL,
    modalidad modalidad_atencion NOT NULL DEFAULT 'presencial',
    estado estado_turno NOT NULL DEFAULT 'pendiente',
    estado_pago estado_pago NOT NULL DEFAULT 'pendiente',
    arancel_acordado_centavos BIGINT NOT NULL DEFAULT 0,
    motivo_consulta TEXT,
    notas_cancelacion TEXT,
    turno_origen_id UUID REFERENCES turnos(id) ON DELETE SET NULL, -- Trazabilidad de reprogramaciones
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_rango_horario CHECK (inicio_utc < fin_utc)
);

CREATE INDEX IF NOT EXISTS idx_turnos_profesional_fecha ON turnos(profesional_id, inicio_utc, estado);
CREATE INDEX IF NOT EXISTS idx_turnos_paciente ON turnos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_turnos_estado ON turnos(estado);

-- ----------------------------------------------------------------------------
-- 8. TABLA: bloqueos_temporales
-- Reserva temporal (Hold 10 min) en el portal web para evitar colisiones de turno
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bloqueos_temporales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profesional_id UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
    slot_inicio TIMESTAMPTZ NOT NULL,
    slot_fin TIMESTAMPTZ NOT NULL,
    session_id VARCHAR(100) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_hold_rango CHECK (slot_inicio < slot_fin)
);

CREATE INDEX IF NOT EXISTS idx_bloqueos_expiracion ON bloqueos_temporales(profesional_id, expires_at);

-- ----------------------------------------------------------------------------
-- 9. TABLA: fichas_clinicas
-- Expediente médico principal vinculado al paciente
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fichas_clinicas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id UUID NOT NULL UNIQUE REFERENCES pacientes(id) ON DELETE CASCADE,
    profesional_id UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
    antecedentes_personales TEXT,
    antecedentes_patologicos TEXT,
    alergias TEXT,
    medicacion_habitual TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fichas_profesional ON fichas_clinicas(profesional_id);

-- ----------------------------------------------------------------------------
-- 10. TABLA: notas_evolucion
-- Evoluciones clínicas redactadas en cada consulta (formato SOAP estructurado)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notas_evolucion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ficha_id UUID NOT NULL REFERENCES fichas_clinicas(id) ON DELETE CASCADE,
    turno_id UUID REFERENCES turnos(id) ON DELETE SET NULL,
    fecha_atencion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    motivo_consulta TEXT,
    subjetivo_s TEXT,    -- S: Lo que el paciente refiere
    objetivo_o TEXT,      -- O: Hallazgos clínicos / exploración física
    evaluacion_a TEXT,    -- A: Diagnóstico / impresión médica
    plan_p TEXT,          -- P: Tratamiento, ejercicios y próximos pasos
    contenido_tiptap JSONB, -- Contenido enriquecido serializado
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notas_ficha_fecha ON notas_evolucion(ficha_id, fecha_atencion DESC);
CREATE INDEX IF NOT EXISTS idx_notas_turno ON notas_evolucion(turno_id);

-- ----------------------------------------------------------------------------
-- 11. TABLA: adjuntos_paciente
-- Estudios médicos, ecografías, radiografías y análisis de laboratorio
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS adjuntos_paciente (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    nota_id UUID REFERENCES notas_evolucion(id) ON DELETE SET NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    tipo_mime VARCHAR(100) NOT NULL,
    tamano_bytes BIGINT NOT NULL DEFAULT 0,
    storage_uri TEXT NOT NULL,
    storage_thumbnail_uri TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_adjuntos_paciente ON adjuntos_paciente(paciente_id);
CREATE INDEX IF NOT EXISTS idx_adjuntos_nota ON adjuntos_paciente(nota_id);

-- ----------------------------------------------------------------------------
-- 12. TABLA: plantillas_mensajes
-- Mensajes predefinidos para WhatsApp / Email con marcadores dinámicos
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plantillas_mensajes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profesional_id UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
    tipo_mensaje tipo_plantilla NOT NULL,
    canal canal_mensaje NOT NULL DEFAULT 'whatsapp',
    titulo VARCHAR(100) NOT NULL,
    cuerpo_plantilla TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_profesional_tipo_canal UNIQUE (profesional_id, tipo_mensaje, canal)
);

CREATE INDEX IF NOT EXISTS idx_plantillas_profesional ON plantillas_mensajes(profesional_id, activo);

-- ----------------------------------------------------------------------------
-- 13. TABLA: auditoria_turnos
-- Registro inmutable de transiciones de estado para auditoría y métricas
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria_turnos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    turno_id UUID NOT NULL REFERENCES turnos(id) ON DELETE CASCADE,
    estado_anterior VARCHAR(30),
    estado_nuevo VARCHAR(30) NOT NULL,
    motivo_cambio TEXT,
    autor_email VARCHAR(255),
    ip_origen VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auditoria_turno ON auditoria_turnos(turno_id, created_at DESC);
