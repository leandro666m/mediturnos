import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  ActorCambio,
  Appointment,
  AppointmentHold,
  ConsultationNote,
  Coverage,
  EstadoPago,
  EstadoTurno,
  FontSizePreference,
  Holiday,
  Location,
  MessageTemplate,
  Modalidad,
  Patient,
  Professional,
  Service,
  NoteAttachment,
  TimeOff,
  WorkingHours,
  DriveUserInfo,
  DriveFolderInfo,
  SyncStatus,
} from '../types';
import {
  generarTurnosIniciales,
  INITIAL_CONSULTATION_NOTES,
  INITIAL_COVERAGES,
  INITIAL_HOLIDAYS,
  INITIAL_LOCATIONS,
  INITIAL_PATIENTS,
  INITIAL_PROFESSIONAL,
  INITIAL_SERVICES,
  INITIAL_TEMPLATES,
  INITIAL_WORKING_HOURS,
} from '../data/mockData';
import {
  PortalAgendaPublicaResult,
  PortalCancelarTurnoResult,
  PortalConfirmarTurnoResult,
  PortalHoldResult,
  PortalReprogramarTurnoResult,
  PortalVerTurnoResult,
} from '../data/repository';
import {
  recortarHora,
  traducirErrorBase,
} from '../data/mappers';
import { loadSupabaseWorkspace, saveSupabaseNotes, saveSupabaseWorkspace } from '../data/supabaseWorkspace';
import { createDataId } from '../data/ids';
import { supabase } from '../data/supabaseClient';
import { formatearFechaCorta, formatearHora, formatearMoneda } from '../modules/format';
import {
  initDriveAuth,
  signInWithGoogleDrive,
  signOutGoogleDrive,
  syncEntireWorkspaceToDrive,
  uploadBinaryFileToDrive,
  getOrCreateFolder,
  getDriveAccessToken,
  setDriveAccessToken,
} from '../modules/googleDriveService';

interface AppContextType {
  professional: Professional;
  locations: Location[];
  services: Service[];
  workingHours: WorkingHours[];
  holidays: Holiday[];
  timeOffs: TimeOff[];
  coverages: Coverage[];
  patients: Patient[];
  appointments: Appointment[];
  holds: AppointmentHold[];
  notes: ConsultationNote[];
  templates: MessageTemplate[];
  sessionToken: string;
  activeZone: 'dashboard' | 'portal';
  setActiveZone: (zone: 'dashboard' | 'portal') => void;
  // Métodos de negocio
  createHold: (
    serviceId: string,
    inicio: string,
    fin: string,
    modalidad: Modalidad,
    locationId?: string
  ) => { success: boolean; hold?: AppointmentHold; error?: string };
  releaseHold: (holdId: string) => void;
  bookAppointment: (params: {
    holdId?: string;
    serviceId: string;
    inicio: string;
    fin: string;
    modalidad: Modalidad;
    locationId?: string;
    pacienteNombre: string;
    pacienteDni: string;
    pacienteTelefono: string;
    pacienteEmail?: string;
    pacienteCoberturaId?: string | null;
    pacientePlan?: string;
    pacienteAfiliado?: string;
    motivo?: string;
    origen: 'portal' | 'dashboard';
    esSobreturno?: boolean;
    estadoPago?: EstadoPago;
  }) => { success: boolean; appointment?: Appointment; error?: string };
  changeAppointmentStatus: (
    id: string,
    nuevoEstado: EstadoTurno,
    motivo?: string
  ) => { success: boolean; error?: string };
  setAppointmentPayment: (id: string, pagado: boolean) => void;
  rescheduleAppointment: (
    appointmentId: string,
    nuevoInicio: string,
    nuevoFin: string,
    esSobreturno?: boolean
  ) => { success: boolean; newAppointment?: Appointment; error?: string };
  saveConsultationNote: (note: Partial<ConsultationNote> & { patientId: string }) => ConsultationNote;
  deleteConsultationNote: (noteId: string) => void;
  updateProfessional: (data: Partial<Professional>) => void;
  updateLocations: (locations: Location[]) => void;
  tamanoTexto: FontSizePreference;
  setTamanoTexto: (size: FontSizePreference) => void;
  updateWorkingHours: (hours: WorkingHours[]) => void;
  updateServices: (services: Service[]) => void;
  updateTemplates: (templates: MessageTemplate[]) => void;
  toggleAgendaPausa: () => void;
  findPatientByDni: (dni: string) => Patient | undefined;
  addPatient: (data: {
    dni: string;
    nombre: string;
    telefonoE164: string;
    email?: string;
    coverageId?: string | null;
    plan?: string;
    nroAfiliado?: string;
    notasInternas?: string;
  }) => { success: boolean; patient?: Patient; error?: string };
  updatePatient: (
    id: string,
    data: Partial<{
      dni: string;
      nombre: string;
      telefonoE164: string;
      email?: string;
      coverageId?: string | null;
      plan?: string;
      nroAfiliado?: string;
      notasInternas?: string;
    }>
  ) => { success: boolean; patient?: Patient; error?: string };
  exportarCsvTurnos: (turnosAExportar: Appointment[]) => void;
  exportarGoogleSheetsData: () => void;
  exportarGoogleDriveBackup: () => void;
  exportarHistoriaClinicaPaciente: (patientId: string) => void;
  findAppointmentByManageToken: (token: string) => Appointment | undefined;
  cancelAppointmentByPatient: (token: string, motivo?: string) => { success: boolean; error?: string };
  rescheduleAppointmentByPatient: (
    token: string,
    nuevoInicio: string,
    nuevoFin: string
  ) => { success: boolean; error?: string; newAppointment?: Appointment };
  addCoverage: (nombre: string) => Coverage;
  updateCoverages: (coverages: Coverage[]) => void;
  toggleHolidayLaborable: (holidayId: string) => void;
  updateHolidays: (holidays: Holiday[]) => void;
  resetToDemoData: () => void;
  dataLoaded: boolean;
  dataSyncError: string | null;

  // Funciones del Portal Público (Contrato Supabase RPC Sección 5)
  portalAgendaPublica: (params: {
    p_ref: string;
    p_desde: string;
    p_hasta: string;
    p_session_id?: string;
  }) => Promise<PortalAgendaPublicaResult>;
  portalCrearHold: (params: {
    p_ref: string;
    p_servicio_id: string;
    p_inicio: string;
    p_modalidad: Modalidad;
    p_sede_id?: string;
    p_session_id: string;
    p_ip?: string;
  }) => Promise<PortalHoldResult>;
  portalConfirmarTurno: (params: {
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
  }) => Promise<PortalConfirmarTurnoResult>;
  portalVerTurno: (params: { p_token: string }) => Promise<PortalVerTurnoResult>;
  portalCancelarTurno: (params: {
    p_token: string;
    p_motivo?: string;
    p_ip?: string;
  }) => Promise<PortalCancelarTurnoResult>;
  portalReprogramarTurno: (params: {
    p_token: string;
    p_hold_id: string;
    p_session_id: string;
    p_ip?: string;
  }) => Promise<PortalReprogramarTurnoResult>;

  // Integración y base de datos Google Drive
  isDriveConnected: boolean;
  driveUser: DriveUserInfo | null;
  isConnectingDrive: boolean;
  driveSyncStatus: SyncStatus;
  lastDriveSync: string | null;
  driveFolderUrl: string | null;
  driveFolderId: string | null;
  connectGoogleDrive: () => Promise<{ success: boolean; error?: string }>;
  disconnectGoogleDrive: () => Promise<void>;
  syncDataWithDrive: () => Promise<{ success: boolean; error?: string; filesCount?: number }>;
  uploadPatientFileToDrive: (
    patientId: string,
    file: File
  ) => Promise<{ success: boolean; attachment?: NoteAttachment; error?: string }>;
}

