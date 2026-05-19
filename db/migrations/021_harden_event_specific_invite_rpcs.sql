-- 021_harden_event_specific_invite_rpcs.sql
-- Hardening quirurgico de RPCs para Event-specific invites.
-- Objetivo: dejar permisos de ejecucion explicitos sin tocar events_select_clean,
-- policies principales de events, grupos, group_members ni la arquitectura existente.

-- 1) Quitar permisos heredados/por defecto.
-- PUBLIC incluye anon, authenticated y otros roles; revocamos primero para evitar exposicion accidental.
revoke execute on function public.create_event_invite(uuid, text) from public;
revoke execute on function public.accept_event_invite(text) from public;
revoke execute on function public.get_my_event_participant_events() from public;
revoke execute on function public.get_event_invite_preview(text) from public;

-- Refuerzo explicito por si en algun entorno ya existian grants directos.
revoke execute on function public.create_event_invite(uuid, text) from anon;
revoke execute on function public.accept_event_invite(text) from anon;
revoke execute on function public.get_my_event_participant_events() from anon;

-- 2) Reabrir solo lo necesario.
-- Crear invitacion: solo usuario autenticado y dueno/creador del evento, validado dentro de la RPC.
grant execute on function public.create_event_invite(uuid, text) to authenticated;

-- Aceptar invitacion: solo usuario autenticado; la RPC valida auth.uid() y email del JWT.
grant execute on function public.accept_event_invite(text) to authenticated;

-- Eventos aceptados por invitacion puntual: solo usuario autenticado; devuelve solo ep.user_id = auth.uid().
grant execute on function public.get_my_event_participant_events() to authenticated;

-- Preview: publico por token a proposito para permitir abrir el link antes de login/registro.
-- La privacidad depende de token fuerte y de no filtrar el link.
grant execute on function public.get_event_invite_preview(text) to anon, authenticated;
