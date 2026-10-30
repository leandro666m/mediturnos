import type {
  Appointment, ConsultationNote, Coverage, Holiday, Location, MessageTemplate,
  Patient, Professional, Service, TimeOff, WorkingHours,
} from '../types';
import {
  appointmentFromDb, appointmentToDb, consultationNoteFromDb, coverageFromDb,
  holidayFromDb, locationFromDb, messageTemplateFromDb, noteAttachmentFromDb,
  patientFromDb, serviceFromDb, timeOffFromDb, workingHoursFromDb,
  type DbAdjuntoPaciente, type DbAusencia, type DbCobertura, type DbFeriadoProfesional,
  type DbFranjaHoraria, type DbNotaEvolucion, type DbPaciente, type DbPlantillaMensaje,
  type DbServicio, type DbSede, type DbTurno, type DbDescansoHorario,
  locationToDb, serviceToDb, coverageToDb, workingHoursToDb, timeOffToDb,
  holidayToDb, messageTemplateToDb, patientToDb, consultationNoteToDb,
} from './mappers';
import { supabase } from './supabaseClient';

export interface SupabaseWorkspace {
  locations: Location[];
  services: Service[];
  workingHours: WorkingHours[];
  holidays: Holiday[];
  timeOffs: TimeOff[];
  coverages: Coverage[];
  patients: Patient[];
  appointments: Appointment[];
  notes: ConsultationNote[];
  templates: MessageTemplate[];
}

function assertQuery<T>(label: string, result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return (result.data || []) as T;
}

export async function loadSupabaseWorkspace(): Promise<SupabaseWorkspace> {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const [sedesQ, serviciosQ, coberturasQ, franjasQ, descansosQ, ausenciasQ, feriadosQ,
    plantillasQ, pacientesQ, turnosQ, fichasQ, notasQ, adjuntosQ] = await Promise.all([
    supabase.from('sedes').select('*'),
    supabase.from('servicios').select('*'),
    supabase.from('coberturas').select('*'),
    supabase.from('franjas_horarias').select('*'),
    supabase.from('descansos_horarios').select('*'),
    supabase.from('ausencias').select('*'),
    supabase.from('feriados_profesional').select('*'),
    supabase.from('plantillas_mensajes').select('*'),
    supabase.from('pacientes').select('*'),
    supabase.from('turnos').select('*'),
    supabase.from('fichas_clinicas').select('id,paciente_id'),
    supabase.from('notas_evolucion').select('*'),
    supabase.from('adjuntos_paciente').select('*'),
  ]);
  const sedes = assertQuery<DbSede[]>('Sedes', sedesQ);
  const servicios = assertQuery<DbServicio[]>('Servicios', serviciosQ);
  const coberturas = assertQuery<DbCobertura[]>('Coberturas', coberturasQ);
  const franjas = assertQuery<DbFranjaHoraria[]>('Franjas horarias', franjasQ);
  const descansos = assertQuery<DbDescansoHorario[]>('Descansos', descansosQ);
  const ausencias = assertQuery<DbAusencia[]>('Ausencias', ausenciasQ);
  const feriados = assertQuery<DbFeriadoProfesional[]>('Feriados', feriadosQ);
  const plantillas = assertQuery<DbPlantillaMensaje[]>('Plantillas', plantillasQ);
  const pacientes = assertQuery<DbPaciente[]>('Pacientes', pacientesQ);
  const turnos = assertQuery<DbTurno[]>('Turnos', turnosQ);
  const fichas = assertQuery<Array<{ id: string; paciente_id: string }>>('Fichas clínicas', fichasQ);
  const notas = assertQuery<DbNotaEvolucion[]>('Notas clínicas', notasQ);
  const adjuntos = assertQuery<DbAdjuntoPaciente[]>('Adjuntos', adjuntosQ);

  const patientModels = pacientes.map(patientFromDb);
  const patientsById = new Map(patientModels.map(patient => [patient.id, patient]));
  const coveragesById = new Map(coberturas.map(row => [row.id, coverageFromDb(row)]));
  const nextByOldId = new Map(turnos.filter(row => row.turno_origen_id).map(row => [row.turno_origen_id!, row.id]));
  const fichaByPatientId = new Map(fichas.map(row => [row.paciente_id, row.id]));
  const attachmentsByNoteId = new Map<string, ReturnType<typeof noteAttachmentFromDb>[]>();
  for (const row of adjuntos) {
    if (!row.nota_id) continue;
    const group = attachmentsByNoteId.get(row.nota_id) || [];
    group.push(noteAttachmentFromDb(row));
    attachmentsByNoteId.set(row.nota_id, group);
  }

  return {
    locations: sedes.map(locationFromDb),
    services: servicios.map(serviceFromDb),
    workingHours: franjas.map(row => workingHoursFromDb(row, descansos)),
    holidays: feriados.map(holidayFromDb),
    timeOffs: ausencias.map(timeOffFromDb),
    coverages: coberturas.map(coverageFromDb),
    patients: patientModels,
    appointments: turnos.map(row => appointmentFromDb(
      row,
      patientsById.get(row.paciente_id),
      patientsById.get(row.paciente_id)?.coverageId
        ? coveragesById.get(patientsById.get(row.paciente_id)!.coverageId!) || null
        : null,
      nextByOldId.get(row.id),
    )),
    notes: notas.flatMap(row => {
      const patientId = fichas.find(ficha => ficha.id === row.ficha_id)?.paciente_id;
      return patientId
        ? [consultationNoteFromDb(row, patientId, attachmentsByNoteId.get(row.id) || [])]
        : [];
    }),
    templates: plantillas.map(messageTemplateFromDb),
  };
}

