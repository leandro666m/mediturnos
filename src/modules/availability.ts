import {
  Appointment,
  AppointmentHold,
  DiaDisponible,
  Holiday,
  HuecoDisponibilidad,
  Modalidad,
  Professional,
  Service,
  TimeOff,
  WorkingHours,
} from '../types';
import { formatearFechaLarga } from './format';

export interface AvailabilityOptions {
  professional: Professional;
  service: Service;
  workingHours: WorkingHours[];
  holidays: Holiday[];
  timeOffs: TimeOff[];
  appointments: Appointment[];
  holds: AppointmentHold[];
  currentSessionToken?: string;
  referenceDate?: Date; // fecha base para simulación o actual
  excludeAppointmentId?: string; // para ignorar el turno en reprogramación
  ignoreAnticipation?: boolean; // para el panel médico interno
}

/**
 * Motor de disponibilidad puro y determinista de MediTurnos (I-02)
 * Cruza franjas, descansos, bloqueos/feriados, citas existentes y reservas temporales
 */
export function calculateAvailability(options: AvailabilityOptions): DiaDisponible[] {
  const {
    professional,
    service,
    workingHours,
    holidays,
    timeOffs,
    appointments,
    holds,
    currentSessionToken,
    referenceDate = new Date(),
    excludeAppointmentId,
    ignoreAnticipation = false,
  } = options;

  // 1. Si la agenda online está pausada y no es panel interno, no se ofrecen turnos (D-18 / Regla 1.4)
  if (professional.agendaPausada && !ignoreAnticipation) {
    return [];
  }

  const results: DiaDisponible[] = [];
  const now = referenceDate;
  const horizonDays = professional.parametros.horizonteDias || 30;
  const minAnticipationHours = professional.parametros.anticipacionMinHoras || 2;
  const gridIntervalMin = professional.parametros.grillaMin || 30;
  const marginMin = professional.parametros.margenMin || 0;

  const minSlotTime = ignoreAnticipation
    ? new Date(now.getTime() - 15 * 60 * 1000)
    : new Date(now.getTime() + minAnticipationHours * 60 * 60 * 1000);

  // Iterar día por día dentro del horizonte
  for (let dayOffset = 0; dayOffset < horizonDays; dayOffset++) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + dayOffset);
    targetDate.setHours(0, 0, 0, 0);

    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    // Día de la semana en formato ISO (1 = Lunes, 7 = Domingo)
    // getDay() devuelve 0 = Domingo, 1 = Lunes...
    const jsDay = targetDate.getDay();
    const isoDayOfWeek = jsDay === 0 ? 7 : jsDay;

    // 2. Verificar si es feriado no laborable
    const feriado = holidays.find(h => h.fecha === dateString);
    if (feriado && !feriado.laborable) {
      continue;
    }

    // 3. Verificar si cae en vacaciones o bloqueo puntual
    const enTimeOff = timeOffs.some(to => {
      const inicio = to.inicio.slice(0, 10);
      const fin = to.fin.slice(0, 10);
      return dateString >= inicio && dateString <= fin;
    });
    if (enTimeOff) {
      continue;
    }

    // 4. Obtener franjas horarias configuradas para este día de la semana
    const franjasDelDia = workingHours.filter(
      wh => wh.activo && wh.diaSemana === isoDayOfWeek
    );
    if (franjasDelDia.length === 0) {
      continue;
    }

    const huecosMap = new Map<string, HuecoDisponibilidad>();
    const modalidadesDelDia = new Set<Modalidad>();

    // Evaluar cada franja
    for (const franja of franjasDelDia) {
      // La modalidad corresponde a la franja configurada en 'Días y Horarios'
      const modalidadesOfrecibles: Modalidad[] = [];
      if (franja.modalidad === 'presencial' || franja.modalidad === 'ambas') {
        modalidadesOfrecibles.push('presencial');
      }
      if (franja.modalidad === 'videollamada' || franja.modalidad === 'ambas') {
        modalidadesOfrecibles.push('videollamada');
      }

      if (modalidadesOfrecibles.length === 0) {
        continue;
      }

      const [inicioHora, inicioMin] = franja.horaInicio.split(':').map(Number);
      const [finHora, finMin] = franja.horaFin.split(':').map(Number);

      const franjaInicioMs = (inicioHora * 60 + inicioMin) * 60 * 1000;
      const franjaFinMs = (finHora * 60 + finMin) * 60 * 1000;

      const duracionConMargenMs = (service.duracionMin + marginMin) * 60 * 1000;
      const duracionServicioMs = service.duracionMin * 60 * 1000;

      // Generar candidatos cada gridIntervalMin
      for (
        let cursorMs = franjaInicioMs;
        cursorMs + duracionServicioMs <= franjaFinMs;
        cursorMs += gridIntervalMin * 60 * 1000
      ) {
        const slotStart = new Date(targetDate.getTime() + cursorMs);
        const slotEnd = new Date(slotStart.getTime() + duracionServicioMs);
        const slotEndConMargen = new Date(slotStart.getTime() + duracionConMargenMs);

        // Validar anticipación mínima
        if (slotStart < minSlotTime) {
          continue;
        }

        // Verificar descansos dentro de la franja
        const solapaDescanso = franja.descansos.some(d => {
          const [dIniH, dIniM] = d.inicio.split(':').map(Number);
          const [dFinH, dFinM] = d.fin.split(':').map(Number);
          const dIniMs = (dIniH * 60 + dIniM) * 60 * 1000;
          const dFinMs = (dFinH * 60 + dFinM) * 60 * 1000;
          return cursorMs < dFinMs && cursorMs + duracionServicioMs > dIniMs;
        });

        if (solapaDescanso) {
          continue;
        }

        // Verificar solapamiento con turnos existentes que ocupan horario
        // (pendiente, atendido, ausente ocupan; cancelado y reprogramado NO ocupan)
        const solapaTurno = appointments.some(app => {
          if (app.estado === 'cancelado' || app.estado === 'reprogramado') {
            return false;
          }
          if (excludeAppointmentId && app.id === excludeAppointmentId) {
            return false;
          }
          const appIni = new Date(app.inicio).getTime();
          const appFin = new Date(app.fin).getTime();
          return slotStart.getTime() < appFin && slotEndConMargen.getTime() > appIni;
        });

        if (solapaTurno) {
          continue;
        }

        // Verificar solapamiento con reservas temporales activas (Holds de ~10 minutos)
        const nowMs = now.getTime();
        const solapaHold = holds.some(hold => {
          const venceMs = new Date(hold.venceEn).getTime();
          if (venceMs <= nowMs) {
            return false; // Hold vencido
          }
          // Si el hold pertenece a la sesión activa del paciente actual, se permite
          if (currentSessionToken && hold.sessionToken === currentSessionToken) {
            return false;
          }
          const holdIni = new Date(hold.inicio).getTime();
          const holdFin = new Date(hold.fin).getTime();
          return slotStart.getTime() < holdFin && slotEndConMargen.getTime() > holdIni;
        });

        if (solapaHold) {
          continue;
        }

        // El hueco es válido
        modalidadesOfrecibles.forEach(m => modalidadesDelDia.add(m));

        const effectiveLocationId =
          franja.locationId ||
          (modalidadesOfrecibles.includes('presencial') ? 'loc-belgrano' : undefined);

        const isoKey = slotStart.toISOString();
        const existingSlot = huecosMap.get(isoKey);
        if (existingSlot) {
          for (const m of modalidadesOfrecibles) {
            if (!existingSlot.modalidades.includes(m)) {
              existingSlot.modalidades.push(m);
            }
          }
          if (effectiveLocationId && !existingSlot.locationIds.includes(effectiveLocationId)) {
            existingSlot.locationIds.push(effectiveLocationId);
          }
        } else {
          huecosMap.set(isoKey, {
            inicio: isoKey,
            fin: slotEnd.toISOString(),
            modalidades: [...modalidadesOfrecibles],
            locationIds: effectiveLocationId ? [effectiveLocationId] : [],
          });
        }
      }
    }

    const huecosDelDia = Array.from(huecosMap.values()).sort(
      (a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime()
    );

    if (huecosDelDia.length > 0) {
      // Días cortos y legibles
      const diasSemanaCorto = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
      const mesesCorto = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

      results.push({
        fecha: dateString,
        fechaLegible: formatearFechaLarga(targetDate.toISOString()),
        diaSemanaCorto: diasSemanaCorto[jsDay],
        diaNumero: targetDate.getDate(),
        mesCorto: mesesCorto[targetDate.getMonth()],
        huecos: huecosDelDia,
        modalidades: Array.from(modalidadesDelDia),
        cantidad: huecosDelDia.length,
      });
    }
  }

  return results;
}

