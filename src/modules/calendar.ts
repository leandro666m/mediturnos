import { Appointment, Professional, Service } from '../types';

/**
 * Genera el archivo .ics para agregar a Google Calendar / Apple Calendar / Outlook
 * Cumple D-17: NUNCA incluye el teléfono privado del profesional.
 */
export function generarArchivoIcs(
  turno: Appointment,
  profesional: Professional,
  servicio?: Service,
  direccionTexto?: string
): void {
  const formatearFechaUtc = (date: Date): string => {
    return date
      .toISOString()
      .replace(/[-:]/g, '')
      .split('.')[0] + 'Z';
  };

  const inicioUtc = formatearFechaUtc(new Date(turno.inicio));
  const finUtc = formatearFechaUtc(new Date(turno.fin));
  const timestamp = formatearFechaUtc(new Date());

  const titulo = `Turno: ${servicio?.nombre || 'Consulta'} con ${profesional.titulo} ${profesional.nombre}`;
  const ubicacion =
    turno.modalidad === 'presencial'
      ? (direccionTexto || 'Consultorio Profesional')
      : 'Videollamada por WhatsApp (el profesional te llamará a la hora del turno)';

  const descripcion = [
    `Turno con ${profesional.titulo} ${profesional.nombre} (${profesional.especialidad})`,
    `Matrículas: M.N. ${profesional.matriculaNacional} / M.P. ${profesional.matriculaProvincial}`,
    `Modalidad: ${turno.modalidad === 'presencial' ? 'Presencial' : 'Videollamada por WhatsApp'}`,
    `Paciente: ${turno.pacienteNombre} (DNI ${turno.pacienteDni})`,
    `Gestión de turno en MediTurnos`,
  ].join('\\n');

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MediTurnos//Turnero Digital//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:mediturnos-${turno.id}@app.mediturnos`,
    `DTSTAMP:${timestamp}`,
    `DTSTART:${inicioUtc}`,
    `DTEND:${finUtc}`,
    `SUMMARY:${titulo}`,
    `DESCRIPTION:${descripcion}`,
    `LOCATION:${ubicacion}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const icsContent = icsLines.join('\r\n');
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Turno-${profesional.slug}-${turno.id.slice(0, 8)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