const STORAGE_KEY = 'mediturnos_state_v6';

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode; initialProfessional?: Professional; publicWorkspace?: import('../data/supabaseWorkspace').SupabaseWorkspace }> = ({ children, initialProfessional, publicWorkspace }) => {
  const [dataLoaded, setDataLoaded] = useState(!initialProfessional || Boolean(publicWorkspace));
  const [dbHydrated, setDbHydrated] = useState(!initialProfessional || Boolean(publicWorkspace));
  const [dataSyncError, setDataSyncError] = useState<string | null>(null);
  const persistenceQueue = useRef<Promise<void>>(Promise.resolve());
  const noteSignatures = useRef<Map<string, string>>(new Map());
  const [sessionToken] = useState(() => {
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return 'sess_' + crypto.randomUUID().replace(/-/g, '');
      }
    } catch {
      // fallback
    }
    return 'sess_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36);
  });
  const [activeZone, setActiveZone] = useState<'dashboard' | 'portal'>('dashboard');

  // Inicialización de estado con soporte para LocalStorage y migraciones
  const [professional, setProfessional] = useState<Professional>(() => {
    if (initialProfessional) return initialProfessional;
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_prof`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.tamanoTexto) parsed.tamanoTexto = 'predeterminado';
        if (!parsed.parametros) parsed.parametros = {};
        if (parsed.parametros.plazoCancelacionHoras === undefined) {
          parsed.parametros.plazoCancelacionHoras = 12;
        }
        return parsed;
      }
      return INITIAL_PROFESSIONAL;
    } catch {
      return INITIAL_PROFESSIONAL;
    }
  });

  // Aplicar escala tipográfica global de forma reactiva en el Dashboard del profesional
  useEffect(() => {
    if (activeZone === 'dashboard') {
      const size = professional.tamanoTexto || 'predeterminado';
      document.documentElement.setAttribute('data-text-size', size);
    }
  }, [professional.tamanoTexto, activeZone]);

  const [locations, setLocations] = useState<Location[]>(() => {
    if (initialProfessional) return [];
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_locs`);
      return saved ? JSON.parse(saved) : INITIAL_LOCATIONS;
    } catch {
      return INITIAL_LOCATIONS;
    }
  });

  const [services, setServices] = useState<Service[]>(() => {
    if (initialProfessional) return [];
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_services`);
      return saved ? JSON.parse(saved) : INITIAL_SERVICES;
    } catch {
      return INITIAL_SERVICES;
    }
  });

  const [workingHours, setWorkingHours] = useState<WorkingHours[]>(() => {
    if (initialProfessional) return [];
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_hours`);
      const raw: WorkingHours[] = saved ? JSON.parse(saved) : INITIAL_WORKING_HOURS;
      if (Array.isArray(raw)) {
        const seen = new Set<string>();
        return raw
          .filter(item => {
            if (!item.id || seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          })
          .map(wh => {
            // Garantizar que toda franja presencial o mixta tenga una sede asignada válida
            if ((wh.modalidad === 'presencial' || wh.modalidad === 'ambas') && !wh.locationId) {
              return { ...wh, locationId: 'loc-belgrano' };
            }
            return wh;
          });
      }
      return INITIAL_WORKING_HOURS;
    } catch {
      return INITIAL_WORKING_HOURS;
    }
  });

  const [holidays, setHolidays] = useState<Holiday[]>(() => {
    if (initialProfessional) return [];
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_holidays`);
      return saved ? JSON.parse(saved) : INITIAL_HOLIDAYS;
    } catch {
      return INITIAL_HOLIDAYS;
    }
  });

  const [timeOffs, setTimeOffs] = useState<TimeOff[]>(() => {
    if (initialProfessional) return [];
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_timeoffs`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [coverages, setCoverages] = useState<Coverage[]>(() => {
    if (initialProfessional) return [];
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_coverages`);
      let list: Coverage[] = saved ? JSON.parse(saved) : INITIAL_COVERAGES;
      // Migración Sección 2.2: Eliminar coberturas sembradas con tipo 'particular' o id 'cov-part'
      list = list.filter(c => c.tipo !== 'particular' && c.id !== 'cov-part');
      return list;
    } catch {
      return INITIAL_COVERAGES;
    }
  });

  const [patients, setPatients] = useState<Patient[]>(() => {
    if (initialProfessional) return [];
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_patients`);
      const list: Patient[] = saved ? JSON.parse(saved) : INITIAL_PATIENTS;
      // Migración Sección 2.2: Si el paciente usaba 'cov-part' o no tenía cobertura, coverageId = null
      return list.map(p => {
        let covId = p.coverageId;
        if (covId === 'cov-part' || covId === '' || (typeof covId === 'string' && !covId.trim())) {
          covId = null;
        }
        return { ...p, coverageId: covId };
      });
    } catch {
      return INITIAL_PATIENTS;
    }
  });

  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    if (initialProfessional) return [];
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_appointments`);
      const list: Appointment[] = saved ? JSON.parse(saved) : generarTurnosIniciales();
      return list.map(a => {
        let covNombre = a.pacienteCobertura;
        if (covNombre === 'Particular (sin obra social)' || !covNombre) {
          covNombre = 'Particular';
        }
        return {
          ...a,
          pacienteCobertura: covNombre,
        };
      });
    } catch {
      return generarTurnosIniciales();
    }
  });

  const [holds, setHolds] = useState<AppointmentHold[]>([]);

  const [notes, setNotes] = useState<ConsultationNote[]>(() => {
    if (initialProfessional) return [];
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_notes`);
      return saved ? JSON.parse(saved) : INITIAL_CONSULTATION_NOTES;
    } catch {
      return INITIAL_CONSULTATION_NOTES;
    }
  });

  const [templates, setTemplates] = useState<MessageTemplate[]>(() => {
    if (initialProfessional) return [];
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_templates`);
      const raw: MessageTemplate[] = saved ? JSON.parse(saved) : INITIAL_TEMPLATES;
      const combined = [...raw];
      ['reprogramacion', 'cancelacion'].forEach(tipo => {
        if (!combined.some(t => t.tipo === tipo)) {
          const initTpl = INITIAL_TEMPLATES.find(t => t.tipo === tipo);
          if (initTpl) combined.push(initTpl);
        }
      });
      return combined;
    } catch {
      return INITIAL_TEMPLATES;
    }
  });

  // En modo autenticado, Supabase es la fuente de verdad. No se cargan datos demo
  // ni el localStorage compartido entre profesionales.
  useEffect(() => {
    if (publicWorkspace) {
      setLocations(publicWorkspace.locations);
      setServices(publicWorkspace.services);
      setWorkingHours(publicWorkspace.workingHours);
      setHolidays(publicWorkspace.holidays);
      setTimeOffs(publicWorkspace.timeOffs);
      setCoverages(publicWorkspace.coverages);
      setPatients(publicWorkspace.patients);
      setAppointments(publicWorkspace.appointments);
      setNotes(publicWorkspace.notes);
      setTemplates(publicWorkspace.templates);
      return;
    }
    if (!initialProfessional) return;
    let active = true;
    setDataLoaded(false);
    setDbHydrated(false);
    loadSupabaseWorkspace()
      .then(workspace => {
        if (!active) return;
        setLocations(workspace.locations);
        setServices(workspace.services);
        setWorkingHours(workspace.workingHours);
        setHolidays(workspace.holidays);
        setTimeOffs(workspace.timeOffs);
        setCoverages(workspace.coverages);
        setPatients(workspace.patients);
        setAppointments(workspace.appointments);
        setNotes(workspace.notes);
        noteSignatures.current = new Map(workspace.notes.map(note => [note.id, JSON.stringify(note)]));
        setTemplates(workspace.templates);
        setDataSyncError(null);
        setDbHydrated(true);
      })
      .catch(error => {
        if (active) setDataSyncError(error instanceof Error ? error.message : 'No se pudieron cargar los datos de Supabase.');
      })
      .finally(() => { if (active) setDataLoaded(true); });
    return () => { active = false; };
  }, [initialProfessional?.id, publicWorkspace]);

  // Estados para Google Drive y base de datos en la nube
  const [driveUser, setDriveUser] = useState<DriveUserInfo | null>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_drive_user`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isDriveConnected, setIsDriveConnected] = useState<boolean>(() => {
    return !!localStorage.getItem(`${STORAGE_KEY}_drive_connected`);
  });

  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [driveSyncStatus, setDriveSyncStatus] = useState<SyncStatus>('idle');
  const [lastDriveSync, setLastDriveSync] = useState<string | null>(() => {
    return localStorage.getItem(`${STORAGE_KEY}_last_drive_sync`) || null;
  });
  const [driveFolderUrl, setDriveFolderUrl] = useState<string | null>(() => {
    return localStorage.getItem(`${STORAGE_KEY}_drive_folder_url`) || null;
  });
  const [driveFolderId, setDriveFolderId] = useState<string | null>(() => {
    return localStorage.getItem(`${STORAGE_KEY}_drive_folder_id`) || null;
  });

  // Inicializar listener de autenticación con Google
  useEffect(() => {
    const unsubscribe = initDriveAuth(
      (user, token) => {
        setDriveAccessToken(token);
        setIsDriveConnected(true);
        const uInfo: DriveUserInfo = {
          email: user.email || '',
          displayName: user.displayName || 'Profesional de la Salud',
          photoURL: user.photoURL || undefined,
        };
        setDriveUser(uInfo);
        localStorage.setItem(`${STORAGE_KEY}_drive_user`, JSON.stringify(uInfo));
        localStorage.setItem(`${STORAGE_KEY}_drive_connected`, 'true');
      },
      () => {
        // El token de Drive solo vive en memoria. Si Firebase restaura el usuario
        // pero no hay token (por ejemplo, después de recargar), no hay sesión
        // utilizable y no debemos mostrar la conexión persistida como activa.
        setIsDriveConnected(false);
        setDriveUser(null);
        localStorage.removeItem(`${STORAGE_KEY}_drive_connected`);
        localStorage.removeItem(`${STORAGE_KEY}_drive_user`);
      }
    );
    return () => unsubscribe();
  }, []);

  // Guardar cambios en LocalStorage para persistencia
  useEffect(() => {
    if (initialProfessional || publicWorkspace) return;
    try {
      localStorage.setItem(`${STORAGE_KEY}_prof`, JSON.stringify(professional));
      localStorage.setItem(`${STORAGE_KEY}_locs`, JSON.stringify(locations));
      localStorage.setItem(`${STORAGE_KEY}_services`, JSON.stringify(services));
      localStorage.setItem(`${STORAGE_KEY}_hours`, JSON.stringify(workingHours));
      localStorage.setItem(`${STORAGE_KEY}_holidays`, JSON.stringify(holidays));
      localStorage.setItem(`${STORAGE_KEY}_timeoffs`, JSON.stringify(timeOffs));
      localStorage.setItem(`${STORAGE_KEY}_coverages`, JSON.stringify(coverages));
      localStorage.setItem(`${STORAGE_KEY}_patients`, JSON.stringify(patients));
      localStorage.setItem(`${STORAGE_KEY}_appointments`, JSON.stringify(appointments));
      localStorage.setItem(`${STORAGE_KEY}_notes`, JSON.stringify(notes));
      localStorage.setItem(`${STORAGE_KEY}_templates`, JSON.stringify(templates));
    } catch {
      // Ignorar quota errors
    }
  }, [professional, locations, services, workingHours, holidays, timeOffs, coverages, patients, appointments, notes, templates]);

  // Persistir los cambios del dashboard en Supabase, en orden de dependencias FK.
  // Los datos clínicos y los turnos nunca se eliminan desde este sincronizador.
  useEffect(() => {
    if (!initialProfessional || publicWorkspace || !dataLoaded || !dbHydrated) return;
    const snapshot = { professional, locations, services, workingHours, holidays, timeOffs, coverages, patients, appointments, notes, templates };
    persistenceQueue.current = persistenceQueue.current
      .catch(() => undefined)
      .then(() => saveSupabaseWorkspace(snapshot))
      .then(() => setDataSyncError(null))
      .catch(error => setDataSyncError(error instanceof Error ? error.message : 'No se pudieron guardar los cambios en Supabase.'));
  }, [initialProfessional?.id, dataLoaded, dbHydrated, locations, services, workingHours, holidays, timeOffs, coverages, patients, appointments, templates]);

  useEffect(() => {
    if (!initialProfessional || publicWorkspace || !dbHydrated) return;
    const changedNotes = notes.filter(note => noteSignatures.current.get(note.id) !== JSON.stringify(note));
    if (!changedNotes.length) return;
    persistenceQueue.current = persistenceQueue.current
      .catch(() => undefined)
      .then(() => saveSupabaseNotes(changedNotes, initialProfessional.id))
      .then(() => {
        changedNotes.forEach(note => noteSignatures.current.set(note.id, JSON.stringify(note)));
        setDataSyncError(null);
      })
      .catch(error => setDataSyncError(error instanceof Error ? error.message : 'No se pudieron guardar las notas clínicas.'));
  }, [initialProfessional?.id, dbHydrated, notes]);

  // Limpieza periódica de Holds vencidos
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().toISOString();
      setHolds(prev => prev.filter(h => h.venceEn > now));
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const createHold = (
    serviceId: string,
    inicio: string,
    fin: string,
    modalidad: Modalidad,
    locationId?: string
  ): { success: boolean; hold?: AppointmentHold; error?: string } => {
    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Limpiar vencidos
    const activeHolds = holds.filter(h => h.venceEn > nowIso);

    // 2. Verificar solapamiento con turnos activos
    const inicioMs = new Date(inicio).getTime();
    const finMs = new Date(fin).getTime();

    const solapaTurno = appointments.some(app => {
      if (app.estado === 'cancelado' || app.estado === 'reprogramado') return false;
      const appIni = new Date(app.inicio).getTime();
      const appFin = new Date(app.fin).getTime();
      return inicioMs < appFin && finMs > appIni;
    });

    if (solapaTurno) {
      return { success: false, error: 'Ese horario ya no está libre. Se acaba de ocupar.' };
    }

    // 3. Verificar solapamiento con otro hold de otra sesión
    const solapaOtroHold = activeHolds.some(h => {
      if (h.sessionToken === sessionToken) return false;
      const hIni = new Date(h.inicio).getTime();
      const hFin = new Date(h.fin).getTime();
      return inicioMs < hFin && finMs > hIni;
    });

    if (solapaOtroHold) {
      return { success: false, error: 'Ese horario está temporalmente reservado por otro paciente.' };
    }

    // Crear Hold por 10 minutos (Regla 2.4 de la v6)
    const venceEn = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    const nuevoHold: AppointmentHold = {
      id: 'hold_' + Math.random().toString(36).slice(2, 10),
      professionalId: professional.id,
      serviceId,
      inicio,
      fin,
      modalidad,
      locationId,
      sessionToken,
      venceEn,
    };

    setHolds([...activeHolds.filter(h => h.sessionToken !== sessionToken), nuevoHold]);
    return { success: true, hold: nuevoHold };
  };

  const releaseHold = (holdId: string) => {
    setHolds(prev => prev.filter(h => h.id !== holdId));
  };

  const findPatientByDni = (dni: string): Patient | undefined => {
    const cleanDni = dni.replace(/\D/g, '');
    return patients.find(p => p.dni === cleanDni);
  };

  const addPatient = (data: {
    dni: string;
    nombre: string;
    telefonoE164: string;
    email?: string;
    coverageId?: string | null;
    plan?: string;
    nroAfiliado?: string;
    notasInternas?: string;
  }): { success: boolean; patient?: Patient; error?: string } => {
    const cleanDni = data.dni.replace(/\D/g, '');
    if (cleanDni.length < 7 || cleanDni.length > 8) {
      return { success: false, error: 'DNI inválido (debe tener 7 u 8 dígitos).' };
    }

    const existe = patients.some(p => p.dni === cleanDni);
    if (existe) {
      return { success: false, error: `Ya existe un paciente registrado con el DNI ${cleanDni}.` };
    }

    const nuevoPaciente: Patient = {
      id: createDataId('pat_'),
      professionalId: professional.id,
      dni: cleanDni,
      nombre: data.nombre.trim(),
      telefonoE164: data.telefonoE164,
      email: data.email?.trim(),
      coverageId: data.coverageId || null, // null = Particular
      plan: data.plan?.trim(),
      nroAfiliado: data.nroAfiliado?.trim(),
      notasInternas: data.notasInternas?.trim(),
      creadoEn: new Date().toISOString(),
    };

    setPatients(prev => [nuevoPaciente, ...prev]);
    return { success: true, patient: nuevoPaciente };
  };

  const updatePatient = (
    id: string,
    data: Partial<{
      dni: string;
      nombre: string;
      telefonoE164: string;
      email?: string;
      coverageId?: string | null;
      plan?: string;
      nroAfiliado?: string;
      notasInternas?: string;
    }>
  ): { success: boolean; patient?: Patient; error?: string } => {
    const pacienteActual = patients.find(p => p.id === id);
    if (!pacienteActual) {
      return { success: false, error: 'Paciente no encontrado.' };
    }

    let cleanDni = pacienteActual.dni;
    if (data.dni) {
      cleanDni = data.dni.replace(/\D/g, '');
      if (cleanDni.length < 7 || cleanDni.length > 8) {
        return { success: false, error: 'DNI inválido (debe tener 7 u 8 dígitos).' };
      }
      const existeOtro = patients.some(p => p.dni === cleanDni && p.id !== id);
      if (existeOtro) {
        return { success: false, error: `Ya existe otro paciente con el DNI ${cleanDni}.` };
      }
    }

    const actualizado: Patient = {
      ...pacienteActual,
      dni: cleanDni,
      nombre: data.nombre !== undefined ? data.nombre.trim() : pacienteActual.nombre,
      telefonoE164: data.telefonoE164 !== undefined ? data.telefonoE164 : pacienteActual.telefonoE164,
      email: data.email !== undefined ? data.email.trim() : pacienteActual.email,
      coverageId: data.coverageId !== undefined ? (data.coverageId || null) : pacienteActual.coverageId,
      plan: data.plan !== undefined ? data.plan.trim() : pacienteActual.plan,
      nroAfiliado: data.nroAfiliado !== undefined ? data.nroAfiliado.trim() : pacienteActual.nroAfiliado,
      notasInternas: data.notasInternas !== undefined ? data.notasInternas.trim() : pacienteActual.notasInternas,
    };

    setPatients(prev => prev.map(p => (p.id === id ? actualizado : p)));

    // Sincronizar datos visibles en citas de este paciente
    const cov = actualizado.coverageId ? coverages.find(c => c.id === actualizado.coverageId) : null;
    const coberturaNombre = cov ? cov.nombre : 'Particular';

    setAppointments(prev =>
      prev.map(app => {
        if (app.patientId === id) {
          return {
            ...app,
            pacienteNombre: actualizado.nombre,
            pacienteDni: actualizado.dni,
            pacienteTelefono: actualizado.telefonoE164,
            pacienteEmail: actualizado.email,
            pacienteCobertura: coberturaNombre,
            pacientePlan: actualizado.plan,
            pacienteAfiliado: actualizado.nroAfiliado,
          };
        }
        return app;
      })
    );

    return { success: true, patient: actualizado };
  };

  const bookAppointment = (params: {
    holdId?: string;
    serviceId: string;
    inicio: string;
    fin: string;
    modalidad: Modalidad;
    locationId?: string;
    pacienteNombre: string;
    pacienteDni: string;
    pacienteTelefono: string;
    pacienteEmail?: string;
    pacienteCoberturaId?: string | null;
    pacientePlan?: string;
    pacienteAfiliado?: string;
    motivo?: string;
    origen: 'portal' | 'dashboard';
    esSobreturno?: boolean;
    estadoPago?: EstadoPago;
  }): { success: boolean; appointment?: Appointment; error?: string } => {
    const srv = services.find(s => s.id === params.serviceId);
    if (!srv) {
      return { success: false, error: 'Servicio no encontrado.' };
    }

    const cleanDni = params.pacienteDni.replace(/\D/g, '');
    if (cleanDni.length < 7 || cleanDni.length > 8) {
      return { success: false, error: 'DNI inválido. Debe contener 7 u 8 números.' };
    }

    // Verificar si ya existe el paciente por DNI (D-13 / 2.13)
    let pacienteExistente = patients.find(p => p.dni === cleanDni);
    let patientId = pacienteExistente?.id;

    if (!pacienteExistente) {
      // Dar de alta paciente
      const nuevoPaciente: Patient = {
        id: createDataId('pat_'),
        professionalId: professional.id,
        dni: cleanDni,
        nombre: params.pacienteNombre.trim(),
        telefonoE164: params.pacienteTelefono,
        email: params.pacienteEmail?.trim(),
        coverageId: params.pacienteCoberturaId || null,
        plan: params.pacientePlan?.trim(),
        nroAfiliado: params.pacienteAfiliado?.trim(),
        creadoEn: new Date().toISOString(),
      };
      setPatients(prev => [...prev, nuevoPaciente]);
      patientId = nuevoPaciente.id;
      pacienteExistente = nuevoPaciente;
    }

    // Obtener nombre de la cobertura (null o no encontrada = Particular)
    const effectiveCovId = params.pacienteCoberturaId ?? pacienteExistente.coverageId;
    const cov = effectiveCovId ? coverages.find(c => c.id === effectiveCovId) : null;
    const coberturaNombre = cov ? cov.nombre : 'Particular';

    // Generar token de gestión único para el paciente
    const manageToken = 'mng_' + Math.random().toString(36).slice(2, 12);

    const nuevoTurno: Appointment = {
      id: createDataId('app_'),
      professionalId: professional.id,
      patientId: patientId || 'pat_anon',
      serviceId: params.serviceId,
      locationId: params.locationId,
      modalidad: params.modalidad,
      inicio: params.inicio,
      fin: params.fin,
      estado: 'pendiente',
      estadoPago: params.estadoPago || 'sin_pago',
      precioCentavos: srv.precioCentavos,
      motivo: params.motivo?.trim(),
      origen: params.origen,
      esSobreturno: !!params.esSobreturno,
      manageToken,
      creadoEn: new Date().toISOString(),
      pacienteNombre: params.pacienteNombre.trim(),
      pacienteDni: cleanDni,
      pacienteTelefono: params.pacienteTelefono,
      pacienteEmail: params.pacienteEmail?.trim(),
      pacienteCobertura: coberturaNombre,
      pacientePlan: params.pacientePlan?.trim(),
      pacienteAfiliado: params.pacienteAfiliado?.trim(),
    };

    setAppointments(prev => [nuevoTurno, ...prev]);

    // Consumir el hold si existía
    if (params.holdId) {
      releaseHold(params.holdId);
    }

    return { success: true, appointment: nuevoTurno };
  };

  const changeAppointmentStatus = (
    id: string,
    nuevoEstado: EstadoTurno,
    motivo?: string
  ): { success: boolean; error?: string } => {
    setAppointments(prev =>
      prev.map(app => {
        if (app.id !== id) return app;
        return {
          ...app,
          estado: nuevoEstado,
          motivo: motivo || app.motivo,
          canceladoPor: nuevoEstado === 'cancelado' ? ('profesional' as ActorCambio) : app.canceladoPor,
          notasCancelacion: nuevoEstado === 'cancelado' ? (motivo || 'Cancelado por el profesional') : app.notasCancelacion,
        };
      })
    );
    return { success: true };
  };

  const setAppointmentPayment = (id: string, pagado: boolean) => {
    setAppointments(prev =>
      prev.map(app => {
        if (app.id !== id) return app;
        // Turnos terminales conservan su estado de pago (Regla 1.6 / 2.7)
        if (['atendido', 'cancelado', 'ausente', 'reprogramado'].includes(app.estado)) {
          // Si ya está atendido se permite registrar el pago pendiente
          if (app.estado === 'atendido') {
            return { ...app, estadoPago: pagado ? 'pagado' : 'sin_pago' };
          }
          return app;
        }
        return {
          ...app,
          estadoPago: pagado ? 'pagado' : 'sin_pago',
        };
      })
    );
  };

  const rescheduleAppointment = (
    appointmentId: string,
    nuevoInicio: string,
    nuevoFin: string,
    esSobreturno?: boolean
  ): { success: boolean; newAppointment?: Appointment; error?: string } => {
    const turnoOriginal = appointments.find(a => a.id === appointmentId);
    if (!turnoOriginal) {
      return { success: false, error: 'Turno no encontrado.' };
    }

    const nuevoId = createDataId('app_');

    const nuevoTurno: Appointment = {
      ...turnoOriginal,
      id: nuevoId,
      inicio: nuevoInicio,
      fin: nuevoFin,
      estado: 'pendiente',
      origen: 'dashboard',
      esSobreturno: esSobreturno !== undefined ? esSobreturno : turnoOriginal.esSobreturno,
      reprogramadoDe: turnoOriginal.id,
      reprogramadoA: undefined,
      creadoEn: new Date().toISOString(),
    };

    setAppointments(prev =>
      prev.map(app => {
        if (app.id === appointmentId) {
          return {
            ...app,
            estado: 'reprogramado' as EstadoTurno,
            reprogramadoA: nuevoId,
          };
        }
        return app;
      }).concat(nuevoTurno)
    );

    return { success: true, newAppointment: nuevoTurno };
  };

  const saveConsultationNote = (noteData: Partial<ConsultationNote> & { patientId: string }): ConsultationNote => {
    let savedNote: ConsultationNote;
    const targetId = noteData.id;

    setNotes(prev => {
      const existingIndex = prev.findIndex(
        n => (targetId && n.id === targetId) || (noteData.appointmentId && n.appointmentId === noteData.appointmentId)
      );

      if (existingIndex >= 0) {
        savedNote = {
          ...prev[existingIndex],
          ...noteData,
          version: (prev[existingIndex].version || 1) + 1,
          actualizadoEn: new Date().toISOString(),
        };
        const copy = [...prev];
        copy[existingIndex] = savedNote;
        return copy;
      } else {
        savedNote = {
          id: targetId || createDataId('note_'),
          professionalId: professional.id,
          patientId: noteData.patientId,
          appointmentId: noteData.appointmentId,
          atendidoEn: noteData.atendidoEn || new Date().toISOString(),
          especialidad: noteData.especialidad || professional.especialidad,
          contenidoJson: noteData.contenidoJson || '{}',
          textoPlano: noteData.textoPlano || '',
          version: 1,
          adjuntos: noteData.adjuntos || [],
          actualizadoEn: new Date().toISOString(),
        };
        return [savedNote, ...prev];
      }
    });

    return savedNote!;
  };

  // Sección 4: Borrar pacientes, turnos, fichas, notas está BLOQUEADO por diseño
  const deleteConsultationNote = (noteId: string) => {
    console.warn('Borrado bloqueado por diseño: los datos clínicos y de agenda se conservan.', noteId);
  };

  const updateProfessional = (data: Partial<Professional>) => {
    const updated = { ...professional, ...data };
    setProfessional(updated);
    if (initialProfessional && supabase) {
      void supabase.from('profesionales').update({
        slug: updated.slug,
        nombre: updated.nombre,
        titulo: updated.titulo,
        especialidad: updated.especialidad,
        matricula_nacional: updated.matriculaNacional || null,
        matricula_provincial: updated.matriculaProvincial || null,
        telefono_contacto: updated.telefonoContactoPrivado || null,
        cbu_cvu: updated.cbu || null,
        alias_mp: updated.aliasCobro || null,
        titular_cuenta: updated.titularCobro || null,
        cuit: updated.cuit || null,
        banco: updated.banco || null,
        foto_perfil_path: updated.fotoPerfil || null,
        tamano_texto: updated.tamanoTexto || 'predeterminado',
        zona_horaria: updated.zonaHoraria,
        agenda_pausada: updated.agendaPausada,
        intervalo_turnos_min: updated.parametros.grillaMin,
        anticipacion_minima_hs: updated.parametros.anticipacionMinHoras,
        horizonte_maximo_dias: updated.parametros.horizonteDias,
        margen_entre_turnos_min: updated.parametros.margenMin,
        plazo_cancelacion_hs: updated.parametros.plazoCancelacionHoras,
      }).eq('id', updated.id).then(({ error }) => {
        if (error) setDataSyncError(`Perfil profesional: ${error.message}`);
      });
    }
  };

  const setTamanoTexto = (size: FontSizePreference) => {
    updateProfessional({ tamanoTexto: size });
  };

  const updateWorkingHours = (hours: WorkingHours[]) => {
    setWorkingHours(hours);
  };

  const updateServices = (newServices: Service[]) => {
    setServices(newServices);
  };

  const updateTemplates = (newTemplates: MessageTemplate[]) => {
    setTemplates(newTemplates);
  };

  const toggleAgendaPausa = () => {
    updateProfessional({ agendaPausada: !professional.agendaPausada });
  };

  const exportarCsvTurnos = (turnosAExportar: Appointment[]) => {
    // Encabezados en español acordes a la v6 (separador ; y BOM para Excel en español)
    const encabezados = [
      'ID Turno',
      'Fecha',
      'Hora Inicio',
      'Hora Fin',
      'Paciente',
      'DNI',
      'Teléfono',
      'Email',
      'Cobertura',
      'Servicio',
      'Modalidad',
      'Arancel',
      'Estado Turno',
      'Estado Pago',
      'Origen',
      'Motivo',
    ];

    const filas = turnosAExportar.map(t => {
      const srv = services.find(s => s.id === t.serviceId);
      return [
        t.id,
        formatearFechaCorta(t.inicio),
        formatearHora(t.inicio),
        formatearHora(t.fin),
        `"${t.pacienteNombre.replace(/"/g, '""')}"`,
        t.pacienteDni,
        t.pacienteTelefono,
        t.pacienteEmail || '',
        `"${t.pacienteCobertura || 'Particular'}"`,
        `"${(srv?.nombre || 'Consulta').replace(/"/g, '""')}"`,
        t.modalidad === 'presencial' ? 'Presencial' : 'Videollamada',
        formatearMoneda(t.precioCentavos),
        t.estado.toUpperCase(),
        t.estadoPago.toUpperCase(),
        t.origen,
        `"${(t.motivo || '').replace(/"/g, '""')}"`,
      ].join(';');
    });

    // UTF-8 BOM \uFEFF para que Excel abra sin problemas de acentos
    const csvContent = '\uFEFF' + [encabezados.join(';'), ...filas].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MediTurnos-Agenda-${professional.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportarGoogleSheetsData = () => {
    const headers = [
      'ID Turno',
      'Fecha',
      'Hora Inicio',
      'Hora Fin',
      'Paciente',
      'DNI',
      'Teléfono WhatsApp',
      'Email',
      'Servicio',
      'Modalidad',
      'Ubicación',
      'Cobertura Médica',
      'Plan / Afiliado',
      'Estado Turno',
      'Estado Pago',
      'Arancel (ARS)',
      'Motivo Consulta',
      'Origen',
    ];

    const rows = appointments.map(app => {
      const srv = services.find(s => s.id === app.serviceId);
      const loc = locations.find(l => l.id === app.locationId);
      const fecha = app.inicio.slice(0, 10);
      const horaIni = app.inicio.slice(11, 16);
      const horaFin = app.fin.slice(11, 16);
      const arancel = (app.precioCentavos / 100).toFixed(2);

      return [
        app.id,
        fecha,
        horaIni,
        horaFin,
        `"${app.pacienteNombre.replace(/"/g, '""')}"`,
        app.pacienteDni,
        `"${app.pacienteTelefono}"`,
        app.pacienteEmail || '',
        `"${(srv?.nombre || 'Consulta').replace(/"/g, '""')}"`,
        app.modalidad,
        `"${(loc?.nombre || 'Consultorio').replace(/"/g, '""')}"`,
        `"${app.pacienteCobertura.replace(/"/g, '""')}"`,
        `"${(app.pacientePlan || '') + (app.pacienteAfiliado ? ` - ${app.pacienteAfiliado}` : '')}"`,
        app.estado,
        app.estadoPago,
        arancel,
        `"${(app.motivo || '').replace(/"/g, '""')}"`,
        app.origen,
      ].join('\t');
    });

    const tsvContent = '\uFEFF' + [headers.join('\t'), ...rows].join('\n');
    const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MediTurnos-GoogleSheets-${professional.slug}-${new Date().toISOString().slice(0, 10)}.tsv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportarGoogleDriveBackup = () => {
    const backupData = {
      meta: {
        app: 'MediTurnos',
        version: '2.0-Hito2',
        fechaExportacion: new Date().toISOString(),
        profesional: {
          nombre: professional.nombre,
          titulo: professional.titulo,
          especialidad: professional.especialidad,
          matriculaNacional: professional.matriculaNacional,
          matriculaProvincial: professional.matriculaProvincial,
          aliasCobro: professional.aliasCobro,
          titularCobro: professional.titularCobro,
          cbu: professional.cbu,
        },
      },
      estadisticas: {
        totalPacientes: patients.length,
        totalFichasClinicas: notes.length,
        totalTurnos: appointments.length,
      },
      pacientes: patients,
      fichasClinicas: notes,
      turnos: appointments,
      servicios: services,
      direcciones: locations,
      configuracionHorarios: workingHours,
      feriados: holidays,
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MediTurnos-Backup-GoogleDrive-${professional.slug}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Guardar timestamp de último respaldo
    const ahoraIso = new Date().toISOString();
    try {
      localStorage.setItem('mediturnos_last_drive_sync', ahoraIso);
    } catch {
      // Ignorar si localstorage no está disponible
    }
  };

  const exportarHistoriaClinicaPaciente = (patientId: string) => {
    const paciente = patients.find(p => p.id === patientId);
    if (!paciente) return;

    const notasPaciente = notes
      .filter(n => n.patientId === patientId)
      .sort((a, b) => new Date(b.actualizadoEn || b.atendidoEn).getTime() - new Date(a.actualizadoEn || a.atendidoEn).getTime());

    const turnosPaciente = appointments
      .filter(a => a.patientId === patientId || a.pacienteDni === paciente.dni)
      .sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime());

    const cov = coverages.find(c => c.id === paciente.coverageId);

    const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Historia Clínica - ${paciente.nombre} (DNI ${paciente.dni})</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5; padding: 32px; max-width: 800px; margin: auto; }
    .header { border-bottom: 2px solid #0284c7; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
    .header h1 { margin: 0; font-size: 22px; color: #0369a1; }
    .header p { margin: 2px 0; font-size: 13px; color: #64748b; }
    .paciente-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; }
    .nota-card { border-left: 3px solid #0284c7; padding-left: 16px; margin-bottom: 24px; }
    .nota-fecha { font-size: 12px; font-weight: 700; color: #0284c7; text-transform: uppercase; margin-bottom: 4px; }
    .nota-titulo { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
    .nota-cuerpo { font-size: 14px; color: #334155; white-space: pre-wrap; background: #fff; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; }
    .footer { margin-top: 40px; border-top: 1px solid #cbd5e1; pt-4; font-size: 11px; color: #94a3b8; text-align: center; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${professional.titulo} ${professional.nombre}</h1>
      <p><strong>${professional.especialidad}</strong></p>
      <p>M.N. ${professional.matriculaNacional} · M.P. ${professional.matriculaProvincial}</p>
    </div>
    <div style="text-align: right;">
      <p><strong>HISTORIA CLÍNICA</strong></p>
      <p>Fecha de emisión: ${new Date().toLocaleDateString('es-AR')}</p>
    </div>
  </div>

  <div class="paciente-card">
    <div class="grid">
      <div><strong>Paciente:</strong> ${paciente.nombre}</div>
      <div><strong>DNI:</strong> ${paciente.dni}</div>
      <div><strong>Teléfono:</strong> ${paciente.telefonoE164}</div>
      <div><strong>Email:</strong> ${paciente.email || 'No registrado'}</div>
      <div><strong>Cobertura:</strong> ${cov?.nombre || 'Particular'} ${paciente.plan ? `(${paciente.plan})` : ''}</div>
      <div><strong>N° Afiliado:</strong> ${paciente.nroAfiliado || '-'}</div>
    </div>
    ${paciente.notasInternas ? `<div style="margin-top: 12px; font-size: 12px; color: #475569;"><strong>Observaciones generales:</strong> ${paciente.notasInternas}</div>` : ''}
  </div>

  <h2 style="font-size: 16px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Evoluciones y Notas Clínicas (${notasPaciente.length})</h2>

  ${notasPaciente.length === 0 ? '<p style="font-size: 13px; color: #94a3b8; font-style: italic;">No registra notas clínicas cargadas.</p>' : ''}

  ${notasPaciente.map(nota => `
    <div class="nota-card">
      <div class="nota-fecha">Fecha: ${new Date(nota.atendidoEn).toLocaleDateString('es-AR')} ${new Date(nota.atendidoEn).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</div>
      <div class="nota-titulo">Evolución / ${nota.especialidad || 'Consulta'}</div>
      <div class="nota-cuerpo">${nota.textoPlano || 'Sin contenido registrado'}</div>
    </div>
  `).join('')}

  <h2 style="font-size: 16px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-top: 32px;">Historial de Turnos y Asistencias (${turnosPaciente.length})</h2>
  <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px;">
    <thead>
      <tr style="background: #f1f5f9; text-align: left;">
        <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">Fecha</th>
        <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">Modalidad</th>
        <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">Estado</th>
        <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">Pago</th>
      </tr>
    </thead>
    <tbody>
      ${turnosPaciente.map(t => `
        <tr>
          <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${new Date(t.inicio).toLocaleDateString('es-AR')} ${new Date(t.inicio).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</td>
          <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${t.modalidad}</td>
          <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${t.estado}</td>
          <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${t.estadoPago === 'pagado' ? 'Pagado (Arancel Completo)' : 'Sin Pago'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    <p>Documento médico confidencial generado a través de MediTurnos para respaldo en Google Drive.</p>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HistoriaClinica-${paciente.dni}-${paciente.nombre.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const findAppointmentByManageToken = (token: string): Appointment | undefined => {
    if (!token) return undefined;
    return appointments.find(a => a.manageToken === token || a.id === token);
  };

  const cancelAppointmentByPatient = (
    token: string,
    motivo?: string
  ): { success: boolean; error?: string } => {
    const turno = appointments.find(a => a.manageToken === token || a.id === token);
    if (!turno) {
      return { success: false, error: 'Turno no encontrado.' };
    }
    if (turno.estado === 'cancelado') {
      return { success: false, error: 'El turno ya se encuentra cancelado.' };
    }
    if (turno.estado === 'atendido') {
      return { success: false, error: 'No es posible cancelar un turno que ya ha sido atendido.' };
    }

    const horasMin = professional.parametros.plazoCancelacionHoras ?? 24;
    const inicioMs = new Date(turno.inicio).getTime();
    const ahoraMs = Date.now();
    const difHoras = (inicioMs - ahoraMs) / (1000 * 60 * 60);

    if (difHoras < horasMin) {
      return {
        success: false,
        error: `El plazo de cancelación online es de hasta ${horasMin} horas de anticipación. Por favor comunicate directamente con el consultorio.`,
      };
    }

    setAppointments(prev =>
      prev.map(app => {
        if (app.id === turno.id) {
          return {
            ...app,
            estado: 'cancelado',
            canceladoPor: 'paciente',
            motivo: motivo || 'Cancelado por el paciente desde el portal',
            notasCancelacion: motivo || 'Cancelado por el paciente desde el portal',
          };
        }
        return app;
      })
    );

    return { success: true };
  };

  const rescheduleAppointmentByPatient = (
    token: string,
    nuevoInicio: string,
    nuevoFin: string
  ): { success: boolean; error?: string; newAppointment?: Appointment } => {
    const turnoOriginal = appointments.find(a => a.manageToken === token || a.id === token);
    if (!turnoOriginal) {
      return { success: false, error: 'Turno no encontrado.' };
    }
    if (turnoOriginal.estado === 'cancelado' || turnoOriginal.estado === 'atendido') {
      return { success: false, error: 'No se puede reprogramar un turno cancelado o ya atendido.' };
    }

    const horasMin = professional.parametros.plazoCancelacionHoras ?? 24;
    const inicioMs = new Date(turnoOriginal.inicio).getTime();
    const ahoraMs = Date.now();
    const difHoras = (inicioMs - ahoraMs) / (1000 * 60 * 60);

    if (difHoras < horasMin) {
      return {
        success: false,
        error: `El plazo para reprogramar online es de hasta ${horasMin} horas de anticipación. Por favor comunicate directamente con el consultorio.`,
      };
    }

    const nuevoId = createDataId('app_');
    const nuevoTurno: Appointment = {
      ...turnoOriginal,
      id: nuevoId,
      inicio: nuevoInicio,
      fin: nuevoFin,
      estado: 'pendiente',
      origen: 'portal',
      reprogramadoDe: turnoOriginal.id,
      reprogramadoA: undefined,
      creadoEn: new Date().toISOString(),
    };

    setAppointments(prev =>
      prev.map(app => {
        if (app.id === turnoOriginal.id) {
          return {
            ...app,
            estado: 'reprogramado' as EstadoTurno,
            reprogramadoA: nuevoId,
          };
        }
        return app;
      }).concat(nuevoTurno)
    );

    return { success: true, newAppointment: nuevoTurno };
  };

  // ============================================================================
  // Funciones del Portal Público (Contrato Supabase RPC Sección 5)
  // ============================================================================

  const portalAgendaPublica = async (params: {
    p_ref: string;
    p_desde: string;
    p_hasta: string;
    p_session_id?: string;
  }): Promise<PortalAgendaPublicaResult> => {
    if (initialProfessional && supabase) {
      const { data, error } = await supabase.rpc('portal_agenda_publica', params);
      if (error) throw new Error(error.message);
      return data as PortalAgendaPublicaResult;
    }
    const { p_ref, p_desde, p_hasta, p_session_id } = params;
    const match = professional.slug === p_ref || professional.publicId === p_ref;
    if (!match) throw new Error('profesional_no_encontrado');

    const dDesde = new Date(p_desde);
    const dHasta = new Date(p_hasta);
    if (isNaN(dDesde.getTime()) || isNaN(dHasta.getTime()) || dHasta < dDesde) {
      throw new Error('rango_invalido');
    }
    const diffDias = Math.round((dHasta.getTime() - dDesde.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDias > 62) {
      throw new Error('rango_invalido');
    }

    const ocupados: Array<{ inicio: string; fin: string }> = [];

    // Turnos activos (sin datos de pacientes)
    appointments.forEach(a => {
      if (['pendiente', 'atendido', 'ausente'].includes(a.estado) && !a.esSobreturno) {
        if (a.inicio < p_hasta + 'T23:59:59Z' && a.fin > p_desde + 'T00:00:00Z') {
          ocupados.push({ inicio: a.inicio, fin: a.fin });
        }
      }
    });

    // Holds ajenos
    const nowIso = new Date().toISOString();
    holds.forEach(h => {
      if (h.venceEn > nowIso && h.sessionToken !== p_session_id) {
        if (h.inicio < p_hasta + 'T23:59:59Z' && h.fin > p_desde + 'T00:00:00Z') {
          ocupados.push({ inicio: h.inicio, fin: h.fin });
        }
      }
    });

    // Ausencias
    timeOffs.forEach(t => {
      if (t.inicio < p_hasta + 'T23:59:59Z' && t.fin > p_desde + 'T00:00:00Z') {
        ocupados.push({ inicio: t.inicio, fin: t.fin });
      }
    });

    return {
      profesional: {
        id_publico: professional.publicId,
        slug: professional.slug,
        nombre: professional.nombre,
        titulo: professional.titulo,
        especialidad: professional.especialidad,
        matricula_nacional: professional.matriculaNacional || null,
        matricula_provincial: professional.matriculaProvincial || null,
        foto_perfil_path: professional.fotoPerfil || null,
        agenda_pausada: professional.agendaPausada,
        zona_horaria: professional.zonaHoraria,
        intervalo_turnos_min: professional.parametros.grillaMin,
        anticipacion_minima_hs: professional.parametros.anticipacionMinHoras,
        horizonte_maximo_dias: professional.parametros.horizonteDias,
        margen_entre_turnos_min: professional.parametros.margenMin,
        plazo_cancelacion_hs: professional.parametros.plazoCancelacionHoras ?? 24,
      },
      servicios: services.filter(s => s.activo).map(s => {
        let mod: any = 'ambas';
        if (s.modalidades && s.modalidades.length === 1) {
          mod = s.modalidades[0];
        }
        return {
          id: s.id,
          nombre: s.nombre,
          descripcion: s.descripcion || null,
          duracion_min: s.duracionMin,
          modalidad: mod,
          arancel_centavos: s.mostrarPrecio ? s.precioCentavos : null,
          moneda: s.moneda || 'ARS',
        };
      }),
      sedes: locations.filter(l => l.activa).map(l => ({
        id: l.id,
        nombre: l.nombre,
        direccion: l.direccion,
        indicaciones: l.indicaciones || null,
        maps_url: l.mapsUrl || null,
      })),
      coberturas: coverages.map(c => ({
        id: c.id,
        nombre: c.nombre,
        tipo: c.tipo,
      })),
      franjas: workingHours.filter(w => w.activo).map(w => ({
        id: w.id,
        dia_semana: w.diaSemana,
        hora_inicio: recortarHora(w.horaInicio),
        hora_fin: recortarHora(w.horaFin),
        modalidad_permitida: w.modalidad as any,
        sede_id: w.locationId || null,
        descansos: (w.descansos || []).map(d => ({
          hora_inicio: recortarHora(d.inicio),
          hora_fin: recortarHora(d.fin),
        })),
      })),
      ocupados,
      feriados: holidays
        .filter(h => h.fecha >= p_desde && h.fecha <= p_hasta)
        .map(h => ({
          fecha: h.fecha,
          nombre: h.nombre,
          laborable: h.laborable,
        })),
    };
  };

  const portalCrearHold = async (params: {
    p_ref: string;
    p_servicio_id: string;
    p_inicio: string;
    p_modalidad: Modalidad;
    p_sede_id?: string;
    p_session_id: string;
    p_ip?: string;
  }): Promise<PortalHoldResult> => {
    if (initialProfessional && supabase) {
      const { data, error } = await supabase.rpc('portal_crear_hold', params);
      if (error) throw new Error(error.message);
      return data as PortalHoldResult;
    }
    const { p_ref, p_servicio_id, p_inicio, p_modalidad, p_sede_id, p_session_id } = params;
    if (!p_session_id || p_session_id.trim().length < 8 || p_session_id.length > 128) {
      throw new Error('sesion_invalida');
    }
    if ((p_modalidad as string) === 'ambas') {
      throw new Error('modalidad_invalida');
    }
    const match = professional.slug === p_ref || professional.publicId === p_ref;
    if (!match) throw new Error('profesional_no_encontrado');
    if (professional.agendaPausada) throw new Error('agenda_pausada');

    const srv = services.find(s => s.id === p_servicio_id && s.activo);
    if (!srv) throw new Error('servicio_no_disponible');

    const effectiveSedeId =
      p_modalidad === 'presencial'
        ? (p_sede_id || locations.find(l => l.activa)?.id || locations[0]?.id)
        : undefined;

    if (p_modalidad === 'presencial' && locations.some(l => l.activa) && !effectiveSedeId) {
      throw new Error('sede_requerida');
    }

    const iniMs = new Date(p_inicio).getTime();
    const finMs = iniMs + srv.duracionMin * 60 * 1000;
    const p_fin = new Date(finMs).toISOString();

    const now = Date.now();
    const anticMinMs = (professional.parametros.anticipacionMinHoras ?? 2) * 3600 * 1000;
    if (iniMs < now + anticMinMs) {
      throw new Error('fuera_de_anticipacion');
    }
    const horizMaxMs = (professional.parametros.horizonteDias ?? 30) * 24 * 3600 * 1000;
    if (iniMs > now + horizMaxMs) {
      throw new Error('fuera_de_horizonte');
    }

    // Verificar colisión con turnos o bloqueos ajenos
    const solapaTurno = appointments.some(app => {
      if (['cancelado', 'reprogramado'].includes(app.estado) || app.esSobreturno) return false;
      const appIni = new Date(app.inicio).getTime();
      const appFin = new Date(app.fin).getTime();
      return iniMs < appFin && finMs > appIni;
    });
    if (solapaTurno) throw new Error('horario_ocupado');

    const solapaHold = holds.some(h => {
      if (h.sessionToken === p_session_id) return false;
      if (new Date(h.venceEn).getTime() <= now) return false;
      const hIni = new Date(h.inicio).getTime();
      const hFin = new Date(h.fin).getTime();
      return iniMs < hFin && finMs > hIni;
    });
    if (solapaHold) throw new Error('horario_ocupado');

    // Hold por 10 minutos
    const expira = new Date(now + 10 * 60 * 1000).toISOString();
    const holdId = 'hold_' + Math.random().toString(36).slice(2, 10);
    const nuevoHold: AppointmentHold = {
      id: holdId,
      professionalId: professional.id,
      serviceId: srv.id,
      inicio: p_inicio,
      fin: p_fin,
      modalidad: p_modalidad,
      locationId: effectiveSedeId,
      sessionToken: p_session_id,
      venceEn: expira,
    };

    setHolds(prev => [...prev.filter(h => h.sessionToken !== p_session_id && h.venceEn > new Date().toISOString()), nuevoHold]);

    return {
      hold_id: holdId,
      inicio: p_inicio,
      fin: p_fin,
      expira,
    };
  };

  const portalConfirmarTurno = async (params: {
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
  }): Promise<PortalConfirmarTurnoResult> => {
    if (initialProfessional && supabase) {
      const { data, error } = await supabase.rpc('portal_confirmar_turno', params);
      if (error) throw new Error(error.message);
      return data as PortalConfirmarTurnoResult;
    }
    const {
      p_ref,
      p_hold_id,
      p_session_id,
      p_dni,
      p_nombre,
      p_telefono_e164,
      p_email,
      p_cobertura_id,
      p_plan,
      p_nro_afiliado,
      p_motivo,
    } = params;

    const match = professional.slug === p_ref || professional.publicId === p_ref;
    if (!match) throw new Error('profesional_no_encontrado');
    if (professional.agendaPausada) throw new Error('agenda_pausada');

    const cleanDni = p_dni.toUpperCase().replace(/\D/g, '');
    if (cleanDni.length < 7 || cleanDni.length > 8) throw new Error('datos_invalidos');
    if (!p_nombre.trim() || p_nombre.trim().length > 150) throw new Error('datos_invalidos');

    const targetHold = holds.find(
      h => h.id === p_hold_id && h.sessionToken === p_session_id && h.venceEn > new Date().toISOString()
    );
    if (!targetHold) throw new Error('reserva_vencida');

    const srv = services.find(s => s.id === targetHold.serviceId);
    if (!srv) throw new Error('servicio_no_disponible');

    // Upsert paciente: si el DNI ya existe, NO se modifican sus datos (Sección 5.1)
    let paciente = patients.find(p => p.dni === cleanDni);
    if (!paciente) {
      const nuevoPaciente: Patient = {
        id: createDataId('pat_'),
        professionalId: professional.id,
        dni: cleanDni,
        nombre: p_nombre.trim(),
        telefonoE164: p_telefono_e164,
        email: p_email?.trim() || undefined,
        coverageId: p_cobertura_id || null, // null = Particular
        plan: p_plan?.trim() || undefined,
        nroAfiliado: p_nro_afiliado?.trim() || undefined,
        creadoEn: new Date().toISOString(),
      };
      paciente = nuevoPaciente;
      setPatients(prev => [nuevoPaciente, ...prev]);
    }

    const cov = paciente.coverageId ? coverages.find(c => c.id === paciente.coverageId) : null;
    const coberturaNombre = cov ? cov.nombre : 'Particular';

    const manageToken = 'mng_' + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
    const turnoId = createDataId('app_');

    const nuevoTurno: Appointment = {
      id: turnoId,
      professionalId: professional.id,
      patientId: paciente.id,
      serviceId: targetHold.serviceId,
      locationId: targetHold.locationId,
      modalidad: targetHold.modalidad,
      inicio: targetHold.inicio,
      fin: targetHold.fin,
      estado: 'pendiente',
      estadoPago: 'sin_pago',
      precioCentavos: srv.precioCentavos,
      motivo: p_motivo?.trim() || undefined,
      origen: 'portal',
      esSobreturno: false,
      manageToken,
      creadoEn: new Date().toISOString(),
      pacienteNombre: paciente.nombre,
      pacienteDni: paciente.dni,
      pacienteTelefono: paciente.telefonoE164,
      pacienteEmail: paciente.email,
      pacienteCobertura: coberturaNombre,
      pacientePlan: paciente.plan,
      pacienteAfiliado: paciente.nroAfiliado,
    };

    setAppointments(prev => [nuevoTurno, ...prev]);
    setHolds(prev => prev.filter(h => h.id !== targetHold.id));

    const sedeObj = targetHold.locationId ? locations.find(l => l.id === targetHold.locationId) : null;

    return {
      turno_id: turnoId,
      manage_token: manageToken,
      inicio: targetHold.inicio,
      fin: targetHold.fin,
      modalidad: targetHold.modalidad,
      servicio: srv.nombre,
      arancel_centavos: srv.mostrarPrecio ? srv.precioCentavos : null,
      sede: sedeObj ? {
        nombre: sedeObj.nombre,
        direccion: sedeObj.direccion,
        indicaciones: sedeObj.indicaciones || null,
        maps_url: sedeObj.mapsUrl || null,
      } : null,
      datos_cobro: srv.precioCentavos > 0 && professional.aliasCobro ? {
        alias: professional.aliasCobro,
        titular: professional.titularCobro || professional.nombre,
      } : null,
    };
  };

  const portalVerTurno = async (params: { p_token: string }): Promise<PortalVerTurnoResult> => {
    if (initialProfessional && supabase) {
      const { data, error } = await supabase.rpc('portal_ver_turno', params);
      if (error) throw new Error(error.message);
      return data as PortalVerTurnoResult;
    }
    const { p_token } = params;
    const turno = appointments.find(a => a.manageToken === p_token || a.id === p_token);
    if (!turno) throw new Error('turno_no_encontrado');

    const srv = services.find(s => s.id === turno.serviceId);
    const sedeObj = turno.locationId ? locations.find(l => l.id === turno.locationId) : null;
    const plazoHs = professional.parametros.plazoCancelacionHoras ?? 24;

    const iniMs = new Date(turno.inicio).getTime();
    const ahoraMs = Date.now();
    const dentroDePlazo = turno.estado === 'pendiente' && (iniMs - plazoHs * 3600 * 1000) > ahoraMs;

    const reprogramadoA = appointments.find(a => a.reprogramadoDe === turno.id)?.id || null;

    return {
      turno_id: turno.id,
      servicio_id: turno.serviceId,
      inicio: turno.inicio,
      fin: turno.fin,
      estado: turno.estado,
      modalidad: turno.modalidad,
      servicio: srv?.nombre || 'Consulta',
      profesional: professional.nombre,
      slug: professional.slug,
      sede: sedeObj ? {
        nombre: sedeObj.nombre,
        direccion: sedeObj.direccion,
        maps_url: sedeObj.mapsUrl || null,
      } : null,
      plazo_cancelacion_hs: plazoHs,
      puede_cancelar: dentroDePlazo,
      puede_reprogramar: dentroDePlazo,
      reprogramado_a: reprogramadoA,
    };
  };

  const portalCancelarTurno = async (params: {
    p_token: string;
    p_motivo?: string;
    p_ip?: string;
  }): Promise<PortalCancelarTurnoResult> => {
    if (initialProfessional && supabase) {
      const { data, error } = await supabase.rpc('portal_cancelar_turno', params);
      if (error) throw new Error(error.message);
      return data as PortalCancelarTurnoResult;
    }
    const { p_token, p_motivo } = params;
    const turno = appointments.find(a => a.manageToken === p_token || a.id === p_token);
    if (!turno) throw new Error('turno_no_encontrado');
    if (turno.estado !== 'pendiente') throw new Error('turno_no_cancelable');

    const plazoHs = professional.parametros.plazoCancelacionHoras ?? 24;
    const iniMs = new Date(turno.inicio).getTime();
    if (iniMs - plazoHs * 3600 * 1000 <= Date.now()) {
      throw new Error('fuera_de_plazo');
    }

    setAppointments(prev =>
      prev.map(a =>
        a.id === turno.id
          ? {
              ...a,
              estado: 'cancelado' as EstadoTurno,
              canceladoPor: 'paciente' as ActorCambio,
              notasCancelacion: p_motivo || 'Cancelado por el paciente desde el portal',
            }
          : a
      )
    );

    return { turno_id: turno.id, estado: 'cancelado' };
  };

  const portalReprogramarTurno = async (params: {
    p_token: string;
    p_hold_id: string;
    p_session_id: string;
    p_ip?: string;
  }): Promise<PortalReprogramarTurnoResult> => {
    if (initialProfessional && supabase) {
      const { data, error } = await supabase.rpc('portal_reprogramar_turno', params);
      if (error) throw new Error(error.message);
      return data as PortalReprogramarTurnoResult;
    }
    const { p_token, p_hold_id, p_session_id } = params;
    const oldTurno = appointments.find(a => a.manageToken === p_token || a.id === p_token);
    if (!oldTurno) throw new Error('turno_no_encontrado');
    if (oldTurno.estado !== 'pendiente') throw new Error('turno_no_reprogramable');

    const plazoHs = professional.parametros.plazoCancelacionHoras ?? 24;
    const iniMs = new Date(oldTurno.inicio).getTime();
    if (iniMs - plazoHs * 3600 * 1000 <= Date.now()) {
      throw new Error('fuera_de_plazo');
    }
    if (professional.agendaPausada) throw new Error('agenda_pausada');

    const hold = holds.find(
      h => h.id === p_hold_id && h.sessionToken === p_session_id && h.venceEn > new Date().toISOString()
    );
    if (!hold) throw new Error('reserva_vencida');
    if (hold.serviceId !== oldTurno.serviceId) throw new Error('servicio_distinto');

    const newToken = 'mng_' + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
    const newId = 'app_' + Math.random().toString(36).slice(2, 10);

    const newTurno: Appointment = {
      ...oldTurno,
      id: newId,
      inicio: hold.inicio,
      fin: hold.fin,
      modalidad: hold.modalidad,
      locationId: hold.locationId,
      estado: 'pendiente',
      origen: 'portal',
      reprogramadoDe: oldTurno.id,
      reprogramadoA: undefined,
      manageToken: newToken,
      creadoEn: new Date().toISOString(),
    };

    setAppointments(prev =>
      prev
        .map(a =>
          a.id === oldTurno.id
            ? { ...a, estado: 'reprogramado' as EstadoTurno, reprogramadoA: newId }
            : a
        )
        .concat(newTurno)
    );

    setHolds(prev => prev.filter(h => h.id !== hold.id));

    const srv = services.find(s => s.id === hold.serviceId);
    const sedeObj = hold.locationId ? locations.find(l => l.id === hold.locationId) : null;

    return {
      turno_id: newId,
      turno_anterior_id: oldTurno.id,
      manage_token: newToken,
      inicio: hold.inicio,
      fin: hold.fin,
      modalidad: hold.modalidad,
      servicio: srv?.nombre || 'Consulta',
      sede: sedeObj ? {
        nombre: sedeObj.nombre,
        direccion: sedeObj.direccion,
        indicaciones: sedeObj.indicaciones || null,
        maps_url: sedeObj.mapsUrl || null,
      } : null,
    };
  };

  const addCoverage = (nombre: string): Coverage => {
    const trimmed = nombre.trim();
    const id = createDataId('cov_');
    const nueva: Coverage = {
      id,
      nombre: trimmed,
      tipo: 'obra_social',
    };
    setCoverages(prev => {
      const actualizadas = [...prev, nueva];
      if (!initialProfessional) {
        try { localStorage.setItem(`${STORAGE_KEY}_coverages`, JSON.stringify(actualizadas)); } catch (e) { console.error(e); }
      }
      return actualizadas;
    });
    return nueva;
  };

  const updateCoverages = (nuevas: Coverage[]) => {
    setCoverages(nuevas);
  };

  const toggleHolidayLaborable = (holidayId: string) => {
    setHolidays(prev => {
      const actualizados = prev.map(h =>
        h.id === holidayId ? { ...h, laborable: !h.laborable } : h
      );
      if (!initialProfessional) {
        try { localStorage.setItem(`${STORAGE_KEY}_holidays`, JSON.stringify(actualizados)); } catch (e) { console.error(e); }
      }
      return actualizados;
    });
  };

  const updateHolidays = (nuevos: Holiday[]) => {
    setHolidays(nuevos);
  };

  const resetToDemoData = () => {
    if (initialProfessional) {
      setDataSyncError('El reinicio a datos demo está deshabilitado mientras usas Supabase.');
      return;
    }
    localStorage.removeItem(`${STORAGE_KEY}_prof`);
    localStorage.removeItem(`${STORAGE_KEY}_locs`);
    localStorage.removeItem(`${STORAGE_KEY}_services`);
    localStorage.removeItem(`${STORAGE_KEY}_hours`);
    localStorage.removeItem(`${STORAGE_KEY}_holidays`);
    localStorage.removeItem(`${STORAGE_KEY}_timeoffs`);
    localStorage.removeItem(`${STORAGE_KEY}_coverages`);
    localStorage.removeItem(`${STORAGE_KEY}_patients`);
    localStorage.removeItem(`${STORAGE_KEY}_appointments`);
    localStorage.removeItem(`${STORAGE_KEY}_notes`);
    localStorage.removeItem(`${STORAGE_KEY}_templates`);

    setProfessional(INITIAL_PROFESSIONAL);
    setLocations(INITIAL_LOCATIONS);
    setServices(INITIAL_SERVICES);
    setWorkingHours(INITIAL_WORKING_HOURS);
    setHolidays(INITIAL_HOLIDAYS);
    setTimeOffs([]);
    setCoverages(INITIAL_COVERAGES);
    setPatients(INITIAL_PATIENTS);
    setAppointments(generarTurnosIniciales());
    setHolds([]);
    setNotes(INITIAL_CONSULTATION_NOTES);
    setTemplates(INITIAL_TEMPLATES);
  };

  // Métodos de Google Drive & Base de Datos Cloud
  const connectGoogleDrive = async (): Promise<{ success: boolean; error?: string }> => {
    setIsConnectingDrive(true);
    setDriveSyncStatus('syncing');
    try {
      const res = await signInWithGoogleDrive();
      if (!res) {
        setDriveSyncStatus('idle');
        return { success: false, error: 'Inicio de sesión cancelado.' };
      }

      const userInfo: DriveUserInfo = {
        email: res.user.email || '',
        displayName: res.user.displayName || 'Profesional de la Salud',
        photoURL: res.user.photoURL || undefined,
      };

      setDriveUser(userInfo);
      setIsDriveConnected(true);
      localStorage.setItem(`${STORAGE_KEY}_drive_user`, JSON.stringify(userInfo));
      localStorage.setItem(`${STORAGE_KEY}_drive_connected`, 'true');

      // Sincronización inicial para crear la carpeta maestra MediTurnos_Data y tablas
      const syncRes = await syncEntireWorkspaceToDrive({
        professional,
        locations,
        services,
        workingHours,
        holidays,
        patients,
        appointments,
        notes,
        templates,
      });

      if (syncRes.success) {
        const ahora = new Date().toISOString();
        setDriveSyncStatus('synced');
        setLastDriveSync(ahora);
        setDriveFolderUrl(syncRes.folders.masterFolderUrl);
        setDriveFolderId(syncRes.folders.masterFolderId);
        localStorage.setItem(`${STORAGE_KEY}_last_drive_sync`, ahora);
        localStorage.setItem(`${STORAGE_KEY}_drive_folder_url`, syncRes.folders.masterFolderUrl);
        localStorage.setItem(`${STORAGE_KEY}_drive_folder_id`, syncRes.folders.masterFolderId);
      } else {
        setDriveSyncStatus('error');
      }

      return { success: true };
    } catch (err: any) {
      console.error('Error al conectar Google Drive:', err);
      setDriveSyncStatus('error');
      return { success: false, error: err.message || 'Error al conectar con Google Drive.' };
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const disconnectGoogleDrive = async () => {
    try {
      await signOutGoogleDrive();
    } catch (e) {
      console.error(e);
    }
    setDriveUser(null);
    setIsDriveConnected(false);
    setDriveSyncStatus('idle');
    localStorage.removeItem(`${STORAGE_KEY}_drive_user`);
    localStorage.removeItem(`${STORAGE_KEY}_drive_connected`);
  };

  const syncDataWithDrive = async (): Promise<{
    success: boolean;
    error?: string;
    filesCount?: number;
  }> => {
    if (!getDriveAccessToken()) {
      setIsDriveConnected(false);
      setDriveUser(null);
      localStorage.removeItem(`${STORAGE_KEY}_drive_connected`);
      localStorage.removeItem(`${STORAGE_KEY}_drive_user`);
      return { success: false, error: 'Se requiere iniciar sesión en Google Drive primero.' };
    }
    setDriveSyncStatus('syncing');
    try {
      const res = await syncEntireWorkspaceToDrive({
        professional,
        locations,
        services,
        workingHours,
        holidays,
        patients,
        appointments,
        notes,
        templates,
      });

      if (res.success) {
        const ahora = new Date().toISOString();
        setDriveSyncStatus('synced');
        setLastDriveSync(ahora);
        setDriveFolderUrl(res.folders.masterFolderUrl);
        setDriveFolderId(res.folders.masterFolderId);
        localStorage.setItem(`${STORAGE_KEY}_last_drive_sync`, ahora);
        localStorage.setItem(`${STORAGE_KEY}_drive_folder_url`, res.folders.masterFolderUrl);
        localStorage.setItem(`${STORAGE_KEY}_drive_folder_id`, res.folders.masterFolderId);
        return { success: true, filesCount: res.filesSyncedCount };
      } else {
        setDriveSyncStatus('error');
        return { success: false, error: res.error };
      }
    } catch (e: any) {
      setDriveSyncStatus('error');
      return { success: false, error: e.message };
    }
  };

  const uploadPatientFileToDrive = async (
    patientId: string,
    file: File
  ): Promise<{ success: boolean; attachment?: NoteAttachment; error?: string }> => {
    try {
      const targetPatient = patients.find(p => p.id === patientId);
      if (!targetPatient) {
        return { success: false, error: 'Paciente no encontrado.' };
      }

      if (!getDriveAccessToken()) {
        // Fallback local con object URL cuando no hay sesión Drive
        const localAtt: NoteAttachment = {
          id: 'att_' + Math.random().toString(36).slice(2, 8),
          nombre: file.name,
          tipoMime: file.type || 'application/octet-stream',
          tamanoBytes: file.size,
          url: URL.createObjectURL(file),
          subidoEn: new Date().toISOString(),
        };
        return { success: true, attachment: localAtt };
      }

      const masterFolder = await getOrCreateFolder('MediTurnos_Data');
      const pacientesFolder = await getOrCreateFolder('pacientes', masterFolder.id);
      const folderName = `paciente_${targetPatient.dni}_${targetPatient.nombre.trim().replace(/\s+/g, '_')}`;
      const patientFolder = await getOrCreateFolder(folderName, pacientesFolder.id);
      const adjuntosFolder = await getOrCreateFolder('adjuntos', patientFolder.id);

      const uploaded = await uploadBinaryFileToDrive(file, adjuntosFolder.id);
      return { success: true, attachment: uploaded };
    } catch (e: any) {
      console.error('Error al subir adjunto a Drive:', e);
      return { success: false, error: e.message || 'Error al subir archivo a Google Drive.' };
    }
  };

  // Auto-sincronización en segundo plano con debounce cuando se modifican datos si Drive está conectado
  useEffect(() => {
    if (!isDriveConnected || !getDriveAccessToken()) return;

    const timer = setTimeout(() => {
      syncDataWithDrive().catch(err => console.warn('Auto-sync omitido:', err));
    }, 4000);

    return () => clearTimeout(timer);
  }, [
    isDriveConnected,
    professional,
    services,
    locations,
    workingHours,
    holidays,
    patients,
    appointments,
    notes,
    templates,
  ]);

  return (
    <AppContext.Provider
      value={{
        professional,
        locations,
        services,
        workingHours,
        holidays,
        timeOffs,
        coverages,
        patients,
        appointments,
        holds,
        notes,
        templates,
        sessionToken,
        activeZone,
        setActiveZone,
        createHold,
        releaseHold,
        bookAppointment,
        changeAppointmentStatus,
        setAppointmentPayment,
        rescheduleAppointment,
        saveConsultationNote,
        deleteConsultationNote,
        updateProfessional,
        updateLocations: setLocations,
        tamanoTexto: professional.tamanoTexto || 'predeterminado',
        setTamanoTexto,
        updateWorkingHours,
        updateServices,
        updateTemplates,
        toggleAgendaPausa,
        findPatientByDni,
        addPatient,
        updatePatient,
        exportarCsvTurnos,
        exportarGoogleSheetsData,
        exportarGoogleDriveBackup,
        exportarHistoriaClinicaPaciente,
        findAppointmentByManageToken,
        cancelAppointmentByPatient,
        rescheduleAppointmentByPatient,
        addCoverage,
        updateCoverages,
        toggleHolidayLaborable,
        updateHolidays,
        resetToDemoData,
        dataLoaded,
        dataSyncError,
        // Funciones del Portal Público
        portalAgendaPublica,
        portalCrearHold,
        portalConfirmarTurno,
        portalVerTurno,
        portalCancelarTurno,
        portalReprogramarTurno,
        // Google Drive
        isDriveConnected,
        driveUser,
        isConnectingDrive,
        driveSyncStatus,
        lastDriveSync,
        driveFolderUrl,
        driveFolderId,
        connectGoogleDrive,
        disconnectGoogleDrive,
        syncDataWithDrive,
        uploadPatientFileToDrive,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp debe ser usado dentro de un AppProvider');
  }
  return context;
};