export interface DateSlotsResult {
  fecha: string; // YYYY-MM-DD
  fechaLegible: string;
  diaNombre: string; // "Lunes", "Martes", etc.
  isWorkingDay: boolean;
  reasonUnavailable?: string;
  franjasTexto?: string;
  slots: {
    inicio: string; // ISO
    fin: string; // ISO
    hora: string; // "09:30"
    horaFin: string; // "10:00"
    modalidades: Modalidad[];
  }[];
}

/**
 * Obtiene los horarios y disponibilidad específicos para una fecha puntual (YYYY-MM-DD)
 * evaluando feriados, licencias, franjas laborales, descansos y solapamientos.
 */
export function getSlotsForDate(options: {
  dateString: string;
  service: Service;
  professional: Professional;
  workingHours: WorkingHours[];
  holidays: Holiday[];
  timeOffs: TimeOff[];
  appointments: Appointment[];
  holds?: AppointmentHold[];
  excludeAppointmentId?: string;
  modalidad?: Modalidad;
  ignoreAnticipation?: boolean;
}): DateSlotsResult {
  const {
    dateString,
    service,
    professional,
    workingHours,
    holidays,
    timeOffs,
    appointments,
    holds = [],
    excludeAppointmentId,
    modalidad,
    ignoreAnticipation = true,
  } = options;

  if (!dateString) {
    return {
      fecha: '',
      fechaLegible: '',
      diaNombre: '',
      isWorkingDay: false,
      reasonUnavailable: 'Fecha no especificada',
      slots: [],
    };
  }

  const [y, m, d] = dateString.split('-').map(Number);
  const targetDate = new Date(y, m - 1, d, 0, 0, 0, 0);
  const jsDay = targetDate.getDay();
  const isoDayOfWeek = jsDay === 0 ? 7 : jsDay;
  const diasNombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const diasPlural = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
  const diaNombre = diasNombres[jsDay];
  const fechaLegible = formatearFechaLarga(targetDate.toISOString());

  // 1. Feriado no laborable
  const feriado = holidays.find(h => h.fecha === dateString);
  if (feriado && !feriado.laborable) {
    return {
      fecha: dateString,
      fechaLegible,
      diaNombre,
      isWorkingDay: false,
      reasonUnavailable: `Feriado no laborable: ${feriado.nombre}`,
      slots: [],
    };
  }

  // 2. Licencia o receso programado (TimeOff)
  const timeOff = timeOffs.find(to => {
    const inicio = to.inicio.slice(0, 10);
    const fin = to.fin.slice(0, 10);
    return dateString >= inicio && dateString <= fin;
  });
  if (timeOff) {
    return {
      fecha: dateString,
      fechaLegible,
      diaNombre,
      isWorkingDay: false,
      reasonUnavailable: `Período no laborable / Licencia: ${timeOff.motivo}`,
      slots: [],
    };
  }

  // 3. Franjas de atención del día
  const franjasDelDia = workingHours.filter(
    wh => wh.activo && wh.diaSemana === isoDayOfWeek
  );

  if (franjasDelDia.length === 0) {
    return {
      fecha: dateString,
      fechaLegible,
      diaNombre,
      isWorkingDay: false,
      reasonUnavailable: `El profesional no atiende los ${diasPlural[jsDay]} según 'Horarios & Especialidad'.`,
      slots: [],
    };
  }

  const franjasTexto = franjasDelDia
    .map(f => {
      const receso =
        f.descansos && f.descansos.length > 0
          ? ` (receso ${f.descansos.map(dc => `${dc.inicio} a ${dc.fin} hs`).join(', ')})`
          : '';
      return `${f.horaInicio} a ${f.horaFin} hs${receso}`;
    })
    .join(' y ');

  const gridIntervalMin = professional.parametros.grillaMin || 30;
  const marginMin = professional.parametros.margenMin || 0;
  const duracionConMargenMs = (service.duracionMin + marginMin) * 60 * 1000;
  const duracionServicioMs = service.duracionMin * 60 * 1000;

  const now = new Date();
  const minAnticipationHours = professional.parametros.anticipacionMinHoras || 2;
  const minSlotTime = ignoreAnticipation
    ? new Date(now.getTime() - 15 * 60 * 1000)
    : new Date(now.getTime() + minAnticipationHours * 60 * 60 * 1000);

  const slotsMap = new Map<string, {
    inicio: string;
    fin: string;
    hora: string;
    horaFin: string;
    modalidades: Modalidad[];
  }>();

  for (const franja of franjasDelDia) {
    // La modalidad corresponde a la franja configurada en 'Días y Horarios'
    const modalidadesOfrecibles: Modalidad[] = [];
    if (franja.modalidad === 'presencial' || franja.modalidad === 'ambas') {
      modalidadesOfrecibles.push('presencial');
    }
    if (franja.modalidad === 'videollamada' || franja.modalidad === 'ambas') {
      modalidadesOfrecibles.push('videollamada');
    }

    if (modalidadesOfrecibles.length === 0) continue;
    if (modalidad && !modalidadesOfrecibles.includes(modalidad)) continue;

    const [inicioHora, inicioMin] = franja.horaInicio.split(':').map(Number);
    const [finHora, finMin] = franja.horaFin.split(':').map(Number);

    const franjaInicioMs = (inicioHora * 60 + inicioMin) * 60 * 1000;
    const franjaFinMs = (finHora * 60 + finMin) * 60 * 1000;

    for (
      let cursorMs = franjaInicioMs;
      cursorMs + duracionServicioMs <= franjaFinMs;
      cursorMs += gridIntervalMin * 60 * 1000
    ) {
      const slotStart = new Date(targetDate.getTime() + cursorMs);
      const slotEnd = new Date(slotStart.getTime() + duracionServicioMs);
      const slotEndConMargen = new Date(slotStart.getTime() + duracionConMargenMs);

      // Si es el mismo día y ya pasó (con margen de 15 min), omitir
      if (slotStart < minSlotTime) {
        continue;
      }

      // Solapamiento con descansos
      const solapaDescanso = (franja.descansos || []).some(d => {
        const [dIniH, dIniM] = d.inicio.split(':').map(Number);
        const [dFinH, dFinM] = d.fin.split(':').map(Number);
        const dIniMs = (dIniH * 60 + dIniM) * 60 * 1000;
        const dFinMs = (dFinH * 60 + dFinM) * 60 * 1000;
        return cursorMs < dFinMs && cursorMs + duracionServicioMs > dIniMs;
      });

      if (solapaDescanso) continue;

      // Solapamiento con turnos existentes
      const solapaTurno = appointments.some(app => {
        if (app.estado === 'cancelado' || app.estado === 'reprogramado') {
          return false;
        }
        if (excludeAppointmentId && app.id === excludeAppointmentId) {
          return false;
        }
        const appIni = new Date(app.inicio).getTime();
        const appFin = new Date(app.fin).getTime();
        return slotStart.getTime() < appFin && slotEndConMargen.getTime() > appIni;
      });

      if (solapaTurno) continue;

      // Solapamiento con holds activos
      const nowMs = now.getTime();
      const solapaHold = holds.some(hold => {
        const venceMs = new Date(hold.venceEn).getTime();
        if (venceMs <= nowMs) return false;
        const holdIni = new Date(hold.inicio).getTime();
        const holdFin = new Date(hold.fin).getTime();
        return slotStart.getTime() < holdFin && slotEndConMargen.getTime() > holdIni;
      });

      if (solapaHold) continue;

      const horaStr = `${String(slotStart.getHours()).padStart(2, '0')}:${String(slotStart.getMinutes()).padStart(2, '0')}`;
      const horaFinStr = `${String(slotEnd.getHours()).padStart(2, '0')}:${String(slotEnd.getMinutes()).padStart(2, '0')}`;

      if (!slotsMap.has(horaStr)) {
        slotsMap.set(horaStr, {
          inicio: slotStart.toISOString(),
          fin: slotEnd.toISOString(),
          hora: horaStr,
          horaFin: horaFinStr,
          modalidades: [...modalidadesOfrecibles],
        });
      } else {
        const existing = slotsMap.get(horaStr)!;
        for (const m of modalidadesOfrecibles) {
          if (!existing.modalidades.includes(m)) {
            existing.modalidades.push(m);
          }
        }
      }
    }
  }

  const sortedSlots = Array.from(slotsMap.values()).sort(
    (a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime()
  );

  return {
    fecha: dateString,
    fechaLegible,
    diaNombre,
    isWorkingDay: true,
    franjasTexto,
    slots: sortedSlots,
  };
}

export interface SlotValidationResult {
  valido: boolean;
  mensaje: string;
  tipo:
    | 'ok'
    | 'feriado'
    | 'timeoff'
    | 'sin_franja'
    | 'fuera_horario'
    | 'descanso'
    | 'solapado_turno'
    | 'formato_invalido';
  turnoSolapado?: Appointment;
}

/**
 * Valida minuciosamente si una hora específica en una fecha es válida
 * con respecto a las reglas de Horarios & Especialidad.
 */
export function validateSlotTime(options: {
  dateString: string;
  hora: string; // "HH:mm"
  service: Service;
  professional: Professional;
  workingHours: WorkingHours[];
  holidays: Holiday[];
  timeOffs: TimeOff[];
  appointments: Appointment[];
  excludeAppointmentId?: string;
  modalidad?: Modalidad;
}): SlotValidationResult {
  const {
    dateString,
    hora,
    service,
    professional,
    workingHours,
    holidays,
    timeOffs,
    appointments,
    excludeAppointmentId,
    modalidad,
  } = options;

  if (!dateString) {
    return { valido: false, tipo: 'formato_invalido', mensaje: 'Ingresá una fecha válida.' };
  }

  if (!hora || !/^\d{1,2}:\d{2}$/.test(hora)) {
    return { valido: false, tipo: 'formato_invalido', mensaje: 'Formato de hora inválido (debe ser HH:mm).' };
  }

  const [y, m, d] = dateString.split('-').map(Number);
  const targetDate = new Date(y, m - 1, d, 0, 0, 0, 0);
  const jsDay = targetDate.getDay();
  const isoDayOfWeek = jsDay === 0 ? 7 : jsDay;
  const diasPlural = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];

  // 1. Feriado no laborable
  const feriado = holidays.find(h => h.fecha === dateString);
  if (feriado && !feriado.laborable) {
    return {
      valido: false,
      tipo: 'feriado',
      mensaje: `La fecha seleccionada es feriado no laborable: ${feriado.nombre}.`,
    };
  }

  // 2. Licencia o receso programado
  const timeOff = timeOffs.find(to => {
    const inicio = to.inicio.slice(0, 10);
    const fin = to.fin.slice(0, 10);
    return dateString >= inicio && dateString <= fin;
  });
  if (timeOff) {
    return {
      valido: false,
      tipo: 'timeoff',
      mensaje: `El profesional se encuentra en período de receso/licencia: ${timeOff.motivo}.`,
    };
  }

  // 3. Franjas de atención del día
  const franjasDelDia = workingHours.filter(
    wh => wh.activo && wh.diaSemana === isoDayOfWeek
  );
  if (franjasDelDia.length === 0) {
    return {
      valido: false,
      tipo: 'sin_franja',
      mensaje: `El profesional no atiende los ${diasPlural[jsDay]} según 'Horarios & Especialidad'.`,
    };
  }

  // 4. Franja horaria y duración
  const [h, min] = hora.split(':').map(Number);
  const slotStartMin = h * 60 + min;
  const duracion = service ? service.duracionMin : 30;
  const slotEndMin = slotStartMin + duracion;

  let franjaEncontrada: WorkingHours | undefined;
  for (const f of franjasDelDia) {
    if (modalidad && f.modalidad !== 'ambas' && f.modalidad !== modalidad) {
      continue;
    }
    const [fIniH, fIniM] = f.horaInicio.split(':').map(Number);
    const [fFinH, fFinM] = f.horaFin.split(':').map(Number);
    const fIniMin = fIniH * 60 + fIniM;
    const fFinMin = fFinH * 60 + fFinM;

    if (slotStartMin >= fIniMin && slotEndMin <= fFinMin) {
      franjaEncontrada = f;
      break;
    }
  }

  if (!franjaEncontrada) {
    const franjasTexto = franjasDelDia
      .map(f => `${f.horaInicio} a ${f.horaFin} hs`)
      .join(', ');
    return {
      valido: false,
      tipo: 'fuera_horario',
      mensaje: `El turno (${hora} a ${String(Math.floor(slotEndMin / 60)).padStart(2, '0')}:${String(slotEndMin % 60).padStart(2, '0')} hs, duración ${duracion} min) está fuera de la jornada de atención (${franjasTexto}).`,
    };
  }

  // 5. Descansos / recesos
  for (const descanso of franjaEncontrada.descansos || []) {
    const [dIniH, dIniM] = descanso.inicio.split(':').map(Number);
    const [dFinH, dFinM] = descanso.fin.split(':').map(Number);
    const dIniMin = dIniH * 60 + dIniM;
    const dFinMin = dFinH * 60 + dFinM;

    if (slotStartMin < dFinMin && slotEndMin > dIniMin) {
      return {
        valido: false,
        tipo: 'descanso',
        mensaje: `El horario coincide con el descanso configurado de ${descanso.inicio} a ${descanso.fin} hs.`,
      };
    }
  }

  // 6. Solapamiento con turnos existentes
  const slotStartDate = new Date(y, m - 1, d, h, min, 0, 0);
  const marginMin = professional.parametros.margenMin || 0;
  const slotEndConMargenDate = new Date(
    slotStartDate.getTime() + (duracion + marginMin) * 60 * 1000
  );

  const turnoSolapado = appointments.find(app => {
    if (app.estado === 'cancelado' || app.estado === 'reprogramado') {
      return false;
    }
    if (excludeAppointmentId && app.id === excludeAppointmentId) {
      return false;
    }
    const appIni = new Date(app.inicio).getTime();
    const appFin = new Date(app.fin).getTime();
    return slotStartDate.getTime() < appFin && slotEndConMargenDate.getTime() > appIni;
  });

  if (turnoSolapado) {
    const iniStr = turnoSolapado.inicio.slice(11, 16);
    const finStr = turnoSolapado.fin.slice(11, 16);
    return {
      valido: false,
      tipo: 'solapado_turno',
      turnoSolapado,
      mensaje: `Se solapa con el turno ya asignado a ${turnoSolapado.pacienteNombre} (${iniStr} a ${finStr} hs).`,
    };
  }

  return {
    valido: true,
    tipo: 'ok',
    mensaje: 'Horario disponible según la configuración de atención.',
  };
}
