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

interface AvailabilityOptions {
  professional: Professional;
  service: Service;
  workingHours: WorkingHours[];
  holidays: Holiday[];
  timeOffs: TimeOff[];
  appointments: Appointment[];
  holds: AppointmentHold[];
  currentSessionToken?: string;
  referenceDate?: Date; // fecha base para simulación o actual
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
  } = options;

  // 1. Si la agenda online está pausada, no se ofrecen turnos (D-18 / Regla 1.4)
  if (professional.agendaPausada) {
    return [];
  }

  const results: DiaDisponible[] = [];
  const now = referenceDate;
  const horizonDays = professional.parametros.horizonteDias || 30;
  const minAnticipationHours = professional.parametros.anticipacionMinHoras || 2;
  const gridIntervalMin = professional.parametros.grillaMin || 30;
  const marginMin = professional.parametros.margenMin || 0;

  const minSlotTime = new Date(now.getTime() + minAnticipationHours * 60 * 60 * 1000);

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

    const huecosDelDia: HuecoDisponibilidad[] = [];
    const modalidadesDelDia = new Set<Modalidad>();

    // Evaluar cada franja
    for (const franja of franjasDelDia) {
      // 5. Regla de intersección de modalidad (2.3 de la especificación)
      // Se evalúa si la modalidad de la franja y del servicio son compatibles
      const modalidadesOfrecibles: Modalidad[] = [];
      if (service.modalidades.includes('presencial')) {
        if (franja.modalidad === 'presencial' || franja.modalidad === 'ambas') {
          modalidadesOfrecibles.push('presencial');
        }
      }
      if (service.modalidades.includes('videollamada')) {
        if (franja.modalidad === 'videollamada' || franja.modalidad === 'ambas') {
          modalidadesOfrecibles.push('videollamada');
        }
      }

      if (modalidadesOfrecibles.length === 0) {
        // Incompatible entre servicio y franja
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
        huecosDelDia.push({
          inicio: slotStart.toISOString(),
          fin: slotEnd.toISOString(),
          modalidades: modalidadesOfrecibles,
          locationIds: franja.locationId ? [franja.locationId] : [],
        });
      }
    }

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
