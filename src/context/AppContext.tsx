import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  Appointment,
  AppointmentHold,
  ComprobantePago,
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
  TimeOff,
  WorkingHours,
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
import { formatearFechaCorta, formatearHora, formatearMoneda } from '../modules/format';

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
    pacienteCoberturaId: string;
    pacientePlan?: string;
    pacienteAfiliado?: string;
    motivo?: string;
    origen: 'portal' | 'dashboard';
    esSobreturno?: boolean;
    estadoPago?: EstadoPago;
    comprobantePago?: ComprobantePago;
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
    coverageId: string;
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
      coverageId: string;
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
  uploadPaymentProof: (
    tokenOrId: string,
    proof: { url: string; nombreArchivo?: string; montoCentavos: number }
  ) => { success: boolean; error?: string };
  reviewPaymentProof: (
    appointmentId: string,
    decision: 'aprobado' | 'rechazado',
    notas?: string
  ) => { success: boolean; error?: string };
  addCoverage: (nombre: string) => Coverage;
  updateCoverages: (coverages: Coverage[]) => void;
  toggleHolidayLaborable: (holidayId: string) => void;
  updateHolidays: (holidays: Holiday[]) => void;
  resetToDemoData: () => void;
}

const STORAGE_KEY = 'mediturnos_state_v6';

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessionToken] = useState(() => 'sess_' + Math.random().toString(36).slice(2, 10));
  const [activeZone, setActiveZone] = useState<'dashboard' | 'portal'>('dashboard');

  // Inicialización de estado con soporte para LocalStorage
  const [professional, setProfessional] = useState<Professional>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_prof`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.tamanoTexto) parsed.tamanoTexto = 'predeterminado';
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
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_locs`);
      return saved ? JSON.parse(saved) : INITIAL_LOCATIONS;
    } catch {
      return INITIAL_LOCATIONS;
    }
  });

  const [services, setServices] = useState<Service[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_services`);
      return saved ? JSON.parse(saved) : INITIAL_SERVICES;
    } catch {
      return INITIAL_SERVICES;
    }
  });

  const [workingHours, setWorkingHours] = useState<WorkingHours[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_hours`);
      return saved ? JSON.parse(saved) : INITIAL_WORKING_HOURS;
    } catch {
      return INITIAL_WORKING_HOURS;
    }
  });

  const [holidays, setHolidays] = useState<Holiday[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_holidays`);
      return saved ? JSON.parse(saved) : INITIAL_HOLIDAYS;
    } catch {
      return INITIAL_HOLIDAYS;
    }
  });

  const [timeOffs, setTimeOffs] = useState<TimeOff[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_timeoffs`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [coverages, setCoverages] = useState<Coverage[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_coverages`);
      return saved ? JSON.parse(saved) : INITIAL_COVERAGES;
    } catch {
      return INITIAL_COVERAGES;
    }
  });

  const [patients, setPatients] = useState<Patient[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_patients`);
      return saved ? JSON.parse(saved) : INITIAL_PATIENTS;
    } catch {
      return INITIAL_PATIENTS;
    }
  });

  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_appointments`);
      return saved ? JSON.parse(saved) : generarTurnosIniciales();
    } catch {
      return generarTurnosIniciales();
    }
  });

  const [holds, setHolds] = useState<AppointmentHold[]>([]);

  const [notes, setNotes] = useState<ConsultationNote[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_notes`);
      return saved ? JSON.parse(saved) : INITIAL_CONSULTATION_NOTES;
    } catch {
      return INITIAL_CONSULTATION_NOTES;
    }
  });

  const [templates, setTemplates] = useState<MessageTemplate[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_templates`);
      return saved ? JSON.parse(saved) : INITIAL_TEMPLATES;
    } catch {
      return INITIAL_TEMPLATES;
    }
  });

  // Guardar cambios en LocalStorage para persistencia
  useEffect(() => {
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
    coverageId: string;
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
      id: 'pat_' + Math.random().toString(36).slice(2, 10),
      professionalId: professional.id,
      dni: cleanDni,
      nombre: data.nombre.trim(),
      telefonoE164: data.telefonoE164,
      email: data.email?.trim(),
      coverageId: data.coverageId,
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
      coverageId: string;
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
      coverageId: data.coverageId !== undefined ? data.coverageId : pacienteActual.coverageId,
      plan: data.plan !== undefined ? data.plan.trim() : pacienteActual.plan,
      nroAfiliado: data.nroAfiliado !== undefined ? data.nroAfiliado.trim() : pacienteActual.nroAfiliado,
      notasInternas: data.notasInternas !== undefined ? data.notasInternas.trim() : pacienteActual.notasInternas,
    };

    setPatients(prev => prev.map(p => (p.id === id ? actualizado : p)));

    // Sincronizar datos visibles en citas de este paciente
    const cov = coverages.find(c => c.id === actualizado.coverageId);
    setAppointments(prev =>
      prev.map(app => {
        if (app.patientId === id) {
          return {
            ...app,
            pacienteNombre: actualizado.nombre,
            pacienteDni: actualizado.dni,
            pacienteTelefono: actualizado.telefonoE164,
            pacienteEmail: actualizado.email,
            pacienteCobertura: cov ? cov.nombre : app.pacienteCobertura,
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
    pacienteCoberturaId: string;
    pacientePlan?: string;
    pacienteAfiliado?: string;
    motivo?: string;
    origen: 'portal' | 'dashboard';
    esSobreturno?: boolean;
    estadoPago?: EstadoPago;
    comprobantePago?: ComprobantePago;
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
        id: 'pat_' + Math.random().toString(36).slice(2, 10),
        professionalId: professional.id,
        dni: cleanDni,
        nombre: params.pacienteNombre.trim(),
        telefonoE164: params.pacienteTelefono,
        email: params.pacienteEmail?.trim(),
        coverageId: params.pacienteCoberturaId,
        plan: params.pacientePlan?.trim(),
        nroAfiliado: params.pacienteAfiliado?.trim(),
        creadoEn: new Date().toISOString(),
      };
      setPatients(prev => [...prev, nuevoPaciente]);
      patientId = nuevoPaciente.id;
    }

    // Obtener nombre de la cobertura
    const cov = coverages.find(c => c.id === params.pacienteCoberturaId);
    const coberturaNombre = cov ? cov.nombre : 'Particular';

    // Generar token de gestión único para el paciente
    const manageToken = 'mng_' + Math.random().toString(36).slice(2, 12);

    const nuevoTurno: Appointment = {
      id: 'app_' + Math.random().toString(36).slice(2, 10),
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
      comprobantePago: params.comprobantePago,
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

    const nuevoId = 'app_' + Math.random().toString(36).slice(2, 10);

    const nuevoTurno: Appointment = {
      ...turnoOriginal,
      id: nuevoId,
      inicio: nuevoInicio,
      fin: nuevoFin,
      estado: 'pendiente',
      esSobreturno: esSobreturno !== undefined ? esSobreturno : turnoOriginal.esSobreturno,
      reprogramadoDe: turnoOriginal.id,
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
          id: targetId || ('note_' + Math.random().toString(36).slice(2, 10)),
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

  const deleteConsultationNote = (noteId: string) => {
    setNotes(prev => prev.filter(n => n.id !== noteId));
  };

  const updateProfessional = (data: Partial<Professional>) => {
    setProfessional(prev => ({ ...prev, ...data }));
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
    setProfessional(prev => ({ ...prev, agendaPausada: !prev.agendaPausada }));
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
      'Comprobante Digital',
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
      const estadoComp = app.comprobantePago ? app.comprobantePago.estado : 'Sin comprobante';

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
        estadoComp,
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

    const horasMin = professional.parametros.plazoCancelacionHoras || 4;
    const inicioMs = new Date(turno.inicio).getTime();
    const ahoraMs = Date.now();
    const difHoras = (inicioMs - ahoraMs) / (1000 * 60 * 60);

    if (difHoras < horasMin) {
      return {
        success: false,
        error: `El plazo de cancelación online es de hasta ${horasMin} horas de anticipación. Por favor comunícate directamente con el consultorio por WhatsApp.`,
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

    const nuevoId = 'app_' + Math.random().toString(36).slice(2, 10);
    const nuevoTurno: Appointment = {
      ...turnoOriginal,
      id: nuevoId,
      inicio: nuevoInicio,
      fin: nuevoFin,
      estado: 'pendiente',
      reprogramadoDe: turnoOriginal.id,
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

  const uploadPaymentProof = (
    tokenOrId: string,
    proof: { url: string; nombreArchivo?: string; montoCentavos: number }
  ): { success: boolean; error?: string } => {
    const target = appointments.find(a => a.manageToken === tokenOrId || a.id === tokenOrId);
    if (!target) {
      return { success: false, error: 'Turno no encontrado.' };
    }

    const comprobante: ComprobantePago = {
      url: proof.url,
      nombreArchivo: proof.nombreArchivo || 'comprobante-transferencia.jpg',
      subidoEn: new Date().toISOString(),
      montoCentavos: proof.montoCentavos || target.precioCentavos,
      estado: 'pendiente_revision',
    };

    setAppointments(prev =>
      prev.map(app => {
        if (app.id === target.id) {
          return {
            ...app,
            comprobantePago: comprobante,
          };
        }
        return app;
      })
    );

    return { success: true };
  };

  const reviewPaymentProof = (
    appointmentId: string,
    decision: 'aprobado' | 'rechazado',
    notas?: string
  ): { success: boolean; error?: string } => {
    const target = appointments.find(a => a.id === appointmentId);
    if (!target || !target.comprobantePago) {
      return { success: false, error: 'Turno o comprobante no encontrado.' };
    }

    setAppointments(prev =>
      prev.map(app => {
        if (app.id === appointmentId && app.comprobantePago) {
          return {
            ...app,
            estadoPago: decision === 'aprobado' ? 'pagado' : 'sin_pago',
            comprobantePago: {
              ...app.comprobantePago,
              estado: decision,
              notasRevision:
                notas ||
                (decision === 'aprobado'
                  ? 'Comprobante verificado y aprobado por el profesional.'
                  : 'Comprobante no válido o ilegible.'),
            },
          };
        }
        return app;
      })
    );

    return { success: true };
  };

  const addCoverage = (nombre: string): Coverage => {
    const trimmed = nombre.trim();
    const id = 'cov_' + Math.random().toString(36).slice(2, 9);
    const nueva: Coverage = {
      id,
      nombre: trimmed,
      tipo: 'obra_social',
    };
    setCoverages(prev => {
      const actualizadas = [...prev, nueva];
      try {
        localStorage.setItem(`${STORAGE_KEY}_coverages`, JSON.stringify(actualizadas));
      } catch (e) {
        console.error(e);
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
      try {
        localStorage.setItem(`${STORAGE_KEY}_holidays`, JSON.stringify(actualizados));
      } catch (e) {
        console.error(e);
      }
      return actualizados;
    });
  };

  const updateHolidays = (nuevos: Holiday[]) => {
    setHolidays(nuevos);
  };

  const resetToDemoData = () => {
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
        uploadPaymentProof,
        reviewPaymentProof,
        addCoverage,
        updateCoverages,
        toggleHolidayLaborable,
        updateHolidays,
        resetToDemoData,
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
