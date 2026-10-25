export type Modalidad = 'presencial' | 'videollamada';
export type ModalidadFranja = 'presencial' | 'videollamada' | 'ambas';

export type EstadoTurno = 'pendiente' | 'atendido' | 'ausente' | 'cancelado' | 'reprogramado';
export type EstadoPago = 'sin_pago' | 'pagado' | 'exento';
export type ActorCambio = 'paciente' | 'profesional' | 'sistema';

export interface Location {
  id: string;
  nombre: string;
  direccion: string;
  activa: boolean;
  indicaciones?: string;
  mapsUrl?: string; // Enlace a Google Maps para abrir la ubicación
}

export interface Service {
  id: string;
  nombre: string;
  descripcion: string;
  duracionMin: number;
  precioCentavos: number;
  mostrarPrecio: boolean;
  modalidades?: Modalidad[];
  activo: boolean;
  moneda?: string; // Default 'ARS'
  orden?: number;
}

export interface WorkingBreak {
  inicio: string; // "13:00"
  fin: string;    // "14:00"
}

export interface WorkingHours {
  id: string;
  diaSemana: number; // 1 = Lunes, ..., 7 = Domingo
  horaInicio: string; // "09:00"
  horaFin: string;    // "18:00"
  modalidad: ModalidadFranja;
  descansos: WorkingBreak[];
  locationId?: string;
  activo: boolean;
}

export interface Holiday {
  id: string;
  fecha: string; // "YYYY-MM-DD"
  nombre: string;
  laborable: boolean; // si el profesional lo configuró como laborable
}

export interface TimeOff {
  id: string;
  tipo: 'vacaciones' | 'bloqueo';
  inicio: string; // "YYYY-MM-DD" o "YYYY-MM-DDTHH:mm"
  fin: string;
  motivo: string;
}

export type FontSizePreference = 'minimo' | 'predeterminado' | 'grande';

export interface Professional {
  id: string;
  publicId: string;
  slug: string;
  nombre: string; // Nombre completo en un solo campo
  titulo: string;
  especialidad: string;
  matriculaNacional?: string;
  matriculaProvincial?: string;
  aliasCobro?: string;
  titularCobro?: string;
  cbu?: string; // 22 dígitos o vacío
  cuit?: string;
  banco?: string;
  zonaHoraria: string;
  agendaPausada: boolean;
  telefonoContactoPrivado?: string; // Solo interno, NUNCA visible al paciente (D-17)
  fotoPerfil?: string; // Ruta en bucket 'fotos-perfil' o URL pública
  tamanoTexto?: FontSizePreference; // 'minimo' (compacto), 'predeterminado' (estándar), 'grande' (ampliado)
  parametros: {
    grillaMin: number;
    anticipacionMinHoras: number;
    horizonteDias: number;
    margenMin: number;
    quietHoursInicio: string; // "22:00"
    quietHoursFin: string;    // "08:00"
    plazoCancelacionHoras: number; // default 24. Aplica a CANCELAR y a REPROGRAMAR
  };
}

export interface Coverage {
  id: string;
  nombre: string;
  tipo: 'obra_social' | 'prepaga' | 'particular' | 'otro';
}

export interface Patient {
  id: string;
  professionalId: string;
  dni: string;
  nombre: string; // Nombre completo en un solo campo
  telefonoE164: string;
  email?: string;
  coverageId: string | null; // null = Particular
  plan?: string;
  nroAfiliado?: string;
  notasInternas?: string;
  creadoEn: string;
}

export interface AppointmentStatusHistory {
  id: string;
  appointmentId: string;
  desde: EstadoTurno | 'creacion';
  hacia: EstadoTurno;
  actor: ActorCambio;
  en: string;
  motivo?: string;
}

export interface Appointment {
  id: string;
  professionalId: string;
  patientId: string;
  serviceId: string;
  locationId?: string;
  modalidad: Modalidad;
  inicio: string; // ISO UTC
  fin: string;    // ISO UTC
  estado: EstadoTurno;
  estadoPago: EstadoPago;
  precioCentavos: number;
  motivo?: string;
  origen: 'portal' | 'dashboard';
  esSobreturno: boolean;
  reprogramadoDe?: string; // id del turno anterior (en el nuevo)
  reprogramadoA?: string; // id del turno nuevo (derivado)
  manageToken?: string;
  canceladoPor?: ActorCambio;
  notasCancelacion?: string;
  creadoEn: string;
  // Campos del paciente embebidos para conveniencia de visualización (View Model)
  pacienteNombre: string;
  pacienteDni: string;
  pacienteTelefono: string;
  pacienteEmail?: string;
  pacienteCobertura: string;
  pacientePlan?: string;
  pacienteAfiliado?: string;
}

export interface AppointmentHold {
  id: string;
  professionalId: string;
  serviceId: string;
  inicio: string;
  fin: string;
  modalidad: Modalidad;
  locationId?: string;
  sessionToken: string;
  venceEn: string; // ISO
}

export interface NoteAttachment {
  id: string;
  nombre: string;
  tipoMime: string;
  tamanoBytes: number;
  url: string;
  subidoEn: string;
  driveFileId?: string;
  driveWebViewLink?: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export interface DriveUserInfo {
  email: string;
  displayName: string;
  photoURL?: string;
}

export interface DriveFolderInfo {
  masterFolderId: string;
  masterFolderUrl: string;
  configFolderId?: string;
  turnosFolderId?: string;
  pacientesFolderId?: string;
}

export interface ConsultationNote {
  id: string;
  professionalId: string;
  patientId: string;
  appointmentId?: string;
  atendidoEn: string; // ISO
  especialidad: string;
  contenidoJson: string; // Tiptap / rich text tree
  textoPlano: string;
  version: number;
  adjuntos: NoteAttachment[];
  actualizadoEn: string;
}

export interface MessageTemplate {
  id: string;
  professionalId: string;
  tipo: 'confirmacion' | 'recordatorio' | 'reprogramacion' | 'cancelacion';
  cuerpo: string;
  bloquePresencial: string;
  bloqueVideollamada: string;
}

export interface HuecoDisponibilidad {
  inicio: string; // ISO
  fin: string;    // ISO
  modalidades: Modalidad[];
  locationIds: string[];
}

export interface DiaDisponible {
  fecha: string; // "YYYY-MM-DD"
  fechaLegible: string; // "Jueves 15 de octubre"
  diaSemanaCorto: string; // "JUE"
  diaNumero: number; // 15
  mesCorto: string; // "OCT"
  huecos: HuecoDisponibilidad[];
  modalidades: Modalidad[];
  cantidad: number;
}
