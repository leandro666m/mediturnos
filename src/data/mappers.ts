/**
 * MediTurnos · Capa de Mapeo Frontend ⇄ Supabase (PostgreSQL)
 *
 * Contrato de datos:
 * - Frontend: camelCase
 * - Base de datos: snake_case
 * - Horas: recortar "HH:MM:SS" a "HH:MM"
 * - Particular = cobertura_id nulo
 * - EstadoPago: 'sin_pago' ⇄ 'pendiente', 'pagado' ⇄ 'pagado', 'exento' ⇄ 'exento'
 */

import {
  ActorCambio,
  Appointment,
  AppointmentHold,
  AppointmentStatusHistory,
  ConsultationNote,
  Coverage,
  EstadoPago,
  EstadoTurno,
  Holiday,
  Location,
  MessageTemplate,
  Modalidad,
  ModalidadFranja,
  NoteAttachment,
  Patient,
  Professional,
  Service,
  TimeOff,
  WorkingHours,
} from '../types';

// ============================================================================
// Tipos de las filas de la base de datos (PostgreSQL snake_case)
// ============================================================================

export type DbModalidadAtencion = 'presencial' | 'videollamada' | 'ambas';
export type DbEstadoTurno = 'pendiente' | 'atendido' | 'ausente' | 'cancelado' | 'reprogramado';
export type DbEstadoPago = 'pendiente' | 'pagado' | 'exento';
export type DbCanalMensaje = 'whatsapp' | 'email' | 'sms';
export type DbTipoPlantilla = 'confirmacion' | 'recordatorio' | 'reprogramacion' | 'cancelacion';
export type DbTipoAusencia = 'vacaciones' | 'bloqueo';
export type DbTipoCobertura = 'obra_social' | 'prepaga' | 'particular' | 'otro';
export type DbOrigenTurno = 'portal' | 'dashboard';
export type DbActorCambio = 'paciente' | 'profesional' | 'sistema';

export interface DbProfesional {
  id: string;
  slug: string;
  public_id: string;
  email: string;
  nombre: string;
  titulo: string;
  especialidad: string;
  matricula_nacional?: string | null;
  matricula_provincial?: string | null;
  telefono_contacto?: string | null;
  cbu_cvu?: string | null;
  alias_mp?: string | null;
  titular_cuenta?: string | null;
  cuit?: string | null;
  banco?: string | null;
  foto_perfil_path?: string | null;
  tamano_texto?: 'minimo' | 'predeterminado' | 'grande';
  zona_horaria: string;
  agenda_pausada: boolean;
  intervalo_turnos_min: number;
  anticipacion_minima_hs: number;
  horizonte_maximo_dias: number;
  margen_entre_turnos_min: number;
  plazo_cancelacion_hs: number;
  horario_silencio_inicio: string; // "HH:MM:SS" o "HH:MM"
  horario_silencio_fin: string;    // "HH:MM:SS" o "HH:MM"
  created_at?: string;
  updated_at?: string;
}