type WorkspaceSnapshot = SupabaseWorkspace & { professional: Professional };

async function upsert(table: string, rows: unknown[]) {
  if (!supabase || rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function disableRemoved(table: string, field: 'activa' | 'activo', rows: Array<{ id: string }>, professionalId: string) {
  if (!supabase) return;
  let query = supabase.from(table).update({ [field]: false }).eq('profesional_id', professionalId);
  if (rows.length) query = query.not('id', 'in', `(${rows.map(row => row.id).join(',')})`);
  const { error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function deleteRemoved(table: string, rows: Array<{ id: string }>, professionalId: string) {
  if (!supabase) return;
  const { data, error: selectError } = await supabase.from(table).select('id').eq('profesional_id', professionalId);
  if (selectError) throw new Error(`${table}: ${selectError.message}`);
  const keep = new Set(rows.map(row => row.id));
  const removeIds = ((data || []) as Array<{ id: string }>).map(row => row.id).filter(id => !keep.has(id));
  if (!removeIds.length) return;
  const { error } = await supabase.from(table).delete().in('id', removeIds);
  if (error) throw new Error(`${table}: ${error.message}`);
}

export async function saveSupabaseWorkspace(snapshot: WorkspaceSnapshot) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const professionalId = snapshot.professional.id;
  // Las tablas de referencia se guardan primero para respetar las claves foráneas.
  await disableRemoved('sedes', 'activa', snapshot.locations, professionalId);
  await disableRemoved('servicios', 'activo', snapshot.services, professionalId);
  await disableRemoved('franjas_horarias', 'activo', snapshot.workingHours, professionalId);
  await upsert('sedes', snapshot.locations.map(row => locationToDb(row, professionalId)));
  await upsert('servicios', snapshot.services.map(row => serviceToDb(row, professionalId)));
  await upsert('coberturas', snapshot.coverages.map(row => coverageToDb(row, professionalId)));
  await upsert('franjas_horarias', snapshot.workingHours.map(row => workingHoursToDb(row, professionalId).franja));
  for (const row of snapshot.workingHours) {
    const { descansos } = workingHoursToDb(row, professionalId);
    const { error: deleteError } = await supabase.from('descansos_horarios').delete()
      .eq('franja_id', row.id).eq('profesional_id', professionalId);
    if (deleteError) throw new Error(`Descansos: ${deleteError.message}`);
    if (descansos.length) {
      const { error } = await supabase.from('descansos_horarios').insert(descansos);
      if (error) throw new Error(`Descansos: ${error.message}`);
    }
  }
  await upsert('ausencias', snapshot.timeOffs.map(row => timeOffToDb(row, professionalId, snapshot.professional.zonaHoraria)));
  await upsert('feriados_profesional', snapshot.holidays.map(row => holidayToDb(row, professionalId)));
  await upsert('plantillas_mensajes', snapshot.templates.map(row => messageTemplateToDb(row, professionalId)));
  await upsert('pacientes', snapshot.patients.map(patientToDb));
  const { data: existingRows, error: existingError } = await supabase.from('turnos')
    .select('id').eq('profesional_id', professionalId);
  if (existingError) throw new Error(`Turnos: ${existingError.message}`);
  const existingTurnIds = new Set(((existingRows || []) as Array<{ id: string }>).map(row => row.id));
  // Un turno de portal nuevo solo debe entrar por portal_confirmar_turno, que
  // reserva el slot de forma atómica y guarda el hash del token de gestión.
  const dashboardAndPersistedTurns = snapshot.appointments.filter(
    row => row.origen === 'dashboard' || existingTurnIds.has(row.id),
  );
  await upsert('turnos', dashboardAndPersistedTurns.map(appointmentToDb));
  // Estas configuraciones no tienen referencias clínicas ni históricas.
  await deleteRemoved('ausencias', snapshot.timeOffs, professionalId);
  await deleteRemoved('feriados_profesional', snapshot.holidays, professionalId);
  await deleteRemoved('plantillas_mensajes', snapshot.templates, professionalId);
}

export async function saveSupabaseNotes(notes: ConsultationNote[], professionalId: string) {
  if (!supabase || notes.length === 0) return;
  const patientIds = [...new Set(notes.map(note => note.patientId))];
  const { data: fichas, error: fichaError } = await supabase.from('fichas_clinicas')
    .select('id,paciente_id').in('paciente_id', patientIds);
  if (fichaError) throw new Error(`Fichas clínicas: ${fichaError.message}`);
  const fichaByPatientId = new Map(((fichas || []) as Array<{ id: string; paciente_id: string }>).map(row => [row.paciente_id, row.id]));
  const rows = notes.map(note => {
    const fichaId = fichaByPatientId.get(note.patientId);
    if (!fichaId) throw new Error('No existe ficha clínica para uno de los pacientes.');
    return consultationNoteToDb(note, fichaId);
  });
  const { error } = await supabase.from('notas_evolucion').upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`Notas clínicas: ${error.message}`);
}
