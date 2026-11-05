-- Controla la visibilidad de la duración de servicios en el portal público.

ALTER TABLE public.servicios ADD COLUMN IF NOT EXISTS mostrar_duracion boolean NOT NULL DEFAULT true;

create or replace function public.portal_agenda_publica(
  p_ref text, p_desde date, p_hasta date, p_session_id text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_prof public.profesionales%rowtype;
  v_desde timestamptz;
  v_hasta timestamptz;
begin
  select * into v_prof from public.profesionales p
   where lower(p.slug) = lower(trim(p_ref)) or p.public_id = trim(p_ref);
  if not found then
    raise exception 'profesional_no_encontrado' using errcode = 'PT404';
  end if;

  if p_desde is null or p_hasta is null or p_hasta < p_desde or p_hasta - p_desde > 62 then
    raise exception 'rango_invalido' using errcode = 'PT400';
  end if;

  v_desde := p_desde::timestamp at time zone v_prof.zona_horaria;
  v_hasta := (p_hasta + 1)::timestamp at time zone v_prof.zona_horaria;

  return jsonb_build_object(
    'profesional', jsonb_build_object(
      'id_publico', v_prof.public_id, 'slug', v_prof.slug,
      'nombre', v_prof.nombre,
      'titulo', v_prof.titulo, 'especialidad', v_prof.especialidad,
      'matricula_nacional', v_prof.matricula_nacional,
      'matricula_provincial', v_prof.matricula_provincial,
      'foto_perfil_path', v_prof.foto_perfil_path,
      'agenda_pausada', v_prof.agenda_pausada,
      'zona_horaria', v_prof.zona_horaria,
      'intervalo_turnos_min', v_prof.intervalo_turnos_min,
      'anticipacion_minima_hs', v_prof.anticipacion_minima_hs,
      'horizonte_maximo_dias', v_prof.horizonte_maximo_dias,
      'margen_entre_turnos_min', v_prof.margen_entre_turnos_min,
      'plazo_cancelacion_hs', v_prof.plazo_cancelacion_hs,
      'alias_mp', v_prof.alias_mp,
      'titular_cuenta', v_prof.titular_cuenta,
      'cbu_cvu', v_prof.cbu_cvu,
      'banco', v_prof.banco,
      'cuit', v_prof.cuit),
    'servicios', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'nombre', s.nombre, 'descripcion', s.descripcion,
        'duracion_min', s.duracion_min, 'mostrar_duracion', s.mostrar_duracion, 'modalidad', s.modalidad,
        'arancel_centavos', case when s.mostrar_precio then s.arancel_centavos end,
        'moneda', s.moneda) order by s.orden, s.nombre)
      from public.servicios s where s.profesional_id = v_prof.id and s.activo), '[]'::jsonb),
    'sedes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'nombre', x.nombre, 'direccion', x.direccion,
        'indicaciones', x.indicaciones, 'maps_url', x.maps_url) order by x.nombre)
      from public.sedes x where x.profesional_id = v_prof.id and x.activa), '[]'::jsonb),
    'coberturas', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'tipo', c.tipo) order by c.nombre)
      from public.coberturas c where c.profesional_id = v_prof.id), '[]'::jsonb),
    'franjas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'dia_semana', f.dia_semana,
        'hora_inicio', f.hora_inicio, 'hora_fin', f.hora_fin,
        'modalidad_permitida', f.modalidad_permitida, 'sede_id', f.sede_id,
        'descansos', coalesce((
          select jsonb_agg(jsonb_build_object('hora_inicio', d.hora_inicio, 'hora_fin', d.hora_fin))
          from public.descansos_horarios d where d.franja_id = f.id), '[]'::jsonb))
        order by f.dia_semana, f.hora_inicio)
      from public.franjas_horarias f where f.profesional_id = v_prof.id and f.activo), '[]'::jsonb),
    'ocupados', coalesce((
      select jsonb_agg(jsonb_build_object('inicio', r.i, 'fin', r.f))
      from (
        select t.inicio_utc as i, t.fin_utc as f from public.turnos t
          where t.profesional_id = v_prof.id and t.estado in ('pendiente','atendido','ausente')
            and t.inicio_utc < v_hasta and t.fin_utc > v_desde
        union all
        select b.slot_inicio, b.slot_fin from public.bloqueos_temporales b
          where b.profesional_id = v_prof.id and b.expires_at > now()
            and b.session_id is distinct from p_session_id
            and b.slot_inicio < v_hasta and b.slot_fin > v_desde
        union all
        select a.inicio_utc, a.fin_utc from public.ausencias a
          where a.profesional_id = v_prof.id and a.inicio_utc < v_hasta and a.fin_utc > v_desde
      ) r), '[]'::jsonb),
    'feriados', coalesce((
      select jsonb_agg(jsonb_build_object('fecha', h.fecha, 'nombre', h.nombre, 'laborable', h.laborable))
      from public.feriados_profesional h
      where h.profesional_id = v_prof.id and h.fecha between p_desde and p_hasta), '[]'::jsonb)
  );
end;
$$;

-- 2. portal_crear_hold: reserva provisoria de 10 minutos


