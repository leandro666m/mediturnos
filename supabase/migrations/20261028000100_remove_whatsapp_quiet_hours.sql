-- Quiet hours only affected the deferred automatic WhatsApp reminder feature.
alter table public.profesionales
  drop column if exists horario_silencio_inicio,
  drop column if exists horario_silencio_fin;