export interface DbSede {
  id: string;
  profesional_id: string;
  nombre: string;
  direccion: string;
  indicaciones?: string | null;
  maps_url?: string | null;
  activa: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DbCobertura {
  id: string;
  profesional_id: string;
  nombre: string;
  tipo: DbTipoCobertura;
  created_at?: string;
}

export interface DbServicio {
  id: string;
  profesional_id: string;
  nombre: string;
  descripcion?: string | null;
  duracion_min: number;
  arancel_centavos: number;
  mostrar_precio: boolean;
  moneda: string;
  modalidad: DbModalidadAtencion;
  orden: number;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DbFranjaHoraria {
  id: string;
  profesional_id: string;
  sede_id?: string | null;
  dia_semana: number; // 1 = lunes ... 7 = domingo
  hora_inicio: string;
  hora_fin: string;
  modalidad_permitida: DbModalidadAtencion;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DbDescansoHorario {
  id?: string;
  franja_id: string;
  profesional_id: string;
  hora_inicio: string;
  hora_fin: string;
}

export interface DbAusencia {
  id: string;
  profesional_id: string;
  tipo: DbTipoAusencia;
  inicio_utc: string;
  fin_utc: string;
  motivo?: string | null;
  created_at?: string;
}

export interface DbFeriadoProfesional {
  id: string;
  profesional_id: string;
  fecha: string; // "YYYY-MM-DD"
  nombre: string;
  laborable: boolean;
}

export interface DbPlantillaMensaje {
  id: string;
  profesional_id: string;
  tipo_mensaje: DbTipoPlantilla;
  canal: DbCanalMensaje;
  titulo?: string | null;
  cuerpo_plantilla: string;
  bloque_presencial?: string | null;
  bloque_videollamada?: string | null;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DbPaciente {
  id: string;
  profesional_id: string;
  dni: string;
  nombre: string;
  telefono_e164: string;
  email?: string | null;
  cobertura_id?: string | null;
  plan?: string | null;
  nro_afiliado?: string | null;
  notas_administrativas?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DbTurno {
  id: string;
  profesional_id: string;
  paciente_id: string;
  servicio_id: string;
  sede_id?: string | null;
  modalidad: 'presencial' | 'videollamada';
  inicio_utc: string;
  fin_utc: string;
  estado: DbEstadoTurno;
  estado_pago: DbEstadoPago;
  arancel_centavos: number;
  motivo_consulta?: string | null;
  origen: DbOrigenTurno;
  es_sobreturno: boolean;
  turno_origen_id?: string | null;
  cancelado_por?: DbActorCambio | null;
  notas_cancelacion?: string | null;
  manage_token_hash?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DbBloqueoTemporal {
  id: string;
  profesional_id: string;
  servicio_id: string;
  sede_id?: string | null;
  modalidad: 'presencial' | 'videollamada';
  slot_inicio: string;
  slot_fin: string;
  session_id: string;
  created_at?: string;
  expires_at: string;
}

export interface DbFichaClinica {
  id: string;
  profesional_id: string;
  paciente_id: string;
  antecedentes_personales?: string | null;
  antecedentes_patologicos?: string | null;
  alergias?: string | null;
  medicacion_habitual?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DbNotaEvolucion {
  id: string;
  profesional_id: string;
  ficha_id: string;
  turno_id?: string | null;
  fecha_atencion: string;
  especialidad?: string | null;
  texto_plano?: string | null;
  motivo_consulta?: string | null;
  subjetivo_s?: string | null;
  objetivo_o?: string | null;
  evaluacion_a?: string | null;
  plan_p?: string | null;
  contenido_tiptap?: any;
  version: number;
  created_at?: string;
  updated_at?: string;
}

export interface DbAdjuntoPaciente {
  id: string;
  profesional_id: string;
  paciente_id: string;
  nota_id?: string | null;
  nombre_archivo: string;
  tipo_mime: string;
  tamano_bytes: number;
  storage_path: string;
  storage_thumbnail_path?: string | null;
  drive_file_id?: string | null;
  created_at?: string;
}

export interface DbAuditoriaTurno {
  id: string;
  profesional_id: string;
  turno_id: string;
  estado_anterior?: DbEstadoTurno | null;
  estado_nuevo: DbEstadoTurno;
  motivo_cambio?: string | null;
  actor: DbActorCambio;
  autor_email?: string | null;
  ip_origen?: string | null;
  created_at: string;
}

// ============================================================================
// Constantes y Validaciones
// ============================================================================

export const SLUGS_RESERVADOS = [
  'app',
  'api',
  'login',
  'logout',
  'registro',
  'admin',
  'auth',
  '_next',
  'public',
  'static',
  'assets',
  'sw',
  'manifest',
  'portal',
  'turno',
];

export function esSlugReservado(slug: string): boolean {
  return SLUGS_RESERVADOS.includes(slug.toLowerCase().trim());
}

export function esSlugValido(slug: string): boolean {
  const clean = slug.toLowerCase().trim();
  if (clean.length < 3 || clean.length > 100) return false;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(clean)) return false;
  if (esSlugReservado(clean)) return false;
  return true;
}

/** Recorta cadenas de hora "HH:MM:SS" a "HH:MM" */
export function recortarHora(timeStr?: string | null): string {
  if (!timeStr) return '';
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }
  return timeStr.slice(0, 5);
}

/** Agrega segundos si es necesario para campos de tiempo en PostgreSQL ("HH:MM" -> "HH:MM:00") */
export function formatearHoraBase(timeStr?: string | null): string {
  if (!timeStr) return '00:00:00';
  const clean = recortarHora(timeStr);
  return clean.length === 5 ? `${clean}:00` : clean;
}

// ============================================================================
// Mapeos Estado de Pago (sin_pago ⇄ pendiente, pagado ⇄ pagado, exento ⇄ exento)
// ============================================================================

export function estadoPagoToDb(estado: EstadoPago): DbEstadoPago {
  if (estado === 'sin_pago') return 'pendiente';
  if (estado === 'exento') return 'exento';
  return 'pagado';
}

export function estadoPagoFromDb(estado: DbEstadoPago): EstadoPago {
  if (estado === 'pendiente') return 'sin_pago';
  if (estado === 'exento') return 'exento';
  return 'pagado';
}

// ============================================================================
// 3.1 Professional ⇄ profesionales
// ============================================================================

export function professionalToDb(p: Professional, email = ''): DbProfesional {
  return {
    id: p.id,
    slug: p.slug,
    public_id: p.publicId,
    email: email || `${p.slug}@mediturnos.app`,
    nombre: p.nombre.trim(),
    titulo: p.titulo.trim(),
    especialidad: p.especialidad.trim(),
    matricula_nacional: p.matriculaNacional?.trim() || null,
    matricula_provincial: p.matriculaProvincial?.trim() || null,
    telefono_contacto: p.telefonoContactoPrivado?.trim() || null,
    cbu_cvu: p.cbu?.trim() || null,
    alias_mp: p.aliasCobro?.trim() || null,
    titular_cuenta: p.titularCobro?.trim() || null,
    cuit: p.cuit?.trim() || null,
    banco: p.banco?.trim() || null,
    foto_perfil_path: p.fotoPerfil?.trim() || null,
    tamano_texto: p.tamanoTexto || 'predeterminado',
    zona_horaria: p.zonaHoraria || 'America/Argentina/Buenos_Aires',
    agenda_pausada: !!p.agendaPausada,
    intervalo_turnos_min: p.parametros.grillaMin || 30,
    anticipacion_minima_hs: p.parametros.anticipacionMinHoras ?? 2,
    horizonte_maximo_dias: p.parametros.horizonteDias || 30,
    margen_entre_turnos_min: p.parametros.margenMin || 0,
    plazo_cancelacion_hs: p.parametros.plazoCancelacionHoras ?? 24,
    horario_silencio_inicio: formatearHoraBase(p.parametros.quietHoursInicio || '22:00'),
    horario_silencio_fin: formatearHoraBase(p.parametros.quietHoursFin || '08:00'),
  };
}

export function professionalFromDb(d: DbProfesional): Professional {
  return {
    id: d.id,
    publicId: d.public_id,
    slug: d.slug,
    nombre: d.nombre,
    titulo: d.titulo,
    especialidad: d.especialidad,
    matriculaNacional: d.matricula_nacional || '',
    matriculaProvincial: d.matricula_provincial || '',
    aliasCobro: d.alias_mp || '',
    titularCobro: d.titular_cuenta || '',
    cbu: d.cbu_cvu || '',
    cuit: d.cuit || '',
    banco: d.banco || '',
    zonaHoraria: d.zona_horaria || 'America/Argentina/Buenos_Aires',
    agendaPausada: !!d.agenda_pausada,
    telefonoContactoPrivado: d.telefono_contacto || '',
    fotoPerfil: d.foto_perfil_path || undefined,
    tamanoTexto: d.tamano_texto || 'predeterminado',
    parametros: {
      grillaMin: d.intervalo_turnos_min || 30,
      anticipacionMinHoras: d.anticipacion_minima_hs ?? 2,
      horizonteDias: d.horizonte_maximo_dias || 30,
      margenMin: d.margen_entre_turnos_min || 0,
      quietHoursInicio: recortarHora(d.horario_silencio_inicio) || '22:00',
      quietHoursFin: recortarHora(d.horario_silencio_fin) || '08:00',
      plazoCancelacionHoras: d.plazo_cancelacion_hs ?? 24,
    },
  };
}

// ============================================================================
// 3.2 Location ⇄ sedes
// ============================================================================

export function locationToDb(l: Location, profesionalId: string): DbSede {
  return {
    id: l.id,
    profesional_id: profesionalId,
    nombre: l.nombre.trim(),
    direccion: l.direccion.trim(),
    indicaciones: l.indicaciones?.trim() || null,
    maps_url: l.mapsUrl?.trim() || null,
    activa: l.activa,
  };
}

export function locationFromDb(d: DbSede): Location {
  return {
    id: d.id,
    nombre: d.nombre,
    direccion: d.direccion,
    indicaciones: d.indicaciones || undefined,
    mapsUrl: d.maps_url || undefined,
    activa: d.activa,
  };
}

// ============================================================================
// 3.3 Service ⇄ servicios
// ============================================================================

export function serviceToDb(s: Service, profesionalId: string): DbServicio {
  let mod: DbModalidadAtencion = 'ambas';
  if (s.modalidades && s.modalidades.length > 0) {
    const tienePresencial = s.modalidades.includes('presencial');
    const tieneVirtual = s.modalidades.includes('videollamada');
    if (tienePresencial && tieneVirtual) mod = 'ambas';
    else if (tienePresencial) mod = 'presencial';
    else if (tieneVirtual) mod = 'videollamada';
  }

  return {
    id: s.id,
    profesional_id: profesionalId,
    nombre: s.nombre.trim(),
    descripcion: s.descripcion?.trim() || null,
    duracion_min: s.duracionMin,
    arancel_centavos: s.precioCentavos,
    mostrar_precio: s.mostrarPrecio,
    moneda: s.moneda || 'ARS',
    modalidad: mod,
    orden: s.orden ?? 0,
    activo: s.activo,
  };
}

export function serviceFromDb(d: DbServicio): Service {
  const modalidades: Modalidad[] = [];
  if (d.modalidad === 'ambas') {
    modalidades.push('presencial', 'videollamada');
  } else if (d.modalidad === 'presencial') {
    modalidades.push('presencial');
  } else if (d.modalidad === 'videollamada') {
    modalidades.push('videollamada');
  }

  return {
    id: d.id,
    nombre: d.nombre,
    descripcion: d.descripcion || '',
    duracionMin: d.duracion_min,
    precioCentavos: d.arancel_centavos,
    mostrarPrecio: d.mostrar_precio,
    modalidades,
    activo: d.activo,
    moneda: d.moneda,
    orden: d.orden,
  };
}

// ============================================================================
// 3.4 WorkingHours ⇄ franjas_horarias + descansos_horarios
// ============================================================================

export function workingHoursToDb(
  w: WorkingHours,
  profesionalId: string
): { franja: DbFranjaHoraria; descansos: DbDescansoHorario[] } {
  const franja: DbFranjaHoraria = {
    id: w.id,
    profesional_id: profesionalId,
    sede_id: w.locationId || null,
    dia_semana: w.diaSemana,
    hora_inicio: formatearHoraBase(w.horaInicio),
    hora_fin: formatearHoraBase(w.horaFin),
    modalidad_permitida: w.modalidad,
    activo: w.activo,
  };

  const descansos: DbDescansoHorario[] = (w.descansos || []).map(b => ({
    franja_id: w.id,
    profesional_id: profesionalId,
    hora_inicio: formatearHoraBase(b.inicio),
    hora_fin: formatearHoraBase(b.fin),
  }));

  return { franja, descansos };
}

export function workingHoursFromDb(
  f: DbFranjaHoraria,
  descansos: DbDescansoHorario[] = []
): WorkingHours {
  return {
    id: f.id,
    diaSemana: f.dia_semana,
    horaInicio: recortarHora(f.hora_inicio),
    horaFin: recortarHora(f.hora_fin),
    modalidad: f.modalidad_permitida as ModalidadFranja,
    locationId: f.sede_id || undefined,
    activo: f.activo,
    descansos: descansos
      .filter(d => d.franja_id === f.id)
      .map(d => ({
        inicio: recortarHora(d.hora_inicio),
        fin: recortarHora(d.hora_fin),
      })),
  };
}

// ============================================================================
// 3.5 TimeOff ⇄ ausencias
// Conversión UTC según zona horaria del profesional
// ============================================================================

export function timeOffToDb(t: TimeOff, profesionalId: string, timeZone = 'America/Argentina/Buenos_Aires'): DbAusencia {
  let inicioUtc: string;
  let finUtc: string;

  if (t.inicio.length === 10) {
    // "YYYY-MM-DD" -> 00:00 local a UTC
    const dIni = new Date(`${t.inicio}T00:00:00`);
    inicioUtc = dIni.toISOString();
  } else {
    inicioUtc = new Date(t.inicio).toISOString();
  }

  if (t.fin.length === 10) {
    // "YYYY-MM-DD" -> 00:00 local del día SIGUIENTE a UTC (fin exclusivo)
    const dFin = new Date(`${t.fin}T00:00:00`);
    dFin.setDate(dFin.getDate() + 1);
    finUtc = dFin.toISOString();
  } else {
    finUtc = new Date(t.fin).toISOString();
  }

  return {
    id: t.id,
    profesional_id: profesionalId,
    tipo: t.tipo,
    inicio_utc: inicioUtc,
    fin_utc: finUtc,
    motivo: t.motivo?.trim() || null,
  };
}

export function timeOffFromDb(d: DbAusencia): TimeOff {
  return {
    id: d.id,
    tipo: d.tipo,
    inicio: d.inicio_utc,
    fin: d.fin_utc,
    motivo: d.motivo || '',
  };
}

// ============================================================================
// 3.6 Holiday ⇄ feriados_profesional
// ============================================================================

export function holidayToDb(h: Holiday, profesionalId: string): DbFeriadoProfesional {
  return {
    id: h.id,
    profesional_id: profesionalId,
    fecha: h.fecha,
    nombre: h.nombre.trim(),
    laborable: h.laborable,
  };
}

export function holidayFromDb(d: DbFeriadoProfesional): Holiday {
  return {
    id: d.id,
    fecha: d.fecha,
    nombre: d.nombre,
    laborable: d.laborable,
  };
}

// ============================================================================
// 3.7 Coverage ⇄ coberturas
// ============================================================================

export function coverageToDb(c: Coverage, profesionalId: string): DbCobertura {
  return {
    id: c.id,
    profesional_id: profesionalId,
    nombre: c.nombre.trim(),
    tipo: c.tipo,
  };
}

export function coverageFromDb(d: DbCobertura): Coverage {
  return {
    id: d.id,
    nombre: d.nombre,
    tipo: d.tipo,
  };
}

// ============================================================================
// 3.8 Patient ⇄ pacientes
// ============================================================================

export function patientToDb(p: Patient): DbPaciente {
  return {
    id: p.id,
    profesional_id: p.professionalId,
    dni: p.dni.toUpperCase().trim(),
    nombre: p.nombre.trim(),
    telefono_e164: p.telefonoE164.trim(),
    email: p.email?.trim() || null,
    cobertura_id: p.coverageId || null, // null = Particular
    plan: p.plan?.trim() || null,
    nro_afiliado: p.nroAfiliado?.trim() || null,
    notas_administrativas: p.notasInternas?.trim() || null,
    created_at: p.creadoEn,
  };
}

export function patientFromDb(d: DbPaciente): Patient {
  return {
    id: d.id,
    professionalId: d.profesional_id,
    dni: d.dni,
    nombre: d.nombre,
    telefonoE164: d.telefono_e164,
    email: d.email || undefined,
    coverageId: d.cobertura_id || null, // null = Particular
    plan: d.plan || undefined,
    nroAfiliado: d.nro_afiliado || undefined,
    notasInternas: d.notas_administrativas || undefined,
    creadoEn: d.created_at || new Date().toISOString(),
  };
}

// ============================================================================
// 3.9 Appointment ⇄ turnos (con ViewModel enriquecido)
// ============================================================================

export function appointmentToDb(a: Appointment): DbTurno {
  return {
    id: a.id,
    profesional_id: a.professionalId,
    paciente_id: a.patientId,
    servicio_id: a.serviceId,
    sede_id: a.locationId || null,
    modalidad: a.modalidad,
    inicio_utc: a.inicio,
    fin_utc: a.fin,
    estado: a.estado,
    estado_pago: estadoPagoToDb(a.estadoPago),
    arancel_centavos: a.precioCentavos,
    motivo_consulta: a.motivo?.trim() || null,
    origen: a.origen,
    es_sobreturno: a.esSobreturno,
    turno_origen_id: a.reprogramadoDe || null,
    cancelado_por: a.canceladoPor || null,
    notas_cancelacion: a.notasCancelacion?.trim() || null,
    created_at: a.creadoEn,
  };
}

export function appointmentFromDb(
  d: DbTurno,
  paciente?: Patient,
  cobertura?: Coverage | null,
  reprogramadoA?: string
): Appointment {
  const coberturaNombre = cobertura?.nombre || (paciente?.coverageId ? 'Obra Social / Prepaga' : 'Particular');

  return {
    id: d.id,
    professionalId: d.profesional_id,
    patientId: d.paciente_id,
    serviceId: d.servicio_id,
    locationId: d.sede_id || undefined,
    modalidad: d.modalidad,
    inicio: d.inicio_utc,
    fin: d.fin_utc,
    estado: d.estado,
    estadoPago: estadoPagoFromDb(d.estado_pago),
    precioCentavos: d.arancel_centavos,
    motivo: d.motivo_consulta || undefined,
    origen: d.origen,
    esSobreturno: d.es_sobreturno,
    reprogramadoDe: d.turno_origen_id || undefined,
    reprogramadoA,
    canceladoPor: (d.cancelado_por as ActorCambio) || undefined,
    notasCancelacion: d.notas_cancelacion || undefined,
    creadoEn: d.created_at || new Date().toISOString(),
    // Campos embebidos para conveniencia de visualización
    pacienteNombre: paciente?.nombre || 'Paciente',
    pacienteDni: paciente?.dni || '',
    pacienteTelefono: paciente?.telefonoE164 || '',
    pacienteEmail: paciente?.email,
    pacienteCobertura: coberturaNombre,
    pacientePlan: paciente?.plan,
    pacienteAfiliado: paciente?.nroAfiliado,
  };
}

// ============================================================================
// 3.10 AppointmentStatusHistory ⇄ auditoria_turnos
// ============================================================================

export function auditLogFromDb(d: DbAuditoriaTurno): AppointmentStatusHistory {
  return {
    id: d.id,
    appointmentId: d.turno_id,
    desde: d.estado_anterior || 'creacion',
    hacia: d.estado_nuevo,
    actor: d.actor,
    en: d.created_at,
    motivo: d.motivo_cambio || undefined,
  };
}

// ============================================================================
// 3.11 AppointmentHold ⇄ bloqueos_temporales
// ============================================================================

export function holdToDb(h: AppointmentHold): DbBloqueoTemporal {
  return {
    id: h.id,
    profesional_id: h.professionalId,
    servicio_id: h.serviceId,
    sede_id: h.locationId || null,
    modalidad: h.modalidad,
    slot_inicio: h.inicio,
    slot_fin: h.fin,
    session_id: h.sessionToken,
    expires_at: h.venceEn,
  };
}

export function holdFromDb(d: DbBloqueoTemporal): AppointmentHold {
  return {
    id: d.id,
    professionalId: d.profesional_id,
    serviceId: d.servicio_id,
    locationId: d.sede_id || undefined,
    modalidad: d.modalidad,
    inicio: d.slot_inicio,
    fin: d.slot_fin,
    sessionToken: d.session_id,
    venceEn: d.expires_at,
  };
}

// ============================================================================
// 3.12 MessageTemplate ⇄ plantillas_mensajes
// ============================================================================

export function messageTemplateToDb(t: MessageTemplate, profesionalId: string): DbPlantillaMensaje {
  return {
    id: t.id,
    profesional_id: profesionalId,
    tipo_mensaje: t.tipo,
    canal: 'whatsapp',
    titulo: null,
    cuerpo_plantilla: t.cuerpo,
    bloque_presencial: t.bloquePresencial || null,
    bloque_videollamada: t.bloqueVideollamada || null,
    activo: true,
  };
}

export function messageTemplateFromDb(d: DbPlantillaMensaje): MessageTemplate {
  return {
    id: d.id,
    professionalId: d.profesional_id,
    tipo: d.tipo_mensaje,
    cuerpo: d.cuerpo_plantilla,
    bloquePresencial: d.bloque_presencial || '',
    bloqueVideollamada: d.bloque_videollamada || '',
  };
}

// ============================================================================
// 3.13 ConsultationNote ⇄ notas_evolucion
// ============================================================================

export function consultationNoteToDb(n: ConsultationNote, fichaId: string): DbNotaEvolucion {
  let contentTiptap: any = null;
  try {
    contentTiptap = n.contenidoJson ? JSON.parse(n.contenidoJson) : null;
  } catch {
    contentTiptap = { text: n.textoPlano };
  }

  return {
    id: n.id,
    profesional_id: n.professionalId,
    ficha_id: fichaId,
    turno_id: n.appointmentId || null,
    fecha_atencion: n.atendidoEn,
    especialidad: n.especialidad || null,
    texto_plano: n.textoPlano || null,
    contenido_tiptap: contentTiptap,
    version: n.version || 1,
    updated_at: n.actualizadoEn,
  };
}

export function consultationNoteFromDb(
  d: DbNotaEvolucion,
  patientId: string,
  adjuntos: NoteAttachment[] = []
): ConsultationNote {
  return {
    id: d.id,
    professionalId: d.profesional_id,
    patientId,
    appointmentId: d.turno_id || undefined,
    atendidoEn: d.fecha_atencion,
    especialidad: d.especialidad || 'Consulta',
    contenidoJson: typeof d.contenido_tiptap === 'string'
      ? d.contenido_tiptap
      : JSON.stringify(d.contenido_tiptap || {}),
    textoPlano: d.texto_plano || '',
    version: d.version,
    adjuntos,
    actualizadoEn: d.updated_at || d.created_at || new Date().toISOString(),
  };
}

// ============================================================================
// 3.14 NoteAttachment ⇄ adjuntos_paciente
// ============================================================================

export function noteAttachmentToDb(
  a: NoteAttachment,
  profesionalId: string,
  pacienteId: string,
  notaId?: string
): DbAdjuntoPaciente {
  return {
    id: a.id,
    profesional_id: profesionalId,
    paciente_id: pacienteId,
    nota_id: notaId || null,
    nombre_archivo: a.nombre,
    tipo_mime: a.tipoMime,
    tamano_bytes: a.tamanoBytes,
    storage_path: a.url.startsWith('http') || a.url.startsWith('blob:')
      ? `${profesionalId}/${pacienteId}/${a.nombre}`
      : a.url,
    drive_file_id: a.driveFileId || null,
  };
}

export function noteAttachmentFromDb(d: DbAdjuntoPaciente): NoteAttachment {
  return {
    id: d.id,
    nombre: d.nombre_archivo,
    tipoMime: d.tipo_mime,
    tamanoBytes: d.tamano_bytes,
    url: d.storage_path,
    subidoEn: d.created_at || new Date().toISOString(),
    driveFileId: d.drive_file_id || undefined,
  };
}

// ============================================================================
// Traducción y Mapeo de Errores (Secciones 4 y 5.4)
// ============================================================================

export const ERRORES_TABLAS_POSTGRES: Record<string, string> = {
  '23P01': 'Ese horario ya está ocupado.',
  '23505': 'Ya existe un registro con ese valor.',
  '23514': 'Revisá el formato del dato ingresado.',
  '23503': 'El dato relacionado no existe.',
  '23001': 'Este dato no se puede eliminar.',
  '42501': 'No tenés permiso para esta acción.',
};

export const ERRORES_PORTAL_PACIENTE: Record<string, string> = {
  demasiados_intentos: 'Hiciste demasiados intentos. Probá de nuevo en unos minutos.',
  profesional_no_encontrado: 'No encontramos lo que buscás.',
  servicio_no_disponible: 'No encontramos lo que buscás.',
  sede_no_disponible: 'No encontramos lo que buscás.',
  turno_no_encontrado: 'No encontramos ese turno. Revisá el enlace.',
  sesion_invalida: 'Revisá los datos ingresados.',
  modalidad_invalida: 'Revisá los datos ingresados.',
  sede_requerida: 'Revisá los datos ingresados.',
  datos_invalidos: 'Revisá los datos ingresados.',
  rango_invalido: 'Revisá los datos ingresados.',
  agenda_pausada: 'El profesional no está tomando turnos por ahora.',
  modalidad_no_disponible: 'Ese servicio no se ofrece en esa modalidad.',
  fuera_de_anticipacion: 'Ese horario ya no está disponible. Elegí otro.',
  fuera_de_horizonte: 'Ese horario ya no está disponible. Elegí otro.',
  horario_no_disponible: 'Ese horario ya no está disponible. Elegí otro.',
  horario_ocupado: 'Ese horario se acaba de ocupar. Elegí otro.',
  turno_no_cancelable: 'Este turno ya no se puede modificar.',
  turno_no_reprogramable: 'Este turno ya no se puede modificar.',
  servicio_distinto: 'El nuevo horario debe ser del mismo servicio.',
  fuera_de_plazo: 'Pasó el plazo para cancelar o reprogramar. Comunicate con el consultorio.',
  reserva_vencida: 'Tu reserva venció. Elegí el horario de nuevo.',
};

export function traducirErrorBase(codeOrMessage: string): string {
  if (!codeOrMessage) return 'Ocurrió un error inesperado.';
  if (ERRORES_PORTAL_PACIENTE[codeOrMessage]) {
    return ERRORES_PORTAL_PACIENTE[codeOrMessage];
  }
  if (ERRORES_TABLAS_POSTGRES[codeOrMessage]) {
    return ERRORES_TABLAS_POSTGRES[codeOrMessage];
  }
  return codeOrMessage;
}
