create or replace function public.portal_buscar_turnos_dni(p_ref text, p_dni text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_prof_id uuid;
  v_dni text := regexp_replace(coalesce(p_dni, ''), '[^0-9]', '', 'g');
begin
  if length(v_dni) not between 7 and 8 then
    raise exception 'dni_invalido' using errcode = 'PT400';
  end if;
  select p.id into v_prof_id from public.profesionales p
   where lower(p.slug) = lower(trim(p_ref)) or p.public_id = trim(p_ref);
  if v_prof_id is null then
    raise exception 'profesional_no_encontrado' using errcode = 'PT404';
  end if;
  return jsonb_build_object('turnos', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'paciente_nombre', pa.nombre, 'servicio_id', t.servicio_id,
      'sede_id', t.sede_id, 'inicio', t.inicio_utc, 'fin', t.fin_utc,
      'estado', t.estado, 'estado_pago', t.estado_pago,
      'precio_centavos', t.arancel_centavos, 'modalidad', t.modalidad)
      order by t.inicio_utc)
    from public.turnos t
    join public.pacientes pa on pa.id = t.paciente_id and pa.profesional_id = t.profesional_id
    where t.profesional_id = v_prof_id and pa.dni = v_dni
  ), '[]'::jsonb));
end;
$$;

revoke all on function public.portal_buscar_turnos_dni(text, text) from public;
grant execute on function public.portal_buscar_turnos_dni(text, text) to anon, authenticated;
