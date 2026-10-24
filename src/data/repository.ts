/**
 * MediTurnos · Capa de Repositorio de Datos (DataRepository)
 *
 * Desacopla la persistencia (localStorage + Google Drive) del modelo de datos de la base.
 * Más adelante se puede sustituir la implementación por SupabaseDataRepository sin alterar
 * los componentes ni la lógica de negocio.
 *
 * Reglas de seguridad:
 * - NO usar ni exponer la clave `service_role` en el cliente.
 * - Borrar pacientes, turnos, fichas, notas está bloqueado por diseño.
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
  Patient,
  Professional,
  Service,
  TimeOff,
  WorkingHours,
} from '../types';
import {
  DbModalidadAtencion,
  recortarHora,
  traducirErrorBase,
} from './mappers';

// ============================================================================
// Tipos para las funciones RPC del portal público (Sección 5)
// ============================================================================

export interface PortalAgendaPublicaResult {
  profesional: {
    id_publico: string;
    slug: string;
    nombre: string;
    titulo: string;
    especialidad: string;
    matricula_nacional?: string | null;
    matricula_provincial?: string | null;
    foto_perfil_path?: string | null;
    agenda_pausada: boolean;
    zona_horaria: string;
    intervalo_turnos_min: number;
    anticipacion_minima_hs: number;
    horizonte_maximo_dias: number;
    margen_entre_turnos_min: number;
    plazo_cancelacion_hs: number;
  };
  servicios: Array<{
    id: string;
    nombre: string;
    descripcion?: string | null;
    duracion_min: number;
    modalidad: DbModalidadAtencion;
    arancel_centavos: number | null; // null si mostrar_precio = false
    moneda: string;
  }>;
  sedes: Array<{
    id: string;
    nombre: string;
    direccion: string;
    indicaciones?: string | null;
    maps_url?: string | null;
  }>;
  coberturas: Array<{
    id: string;
    nombre: string;
    tipo: string;
  }>;
  franjas: Array<{
    id: string;
    dia_semana: number;
    hora_inicio: string;
    hora_fin: string;
    modalidad_permitida: DbModalidadAtencion;
    sede_id?: string | null;
    descansos: Array<{ hora_inicio: string; hora_fin: string }>;
  }>;
  ocupados: Array<{
    inicio: string;
    fin: string;
  }>;
  feriados: Array<{
    fecha: string;
    nombre: string;
    laborable: boolean;
  }>;
}

export interface PortalHoldResult {
  hold_id: string;
  inicio: string;
  fin: string;
  expira: string;
}

export interface PortalConfirmarTurnoResult {
  turno_id: string;
  manage_token: string;
  inicio: string;
  fin: string;
  modalidad: Modalidad;
  servicio: string;
  arancel_centavos?: number | null;
  sede?: {
    nombre: string;
    direccion: string;
    indicaciones?: string | null;
    maps_url?: string | null;
  } | null;
  datos_cobro?: {
    alias?: string;
    titular?: string;
  } | null;
}

export interface PortalVerTurnoResult {
  turno_id: string;
  servicio_id: string;
  inicio: string;
  fin: string;
  estado: EstadoTurno;
  modalidad: Modalidad;
  servicio: string;
  profesional: string;
  slug: string;
  sede?: {
    nombre: string;
    direccion: string;
    indicaciones?: string | null;
    maps_url?: string | null;
  } | null;
  plazo_cancelacion_hs: number;
  puede_cancelar: boolean;
  puede_reprogramar: boolean;
  reprogramado_a?: string | null;
}

export interface PortalCancelarTurnoResult {
  turno_id: string;
  estado: 'cancelado';
}

export interface PortalReprogramarTurnoResult {
  turno_id: string;
  turno_anterior_id: string;
  manage_token: string;
  inicio: string;
  fin: string;
  modalidad: Modalidad;
  servicio: string;
  sede?: {
    nombre: string;
    direccion: string;
    indicaciones?: string | null;
    maps_url?: string | null;
  } | null;
}

// ============================================================================
// Interfaz Principal del Repositorio de Datos
// ============================================================================

export interface DataRepository {
  // Configuración del Profesional
  getProfessional(): Promise<Professional>;
  updateProfessional(data: Partial<Professional>): Promise<Professional>;

  // Sedes y Servicios
  getLocations(): Promise<Location[]>;
  saveLocations(locations: Location[]): Promise<Location[]>;

  getServices(): Promise<Service[]>;
  saveServices(services: Service[]): Promise<Service[]>;

  // Horarios y Ausencias
  getWorkingHours(): Promise<WorkingHours[]>;
  saveWorkingHours(hours: WorkingHours[]): Promise<WorkingHours[]>;

  getHolidays(): Promise<Holiday[]>;
  saveHolidays(holidays: Holiday[]): Promise<Holiday[]>;

  getTimeOffs(): Promise<TimeOff[]>;
  saveTimeOffs(timeOffs: TimeOff[]): Promise<TimeOff[]>;

  // Coberturas
  getCoverages(): Promise<Coverage[]>;
  addCoverage(nombre: string, tipo?: Coverage['tipo']): Promise<Coverage>;
  saveCoverages(coverages: Coverage[]): Promise<Coverage[]>;

  // Pacientes (No se permite eliminar)
  getPatients(): Promise<Patient[]>;
  addPatient(patient: Omit<Patient, 'id' | 'creadoEn'>): Promise<Patient>;
  updatePatient(id: string, data: Partial<Patient>): Promise<Patient>;

  // Turnos (No se permite eliminar, solo cancelar o reprogramar)
  getAppointments(): Promise<Appointment[]>;
  createAppointment(data: Omit<Appointment, 'id' | 'creadoEn'>): Promise<Appointment>;
  updateAppointmentStatus(
    id: string,
    nuevoEstado: EstadoTurno,
    actor: ActorCambio,
    motivo?: string,
    notasCancelacion?: string
  ): Promise<Appointment>;
  setAppointmentPayment(id: string, estadoPago: EstadoPago): Promise<Appointment>;
  rescheduleAppointment(
    appointmentId: string,
    nuevoInicio: string,
    nuevoFin: string,
    esSobreturno?: boolean
  ): Promise<{ oldAppointment: Appointment; newAppointment: Appointment }>;

  // Historia Clínica y Notas (No se permite eliminar notas ni fichas)
  getConsultationNotes(): Promise<ConsultationNote[]>;
  saveConsultationNote(note: Partial<ConsultationNote> & { patientId: string }): Promise<ConsultationNote>;

  // Plantillas de Mensajes
  getTemplates(): Promise<MessageTemplate[]>;
  saveTemplates(templates: MessageTemplate[]): Promise<MessageTemplate[]>;

  // Auditoría (Solo lectura)
  getAuditLogs(appointmentId?: string): Promise<AppointmentStatusHistory[]>;

  // Contrato de Funciones del Portal Público (Sección 5)
  portalAgendaPublica(params: {
    p_ref: string;
    p_desde: string; // YYYY-MM-DD
    p_hasta: string; // YYYY-MM-DD
    p_session_id?: string;
  }): Promise<PortalAgendaPublicaResult>;

  portalCrearHold(params: {
    p_ref: string;
    p_servicio_id: string;
    p_inicio: string; // ISO
    p_modalidad: Modalidad;
    p_sede_id?: string;
    p_session_id: string;
    p_ip?: string;
  }): Promise<PortalHoldResult>;

  portalConfirmarTurno(params: {
    p_ref: string;
    p_hold_id: string;
    p_session_id: string;
    p_dni: string;
    p_nombre: string;
    p_telefono_e164: string;
    p_email?: string;
    p_cobertura_id?: string | null;
    p_plan?: string;
    p_nro_afiliado?: string;
    p_motivo?: string;
    p_ip?: string;
  }): Promise<PortalConfirmarTurnoResult>;

  portalVerTurno(params: { p_token: string }): Promise<PortalVerTurnoResult>;

  portalCancelarTurno(params: {
    p_token: string;
    p_motivo?: string;
    p_ip?: string;
  }): Promise<PortalCancelarTurnoResult>;

  portalReprogramarTurno(params: {
    p_token: string;
    p_hold_id: string;
    p_session_id: string;
    p_ip?: string;
  }): Promise<PortalReprogramarTurnoResult>;
}
