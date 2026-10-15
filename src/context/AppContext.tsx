import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  Appointment,
  AppointmentHold,
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
    nuevoFin: string
  ) => { success: boolean; newAppointment?: Appointment; error?: string };
  saveConsultationNote: (note: Partial<ConsultationNote> & { patientId: string }) => ConsultationNote;
  deleteConsultationNote: (noteId: string) => void;
  updateProfessional: (data: Partial<Professional>) => void;
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
      return saved ? JSON.parse(saved) : INITIAL_PROFESSIONAL;
    } catch {
      return INITIAL_PROFESSIONAL;
    }
  });

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
      estadoPago: 'sin_pago',
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
    nuevoFin: string
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
        updateWorkingHours,
        updateServices,
        updateTemplates,
        toggleAgendaPausa,
        findPatientByDni,
        addPatient,
        updatePatient,
        exportarCsvTurnos,
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
