import { useEffect, useState, type ReactNode } from 'react';
import type { Appointment, Coverage, Holiday, Location, Professional, Service, WorkingHours } from '../../types';
import type { SupabaseWorkspace } from '../../data/supabaseWorkspace';
import { supabase } from '../../data/supabaseClient';
import type { PortalAgendaPublicaResult, PortalVerTurnoResult } from '../../data/repository';

export function isPublicPortalHash(hash: string) {
  return hash.startsWith('#/r/') || hash.startsWith('#/turno/') ||
    (hash.startsWith('#/') && !hash.startsWith('#/app') && !hash.startsWith('#/login'));
}

export function SupabasePublicPortalGate({ children }: {
  children: (professional: Professional, workspace: SupabaseWorkspace) => ReactNode;
}) {
  const [result, setResult] = useState<{ professional: Professional; workspace: SupabaseWorkspace } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!supabase) throw new Error('Supabase no está configurado.');
      const parts = window.location.hash.slice(2).split('/').filter(Boolean);
      let ref = parts[0] === 'r' ? parts[1] : parts[0];
      if (parts[0] === 'turno') {
        const { data, error: lookupError } = await supabase.rpc('portal_ver_turno', { p_token: parts[1] });
        if (lookupError) throw lookupError;
        ref = (data as PortalVerTurnoResult).slug;
      }
      if (!ref) throw new Error('No se encontró el enlace del profesional.');

      const formatLocalDate = (date: Date) => new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(date);
      const start = formatLocalDate(new Date());
      const end = formatLocalDate(new Date(Date.now() + 61 * 24 * 60 * 60 * 1000));
      const { data, error: agendaError } = await supabase.rpc('portal_agenda_publica', {
        p_ref: ref, p_desde: start, p_hasta: end,
      });
      if (agendaError) throw agendaError;
      const agenda = data as PortalAgendaPublicaResult;
      const p = agenda.profesional;
      const professional: Professional = {
        id: p.id_publico,
        publicId: p.id_publico,
        slug: p.slug,
        nombre: p.nombre,
        titulo: p.titulo,
        especialidad: p.especialidad,
        matriculaNacional: p.matricula_nacional || undefined,
        matriculaProvincial: p.matricula_provincial || undefined,
        fotoPerfil: p.foto_perfil_path || undefined,
        zonaHoraria: p.zona_horaria,
        agendaPausada: p.agenda_pausada,
        tamanoTexto: 'predeterminado',
        parametros: {
          grillaMin: p.intervalo_turnos_min,
          anticipacionMinHoras: p.anticipacion_minima_hs,
          horizonteDias: Math.min(p.horizonte_maximo_dias, 62),
          margenMin: p.margen_entre_turnos_min,
          plazoCancelacionHoras: p.plazo_cancelacion_hs,
        },
      };
      const locations: Location[] = agenda.sedes.map(row => ({
        id: row.id, nombre: row.nombre, direccion: row.direccion,
        indicaciones: row.indicaciones || undefined, mapsUrl: row.maps_url || undefined, activa: true,
      }));
      const services: Service[] = agenda.servicios.map(row => {
        const modalidades = row.modalidad === 'ambas'
          ? ['presencial', 'videollamada'] as const
          : [row.modalidad as 'presencial' | 'videollamada'];
        return {
          id: row.id, nombre: row.nombre, descripcion: row.descripcion || '',
          duracionMin: row.duracion_min, precioCentavos: row.arancel_centavos || 0,
          mostrarPrecio: row.arancel_centavos !== null, modalidades: [...modalidades],
          activo: true, moneda: row.moneda,
        };
      });
      const coverages: Coverage[] = agenda.coberturas.map(row => ({
        id: row.id, nombre: row.nombre, tipo: row.tipo as Coverage['tipo'],
      }));
      const workingHours: WorkingHours[] = agenda.franjas.map(row => ({
        id: row.id, diaSemana: row.dia_semana, horaInicio: row.hora_inicio.slice(0, 5),
        horaFin: row.hora_fin.slice(0, 5), modalidad: row.modalidad_permitida,
        locationId: row.sede_id || undefined, activo: true,
        descansos: row.descansos.map(breakRow => ({ inicio: breakRow.hora_inicio.slice(0, 5), fin: breakRow.hora_fin.slice(0, 5) })),
      }));
      const holidays: Holiday[] = agenda.feriados.map(row => ({
        fecha: row.fecha, nombre: row.nombre, laborable: row.laborable, id: `${row.fecha}:${row.nombre}`,
      }));
      const appointments: Appointment[] = agenda.ocupados.map((row, index) => ({
        id: `busy-${index}`, professionalId: professional.id, patientId: '', serviceId: '',
        modalidad: 'presencial', inicio: row.inicio, fin: row.fin, estado: 'pendiente',
        estadoPago: 'sin_pago', precioCentavos: 0, origen: 'dashboard', esSobreturno: false,
        creadoEn: '', pacienteNombre: '', pacienteDni: '', pacienteTelefono: '', pacienteCobertura: 'Particular',
      }));
      if (active) setResult({
        professional,
        workspace: { locations, services, coverages, workingHours, holidays, appointments,
          patients: [], notes: [], timeOffs: [], templates: [] },
      });
    };
    load().catch(cause => { if (active) setError(cause instanceof Error ? cause.message : String(cause)); });
    return () => { active = false; };
  }, []);

  if (error) return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4"><div className="max-w-md rounded-xl bg-white p-6 text-red-700 shadow">No se pudo abrir el portal: {error}</div></main>;
  if (!result) return <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">Cargando agenda pública…</main>;
  return <>{children(result.professional, result.workspace)}</>;
}
