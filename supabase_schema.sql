


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."accept_group_invite"("p_invite_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_my_email text := lower(coalesce(auth.email(),''));
  v_group_id uuid;
  v_email text;
  v_invited_email text;
  v_role text;
  v_status text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not authenticated');
  end if;

  select group_id, email, invited_email, role, status
  into v_group_id, v_email, v_invited_email, v_role, v_status
  from public.group_invites
  where id = p_invite_id;

  if v_group_id is null then
    return jsonb_build_object('ok', false, 'error', 'Invite not found');
  end if;

  if lower(coalesce(v_invited_email, v_email, '')) <> v_my_email
     and lower(coalesce(v_email,'')) <> v_my_email then
    return jsonb_build_object('ok', false, 'error', 'This invite is not for your email');
  end if;

  if lower(coalesce(v_status,'')) <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'Invite not pending');
  end if;

  update public.group_invites
  set status = 'accepted',
      accepted_at = now()
  where id = p_invite_id;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, v_uid, coalesce(nullif(trim(v_role),''),'member'))
  on conflict (group_id, user_id) do nothing;

  return jsonb_build_object(
    'ok', true,
    'group_id', v_group_id,
    'invite_id', p_invite_id,
    'status', 'accepted'
  );
end;
$$;


ALTER FUNCTION "public"."accept_group_invite"("p_invite_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_pending_invites"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  u_id uuid;
  u_email text;
begin
  select id, email into u_id, u_email
  from auth.users
  where id = auth.uid();

  if u_id is null then
    return;
  end if;

  -- aceptar todas las invitaciones pendientes para este email
  insert into public.group_members (group_id, user_id, role)
  select gi.group_id, u_id, 'member'
  from public.group_invites gi
  where lower(gi.email) = lower(u_email)
    and gi.status = 'pending'
  on conflict (group_id, user_id) do nothing;

  update public.group_invites
  set status = 'accepted',
      accepted_at = now()
  where lower(email) = lower(u_email)
    and status = 'pending';
end;
$$;


ALTER FUNCTION "public"."accept_pending_invites"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_read_group"("p_group_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.groups g
    where g.id = p_group_id
      and (g.owner_id = auth.uid() OR public.is_group_member(g.id))
  );
$$;


ALTER FUNCTION "public"."can_read_group"("p_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_group"("p_name" "text", "p_type" "text") RETURNS TABLE("id" "uuid", "name" "text", "type" "text", "created_at" timestamp with time zone, "owner_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
declare
  v_uid uuid;
  v_name text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_name := trim(coalesce(p_name, ''));
  if length(v_name) < 1 then
    raise exception 'Ponle un nombre al grupo.';
  end if;

  -- Inserta el grupo SIEMPRE con owner_id = auth.uid()
  insert into public.groups (name, type, owner_id)
  values (v_name, p_type, v_uid)
  returning groups.id, groups.name, groups.type, groups.created_at, groups.owner_id
  into id, name, type, created_at, owner_id;

  -- Inserta membership owner
  insert into public.group_members (group_id, user_id, role, created_at)
  values (id, v_uid, 'owner', now());

  return next;
end;
$$;


ALTER FUNCTION "public"."create_group"("p_name" "text", "p_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decline_group_invite"("p_invite_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_my_email text := lower(coalesce(auth.email(),''));
  v_group_id uuid;
  v_email text;
  v_invited_email text;
  v_status text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not authenticated');
  end if;

  select group_id, email, invited_email, status
  into v_group_id, v_email, v_invited_email, v_status
  from public.group_invites
  where id = p_invite_id;

  if v_group_id is null then
    return jsonb_build_object('ok', false, 'error', 'Invite not found');
  end if;

  if lower(coalesce(v_invited_email, v_email, '')) <> v_my_email
     and lower(coalesce(v_email,'')) <> v_my_email then
    return jsonb_build_object('ok', false, 'error', 'This invite is not for your email');
  end if;

  if lower(coalesce(v_status,'')) <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'Invite not pending');
  end if;

  update public.group_invites
  set status = 'declined',
      accepted_at = now()
  where id = p_invite_id;

  return jsonb_build_object(
    'ok', true,
    'group_id', v_group_id,
    'invite_id', p_invite_id,
    'status', 'declined'
  );
end;
$$;


ALTER FUNCTION "public"."decline_group_invite"("p_invite_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_group"("p_group_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Verifica que el que llama sea owner
  if not exists (
    select 1
    from groups
    where id = p_group_id
      and owner_id = auth.uid()
  ) then
    raise exception 'not_owner';
  end if;

  -- Dependencias (ajusta si tienes más tablas relacionadas)
  delete from group_messages where group_id = p_group_id;
  delete from group_invites  where group_id = p_group_id;
  delete from group_members  where group_id = p_group_id;
  delete from events         where group_id = p_group_id;

  delete from groups where id = p_group_id;
end;
$$;


ALTER FUNCTION "public"."delete_group"("p_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_group_owner_member"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.group_members (group_id, user_id, role, created_at)
  values (new.id, new.owner_id, 'owner', now())
  on conflict do nothing;

  return new;
end $$;


ALTER FUNCTION "public"."ensure_group_owner_member"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."events_set_defaults"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- updated_at siempre
  new.updated_at := now();

  -- si por alguna razón llega null, lo rellenamos
  if new.owner_id is null then
    new.owner_id := auth.uid();
  end if;

  if new.created_by is null then
    new.created_by := auth.uid();
  end if;

  -- range (para overlaps)
  new.time_range := tstzrange(new.start, new."end", '[)');

  return new;
end;
$$;


ALTER FUNCTION "public"."events_set_defaults"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."events_set_time_range"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.time_range := tstzrange(new.start, new."end", '[)');
  return new;
end;
$$;


ALTER FUNCTION "public"."events_set_time_range"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_event_responses"() RETURNS TABLE("id" "uuid", "event_id" "uuid", "user_id" "uuid", "group_id" "uuid", "response_status" "text", "comment" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "sql"
    AS $$
  select
    er.id,
    er.event_id,
    er.user_id,
    er.group_id,
    er.response_status,
    er.comment,
    er.created_at,
    er.updated_at
  from public.event_responses er
  where er.user_id = auth.uid()
  order by er.updated_at desc, er.created_at desc;
$$;


ALTER FUNCTION "public"."get_my_event_responses"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_id_by_email"("p_email" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_id uuid;
begin
  select id into v_id
  from auth.users
  where lower(email) = lower(p_email)
  limit 1;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."get_user_id_by_email"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gi_fill_email"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.email is null then
    new.email := new.invited_email;
  end if;

  if new.invited_email is not null then
    new.invited_email := lower(trim(new.invited_email));
  end if;

  if new.email is not null then
    new.email := lower(trim(new.email));
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."gi_fill_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      split_part(new.email, '@', 1),
      'Usuario'
    ),
    nullif(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invite_to_group"("p_group_id" "uuid", "p_email" "text", "p_role" "text" DEFAULT 'member'::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_invite_id uuid;
  v_email text;
begin
  -- Normalizar email
  v_email := lower(trim(p_email));

  if v_email is null or v_email = '' then
    return json_build_object(
      'ok', false,
      'error', 'Email inválido'
    );
  end if;

  -- Permisos: solo owner o admin puede invitar
  if not is_group_admin_or_owner(p_group_id) then
    return json_build_object(
      'ok', false,
      'error', 'No tienes permisos para invitar a este grupo'
    );
  end if;

  -- Insert o update de invitación
  insert into group_invites (
    group_id,
    email,
    invited_email,
    role,
    status,
    invited_by,
    created_at
  )
  values (
    p_group_id,
    v_email,
    v_email,
    coalesce(p_role, 'member'),
    'pending',
    auth.uid(),
    now()
  )
  on conflict (group_id, email)
  do update set
    role = excluded.role,
    status = 'pending',
    invited_by = auth.uid(),
    created_at = now()
  returning id into v_invite_id;

  return json_build_object(
    'ok', true,
    'group_id', p_group_id,
    'invite_id', v_invite_id,
    'invited_email', v_email,
    'status', 'pending'
  );
end;
$$;


ALTER FUNCTION "public"."invite_to_group"("p_group_id" "uuid", "p_email" "text", "p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_group_admin"("p_group_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = auth.uid()
      and gm.role in ('owner','admin')
  );
$$;


ALTER FUNCTION "public"."is_group_admin"("p_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_group_admin"("p_group_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_members
    WHERE group_id = p_group_id
      AND user_id = p_user_id
      AND role IN ('admin', 'owner')
  );
$$;


ALTER FUNCTION "public"."is_group_admin"("p_group_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_group_admin_or_owner"("p_group_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = auth.uid()
      and gm.role in ('owner', 'admin')
  );
$$;


ALTER FUNCTION "public"."is_group_admin_or_owner"("p_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_group_manager"("p_group_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_user_id
      and gm.role in ('owner','admin')
  );
$$;


ALTER FUNCTION "public"."is_group_manager"("p_group_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_group_member"("p_group_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_group_member"("p_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_group_member"("p_group_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_user_id
  );
$$;


ALTER FUNCTION "public"."is_group_member"("p_group_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_group_owner"("p_group_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM groups
    WHERE id = p_group_id
      AND owner_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_group_owner"("p_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_member_of_group"("target_group_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_member_of_group"("target_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."jwt_email"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  select coalesce(
    nullif((auth.jwt() ->> 'email'), ''),
    nullif((auth.jwt() -> 'user_metadata' ->> 'email'), '')
  );
$$;


ALTER FUNCTION "public"."jwt_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_group"("p_group_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_rowcount integer := 0;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select gm.role
    into v_role
  from public.group_members gm
  where gm.group_id = p_group_id
    and gm.user_id = v_uid;

  if v_role is null then
    return json_build_object('ok', false, 'error', 'not_a_member');
  end if;

  -- Owner no puede "salirse" (para no dejar grupo huérfano).
  -- Si es owner: debe borrar el grupo (delete_group) o luego hacemos "transfer ownership".
  if v_role = 'owner' then
    return json_build_object('ok', false, 'error', 'owner_cannot_leave');
  end if;

  delete from public.group_members
  where group_id = p_group_id
    and user_id = v_uid;

  get diagnostics v_rowcount = row_count;

  return json_build_object('ok', (v_rowcount > 0));
end;
$$;


ALTER FUNCTION "public"."leave_group"("p_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_email"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;


ALTER FUNCTION "public"."my_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_conflict_on_event"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.group_id is null then
    return new;
  end if;

  perform public.notify_conflicts_for_event(new.id);
  return new;
end;
$$;


ALTER FUNCTION "public"."notify_conflict_on_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_conflicts_for_event"("p_event_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  e record;
  r record;
begin
  -- evento recién creado/actualizado
  select * into e
  from public.events
  where id = p_event_id;

  -- solo eventos de grupo
  if e is null or e.group_id is null then
    return;
  end if;

  -- busca eventos que se cruzan con e dentro del mismo grupo
  for r in
    select id, title
    from public.events
    where group_id = e.group_id
      and id <> e.id
      and time_range && e.time_range
    limit 20
  loop
    -- crea una notificación por miembro del grupo
    insert into public.notifications (
      user_id,
      type,
      title,
      body,
      entity_id
    )
    select
      gm.user_id,
      'conflict',
      'Conflicto de horario',
      'Tu evento "' || coalesce(e.title, 'Evento') ||
      '" se cruza con "' || coalesce(r.title, 'Otro evento') || '".',
      e.id
    from public.group_members gm
    where gm.group_id = e.group_id
      and gm.user_id is not null
      -- evita duplicados por si actualizas varias veces el mismo evento
      and not exists (
        select 1
        from public.notifications n
        where n.user_id = gm.user_id
          and n.type = 'conflict'
          and n.entity_id = e.id
          and n.created_at > now() - interval '10 minutes'
      );
  end loop;
end;
$$;


ALTER FUNCTION "public"."notify_conflicts_for_event"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_event_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.notifications (user_id, type, title, body, entity_id)
  select
    gm.user_id,
    'event_created',
    'Nuevo evento creado',
    new.title,
    new.id
  from public.group_members gm
  where gm.group_id = new.group_id
    and gm.user_id <> new.created_by;

  return new;
end;
$$;


ALTER FUNCTION "public"."notify_event_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_event_deleted"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.notifications (user_id, type, title, body, entity_id)
  select
    gm.user_id,
    'event_deleted',
    'Evento eliminado',
    old.title,
    old.id
  from public.group_members gm
  where gm.group_id = old.group_id
    and gm.user_id <> old.created_by;

  return old;
end;
$$;


ALTER FUNCTION "public"."notify_event_deleted"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."event_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "group_id" "uuid",
    "response_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_responses_status_check" CHECK (("response_status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text"])))
);


ALTER TABLE "public"."event_responses" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."respond_to_event"("p_event_id" "uuid", "p_response_status" "text", "p_comment" "text" DEFAULT NULL::"text") RETURNS "public"."event_responses"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_user_id uuid;
  v_group_id uuid;
  v_row public.event_responses;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_response_status not in ('pending', 'accepted', 'declined') then
    raise exception 'Invalid response_status';
  end if;

  select e.group_id
    into v_group_id
  from public.events e
  where e.id = p_event_id;

  if not found then
    raise exception 'Event not found';
  end if;

  insert into public.event_responses (
    event_id,
    user_id,
    group_id,
    response_status,
    comment
  )
  values (
    p_event_id,
    v_user_id,
    v_group_id,
    p_response_status,
    p_comment
  )
  on conflict (event_id, user_id)
  do update set
    response_status = excluded.response_status,
    comment = excluded.comment,
    group_id = excluded.group_id,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;


ALTER FUNCTION "public"."respond_to_event"("p_event_id" "uuid", "p_response_status" "text", "p_comment" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_current_timestamp_user_notif"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_current_timestamp_user_notif"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_group_message_author"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.author_id is null then
    new.author_id := auth.uid();
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."set_group_message_author"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."tg_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_event_responses_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_event_responses_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_events_conflict_notify"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.notify_conflicts_for_event(new.id);
  return new;
end $$;


ALTER FUNCTION "public"."trg_events_conflict_notify"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conflict_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "conflict_key" "text" NOT NULL,
    "event_a_id" "uuid",
    "event_b_id" "uuid",
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "conflict_preferences_status_check" CHECK (("status" = ANY (ARRAY['ignored'::"text", 'accepted'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."conflict_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conflict_resolutions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "group_id" "text",
    "existing_event_id" "text",
    "incoming_event_id" "text",
    "resolution" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "group_id_norm" "text" GENERATED ALWAYS AS (COALESCE("group_id", '__none__'::"text")) STORED,
    "conflict_id" "text" NOT NULL,
    CONSTRAINT "conflict_resolutions_resolution_check" CHECK (("resolution" = ANY (ARRAY['keep_existing'::"text", 'replace_with_new'::"text", 'none'::"text"])))
);


ALTER TABLE "public"."conflict_resolutions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conflict_resolutions_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conflict_id" "text" NOT NULL,
    "group_id" "uuid",
    "decided_by" "uuid" NOT NULL,
    "decision_type" "text" NOT NULL,
    "final_action" "text" NOT NULL,
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."conflict_resolutions_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."connected_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "provider_account_id" "text",
    "email" "text",
    "access_token" "text",
    "refresh_token" "text",
    "token_expires_at" timestamp with time zone,
    "scopes" "text"[],
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "connected_accounts_provider_check" CHECK (("provider" = ANY (ARRAY['google'::"text", 'microsoft'::"text"]))),
    CONSTRAINT "connected_accounts_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."connected_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "group_id" "uuid",
    "title" "text" NOT NULL,
    "notes" "text",
    "start" timestamp with time zone NOT NULL,
    "end" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "time_range" "tstzrange",
    "created_by" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "external_source" "text",
    "external_id" "text",
    "external_updated_at" timestamp with time zone,
    "travel_mode" "text",
    "travel_eta_seconds" integer,
    "leave_time" timestamp with time zone,
    "location_label" "text",
    "location_address" "text",
    "location_lat" double precision,
    "location_lng" double precision,
    "location_provider" "text",
    "location_place_id" "text"
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events_analytics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "entity_id" "uuid",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."events_analytics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."external_busy_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "calendar_id" "text" NOT NULL,
    "external_event_id" "text",
    "start" timestamp with time zone NOT NULL,
    "end" timestamp with time zone NOT NULL,
    "is_all_day" boolean DEFAULT false NOT NULL,
    "title" "text",
    "updated_at_provider" timestamp with time zone,
    "last_synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "start_at" timestamp with time zone GENERATED ALWAYS AS ("start") STORED,
    "end_at" timestamp with time zone GENERATED ALWAYS AS ("end") STORED,
    CONSTRAINT "external_busy_blocks_provider_check" CHECK (("provider" = ANY (ARRAY['google'::"text", 'microsoft'::"text"])))
);


ALTER TABLE "public"."external_busy_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."external_calendar_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "calendar_id" "text" NOT NULL,
    "calendar_name" "text",
    "include_in_conflicts" boolean DEFAULT true NOT NULL,
    "title_visibility" "text" DEFAULT 'hidden'::"text" NOT NULL,
    "google_channel_id" "text",
    "google_resource_id" "text",
    "google_sync_token" "text",
    "google_watch_expiration" timestamp with time zone,
    "ms_subscription_id" "text",
    "ms_subscription_expiration" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "external_calendar_settings_provider_check" CHECK (("provider" = ANY (ARRAY['google'::"text", 'microsoft'::"text"]))),
    CONSTRAINT "external_calendar_settings_title_visibility_check" CHECK (("title_visibility" = ANY (ARRAY['hidden'::"text", 'shown'::"text"])))
);


ALTER TABLE "public"."external_calendar_settings" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."external_events" WITH ("security_invoker"='true') AS
 SELECT "id",
    "user_id",
    "provider",
    "calendar_id",
    "external_event_id",
    "start" AS "start_at",
    "end" AS "end_at",
    "is_all_day" AS "all_day",
    "title",
    "updated_at_provider",
    "last_synced_at",
    "created_at",
    "updated_at"
   FROM "public"."external_busy_blocks";


ALTER VIEW "public"."external_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."google_accounts" (
    "user_id" "uuid" NOT NULL,
    "access_token" "text",
    "refresh_token" "text",
    "expires_at" timestamp with time zone,
    "scope" "text",
    "email" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "provider" "text" DEFAULT 'google'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."google_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "email" "text",
    "role" "text" DEFAULT 'member'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "invited_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "accepted_at" timestamp with time zone,
    "invited_email" "text" NOT NULL,
    "invited_user_id" "uuid",
    CONSTRAINT "group_invites_role_check" CHECK (("role" = 'member'::"text")),
    CONSTRAINT "group_invites_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text"])))
);


ALTER TABLE "public"."group_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "display_name" "text",
    "relationship_role" "text",
    "coordination_prefs" "jsonb"
);


ALTER TABLE "public"."group_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."group_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_notification_settings" (
    "user_id" "uuid" NOT NULL,
    "group_id" "uuid" NOT NULL,
    "muted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."group_notification_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "groups_type_check" CHECK (("type" = ANY (ARRAY['solo'::"text", 'pair'::"text", 'family'::"text", 'personal'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "entity_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "read_at" timestamp with time zone,
    "payload" "jsonb",
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['conflict'::"text", 'conflict_detected'::"text", 'event_created'::"text", 'event_deleted'::"text", 'event_rejected'::"text", 'leave_alert'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "first_name" "text",
    "last_name" "text",
    "timezone" "text",
    "language" "text",
    "coordination_prefs" "jsonb",
    "plan_tier" "text" DEFAULT 'demo_premium'::"text",
    "plan_status" "text" DEFAULT 'trial'::"text",
    "trial_ends_at" timestamp with time zone,
    "daily_digest_enabled" boolean DEFAULT false NOT NULL,
    "daily_digest_hour_local" smallint,
    "daily_digest_timezone" "text",
    "paddle_customer_id" "text",
    "subscription_status" "text" DEFAULT 'inactive'::"text",
    "subscription_renews_at" timestamp with time zone,
    "onboarding_completed" boolean DEFAULT false NOT NULL,
    "onboarding_completed_at" timestamp with time zone
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proposal_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "response" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "proposal_responses_response_check" CHECK (("response" = ANY (ARRAY['accepted'::"text", 'adjusted'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."proposal_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."public_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid",
    "contact" "text",
    "token" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "proposed_date" timestamp with time zone,
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "creator_response" "text"
);


ALTER TABLE "public"."public_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_notification_settings" (
    "user_id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "event_reminders" boolean DEFAULT true NOT NULL,
    "conflict_alerts" boolean DEFAULT true NOT NULL,
    "partner_updates" boolean DEFAULT true NOT NULL,
    "family_updates" boolean DEFAULT true NOT NULL,
    "weekly_summary" boolean DEFAULT true NOT NULL,
    "quiet_hours_enabled" boolean DEFAULT false NOT NULL,
    "quiet_from" "text" DEFAULT '22:00'::"text" NOT NULL,
    "quiet_to" "text" DEFAULT '07:00'::"text" NOT NULL
);


ALTER TABLE "public"."user_notification_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "user_id" "uuid" NOT NULL,
    "event_reminders" boolean DEFAULT true NOT NULL,
    "conflict_alerts" boolean DEFAULT true NOT NULL,
    "partner_updates" boolean DEFAULT true NOT NULL,
    "family_updates" boolean DEFAULT true NOT NULL,
    "weekly_summary" boolean DEFAULT true NOT NULL,
    "quiet_hours_enabled" boolean DEFAULT false NOT NULL,
    "quiet_from" "text" DEFAULT '22:00'::"text" NOT NULL,
    "quiet_to" "text" DEFAULT '07:30'::"text" NOT NULL,
    "conflict_warn_before_save" boolean DEFAULT true NOT NULL,
    "conflict_default_resolution" "text" DEFAULT 'ask_me'::"text" NOT NULL,
    "perm_personal" "text" DEFAULT 'owner_only'::"text" NOT NULL,
    "perm_pair" "text" DEFAULT 'shared_write'::"text" NOT NULL,
    "perm_family" "text" DEFAULT 'shared_read'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "daily_summary" boolean DEFAULT true NOT NULL,
    "last_known_lat" double precision,
    "last_known_lng" double precision,
    "last_known_at" timestamp with time zone,
    "last_known_accuracy_m" double precision,
    "location_enabled" boolean DEFAULT false NOT NULL,
    "location_prompt_status" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "location_prompted_at" timestamp with time zone,
    "location_dismissed_until" timestamp with time zone
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_settings"."last_known_lat" IS 'Last known latitude for smart mobility leave-time calculations.';



COMMENT ON COLUMN "public"."user_settings"."last_known_lng" IS 'Last known longitude for smart mobility leave-time calculations.';



COMMENT ON COLUMN "public"."user_settings"."last_known_at" IS 'Timestamp when the last known location was captured.';



ALTER TABLE ONLY "public"."conflict_preferences"
    ADD CONSTRAINT "conflict_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conflict_preferences"
    ADD CONSTRAINT "conflict_preferences_user_id_conflict_key_key" UNIQUE ("user_id", "conflict_key");



ALTER TABLE ONLY "public"."conflict_resolutions"
    ADD CONSTRAINT "conflict_resolutions_conflict_id_user_id_key" UNIQUE ("conflict_id", "user_id");



ALTER TABLE ONLY "public"."conflict_resolutions_log"
    ADD CONSTRAINT "conflict_resolutions_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conflict_resolutions"
    ADD CONSTRAINT "conflict_resolutions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."connected_accounts"
    ADD CONSTRAINT "connected_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."connected_accounts"
    ADD CONSTRAINT "connected_accounts_user_id_provider_provider_account_id_key" UNIQUE ("user_id", "provider", "provider_account_id");



ALTER TABLE ONLY "public"."event_responses"
    ADD CONSTRAINT "event_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_responses"
    ADD CONSTRAINT "event_responses_unique_event_user" UNIQUE ("event_id", "user_id");



ALTER TABLE ONLY "public"."events_analytics"
    ADD CONSTRAINT "events_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_user_external_unique" UNIQUE ("user_id", "external_source", "external_id");



ALTER TABLE ONLY "public"."external_busy_blocks"
    ADD CONSTRAINT "external_busy_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."external_busy_blocks"
    ADD CONSTRAINT "external_busy_blocks_user_id_provider_calendar_id_external__key" UNIQUE ("user_id", "provider", "calendar_id", "external_event_id");



ALTER TABLE ONLY "public"."external_calendar_settings"
    ADD CONSTRAINT "external_calendar_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."external_calendar_settings"
    ADD CONSTRAINT "external_calendar_settings_user_id_provider_calendar_id_key" UNIQUE ("user_id", "provider", "calendar_id");



ALTER TABLE ONLY "public"."google_accounts"
    ADD CONSTRAINT "google_accounts_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."group_invites"
    ADD CONSTRAINT "group_invites_group_id_email_key" UNIQUE ("group_id", "email");



ALTER TABLE ONLY "public"."group_invites"
    ADD CONSTRAINT "group_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_group_id_user_id_key" UNIQUE ("group_id", "user_id");



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_unique_member" UNIQUE ("group_id", "user_id");



ALTER TABLE ONLY "public"."group_messages"
    ADD CONSTRAINT "group_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_notification_settings"
    ADD CONSTRAINT "group_notification_settings_pkey" PRIMARY KEY ("user_id", "group_id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposal_responses"
    ADD CONSTRAINT "proposal_responses_event_user_unique" UNIQUE ("event_id", "user_id");



ALTER TABLE ONLY "public"."proposal_responses"
    ADD CONSTRAINT "proposal_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."public_invites"
    ADD CONSTRAINT "public_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."public_invites"
    ADD CONSTRAINT "public_invites_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_endpoint_key" UNIQUE ("user_id", "endpoint");



ALTER TABLE ONLY "public"."user_notification_settings"
    ADD CONSTRAINT "user_notification_settings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id");



CREATE INDEX "connected_accounts_user_id_idx" ON "public"."connected_accounts" USING "btree" ("user_id");



CREATE INDEX "connected_accounts_user_provider_idx" ON "public"."connected_accounts" USING "btree" ("user_id", "provider");



CREATE INDEX "events_external_source_idx" ON "public"."events" USING "btree" ("external_source");



CREATE UNIQUE INDEX "events_external_unique" ON "public"."events" USING "btree" ("user_id", "external_source", "external_id");



CREATE INDEX "external_busy_blocks_user_end_idx" ON "public"."external_busy_blocks" USING "btree" ("user_id", "end");



CREATE INDEX "external_busy_blocks_user_provider_idx" ON "public"."external_busy_blocks" USING "btree" ("user_id", "provider");



CREATE INDEX "external_busy_blocks_user_start_idx" ON "public"."external_busy_blocks" USING "btree" ("user_id", "start");



CREATE INDEX "external_calendar_settings_user_idx" ON "public"."external_calendar_settings" USING "btree" ("user_id");



CREATE INDEX "external_calendar_settings_user_provider_idx" ON "public"."external_calendar_settings" USING "btree" ("user_id", "provider");



CREATE INDEX "group_invites_invited_email_idx" ON "public"."group_invites" USING "btree" ("invited_email");



CREATE INDEX "group_invites_invited_user_id_idx" ON "public"."group_invites" USING "btree" ("invited_user_id");



CREATE INDEX "idx_conflict_preferences_conflict" ON "public"."conflict_preferences" USING "btree" ("conflict_key");



CREATE INDEX "idx_conflict_preferences_user" ON "public"."conflict_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_conflict_resolutions_log_conflict_id" ON "public"."conflict_resolutions_log" USING "btree" ("conflict_id");



CREATE INDEX "idx_conflict_resolutions_log_created_at" ON "public"."conflict_resolutions_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_conflict_resolutions_log_decided_by" ON "public"."conflict_resolutions_log" USING "btree" ("decided_by");



CREATE INDEX "idx_conflict_resolutions_log_group_id" ON "public"."conflict_resolutions_log" USING "btree" ("group_id");



CREATE INDEX "idx_event_responses_event" ON "public"."event_responses" USING "btree" ("event_id");



CREATE INDEX "idx_event_responses_event_id" ON "public"."event_responses" USING "btree" ("event_id");



CREATE INDEX "idx_event_responses_group_id" ON "public"."event_responses" USING "btree" ("group_id");



CREATE INDEX "idx_event_responses_status" ON "public"."event_responses" USING "btree" ("response_status");



CREATE INDEX "idx_event_responses_user" ON "public"."event_responses" USING "btree" ("user_id");



CREATE INDEX "idx_event_responses_user_id" ON "public"."event_responses" USING "btree" ("user_id");



CREATE INDEX "idx_events_analytics_event_type_created_at" ON "public"."events_analytics" USING "btree" ("event_type", "created_at" DESC);



CREATE INDEX "idx_events_analytics_user_created_at" ON "public"."events_analytics" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_events_group" ON "public"."events" USING "btree" ("group_id");



CREATE INDEX "idx_events_group_range_gist" ON "public"."events" USING "gist" ("group_id", "time_range");



CREATE INDEX "idx_events_leave_time" ON "public"."events" USING "btree" ("leave_time");



CREATE INDEX "idx_events_location_place_id" ON "public"."events" USING "btree" ("location_place_id");



CREATE INDEX "idx_events_owner" ON "public"."events" USING "btree" ("owner_id");



CREATE INDEX "idx_gm_group" ON "public"."group_members" USING "btree" ("group_id");



CREATE INDEX "idx_gm_user" ON "public"."group_members" USING "btree" ("user_id");



CREATE INDEX "idx_group_invites_group_id" ON "public"."group_invites" USING "btree" ("group_id");



CREATE INDEX "idx_group_invites_invited_email" ON "public"."group_invites" USING "btree" ("invited_email");



CREATE INDEX "idx_group_members_group_id" ON "public"."group_members" USING "btree" ("group_id");



CREATE INDEX "idx_group_members_user_id" ON "public"."group_members" USING "btree" ("user_id");



CREATE INDEX "idx_group_messages_group_created" ON "public"."group_messages" USING "btree" ("group_id", "created_at" DESC);



CREATE INDEX "proposal_responses_event_id_idx" ON "public"."proposal_responses" USING "btree" ("event_id");



CREATE INDEX "proposal_responses_response_idx" ON "public"."proposal_responses" USING "btree" ("response");



CREATE INDEX "proposal_responses_user_id_idx" ON "public"."proposal_responses" USING "btree" ("user_id");



CREATE UNIQUE INDEX "uq_notifications_leave_alert_once" ON "public"."notifications" USING "btree" ("user_id", "entity_id") WHERE ("type" = 'leave_alert'::"text");



CREATE UNIQUE INDEX "user_notification_settings_user_id_key" ON "public"."user_notification_settings" USING "btree" ("user_id");



CREATE UNIQUE INDEX "user_settings_user_id_key" ON "public"."user_settings" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "set_timestamp_user_notif" BEFORE UPDATE ON "public"."user_notification_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_user_notif"();



CREATE OR REPLACE TRIGGER "set_updated_at_group_notification_settings" BEFORE UPDATE ON "public"."group_notification_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_timestamp"();



CREATE OR REPLACE TRIGGER "trg_conflict_resolutions_updated_at" BEFORE UPDATE ON "public"."conflict_resolutions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_connected_accounts_updated_at" BEFORE UPDATE ON "public"."connected_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_event_created" AFTER INSERT ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."notify_event_created"();



CREATE OR REPLACE TRIGGER "trg_event_deleted" AFTER DELETE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."notify_event_deleted"();



CREATE OR REPLACE TRIGGER "trg_event_responses_set_updated_at" BEFORE UPDATE ON "public"."event_responses" FOR EACH ROW EXECUTE FUNCTION "public"."trg_event_responses_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_events_conflict_notify" AFTER INSERT OR UPDATE OF "start", "end" ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."trg_events_conflict_notify"();



CREATE OR REPLACE TRIGGER "trg_events_set_defaults" BEFORE INSERT OR UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."events_set_defaults"();



CREATE OR REPLACE TRIGGER "trg_external_busy_blocks_updated_at" BEFORE UPDATE ON "public"."external_busy_blocks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_external_calendar_settings_updated_at" BEFORE UPDATE ON "public"."external_calendar_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_gi_fill_email" BEFORE INSERT OR UPDATE ON "public"."group_invites" FOR EACH ROW EXECUTE FUNCTION "public"."gi_fill_email"();



CREATE OR REPLACE TRIGGER "trg_groups_updated_at" BEFORE UPDATE ON "public"."groups" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_proposal_responses_updated_at" BEFORE UPDATE ON "public"."proposal_responses" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_set_group_message_author" BEFORE INSERT ON "public"."group_messages" FOR EACH ROW EXECUTE FUNCTION "public"."set_group_message_author"();



CREATE OR REPLACE TRIGGER "trg_touch_user_notification_settings" BEFORE UPDATE ON "public"."user_notification_settings" FOR EACH ROW EXECUTE FUNCTION "public"."tg_touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_user_settings_updated_at" BEFORE UPDATE ON "public"."user_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."conflict_preferences"
    ADD CONSTRAINT "conflict_preferences_event_a_id_fkey" FOREIGN KEY ("event_a_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conflict_preferences"
    ADD CONSTRAINT "conflict_preferences_event_b_id_fkey" FOREIGN KEY ("event_b_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conflict_preferences"
    ADD CONSTRAINT "conflict_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conflict_resolutions_log"
    ADD CONSTRAINT "conflict_resolutions_log_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conflict_resolutions_log"
    ADD CONSTRAINT "conflict_resolutions_log_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conflict_resolutions"
    ADD CONSTRAINT "conflict_resolutions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."connected_accounts"
    ADD CONSTRAINT "connected_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_responses"
    ADD CONSTRAINT "event_responses_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_responses"
    ADD CONSTRAINT "event_responses_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_responses"
    ADD CONSTRAINT "event_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."external_busy_blocks"
    ADD CONSTRAINT "external_busy_blocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."external_calendar_settings"
    ADD CONSTRAINT "external_calendar_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."google_accounts"
    ADD CONSTRAINT "google_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_invites"
    ADD CONSTRAINT "group_invites_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_invites"
    ADD CONSTRAINT "group_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."group_invites"
    ADD CONSTRAINT "group_invites_invited_user_id_fkey" FOREIGN KEY ("invited_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_user_id_profiles_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_messages"
    ADD CONSTRAINT "group_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_messages"
    ADD CONSTRAINT "group_messages_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_notification_settings"
    ADD CONSTRAINT "group_notification_settings_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_notification_settings"
    ADD CONSTRAINT "group_notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_responses"
    ADD CONSTRAINT "proposal_responses_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_responses"
    ADD CONSTRAINT "proposal_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."public_invites"
    ADD CONSTRAINT "public_invites_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_notification_settings"
    ADD CONSTRAINT "user_notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Group members can read notif settings for their groups" ON "public"."group_notification_settings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."group_members" "gm"
  WHERE (("gm"."group_id" = "group_notification_settings"."group_id") AND ("gm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Notifications insert own" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users manage own group notif settings" ON "public"."group_notification_settings" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."conflict_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conflict_resolutions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conflict_resolutions_delete_own" ON "public"."conflict_resolutions" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "conflict_resolutions_insert_own" ON "public"."conflict_resolutions" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."conflict_resolutions_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conflict_resolutions_log_insert_authenticated" ON "public"."conflict_resolutions_log" FOR INSERT TO "authenticated" WITH CHECK (("decided_by" = "auth"."uid"()));



CREATE POLICY "conflict_resolutions_log_select_members" ON "public"."conflict_resolutions_log" FOR SELECT TO "authenticated" USING ((("group_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."group_members" "gm"
  WHERE (("gm"."group_id" = "conflict_resolutions_log"."group_id") AND ("gm"."user_id" = "auth"."uid"()))))));



CREATE POLICY "conflict_resolutions_select_own" ON "public"."conflict_resolutions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "conflict_resolutions_update_own" ON "public"."conflict_resolutions" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."connected_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "connected_accounts_delete_own" ON "public"."connected_accounts" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "connected_accounts_select_own" ON "public"."connected_accounts" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "cp_delete_own" ON "public"."conflict_preferences" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "cp_insert_own" ON "public"."conflict_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "cp_select_own" ON "public"."conflict_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "cp_update_own" ON "public"."conflict_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "delete_own_group_notification_settings" ON "public"."group_notification_settings" FOR DELETE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."event_responses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_responses_delete_own" ON "public"."event_responses" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "event_responses_insert_own" ON "public"."event_responses" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "event_responses_select_own" ON "public"."event_responses" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "event_responses_update_own" ON "public"."event_responses" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events_analytics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "events_analytics_insert_own" ON "public"."events_analytics" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "events_analytics_select_own" ON "public"."events_analytics" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "events_delete_clean" ON "public"."events" FOR DELETE TO "authenticated" USING (((("group_id" IS NULL) AND ("owner_id" = "auth"."uid"())) OR (("group_id" IS NOT NULL) AND "public"."is_group_admin"("group_id", "auth"."uid"()))));



CREATE POLICY "events_insert_clean" ON "public"."events" FOR INSERT TO "authenticated" WITH CHECK ((("owner_id" = "auth"."uid"()) AND (("group_id" IS NULL) OR "public"."is_group_member"("group_id", "auth"."uid"()))));



CREATE POLICY "events_select_clean" ON "public"."events" FOR SELECT TO "authenticated" USING (((("group_id" IS NULL) AND ("owner_id" = "auth"."uid"())) OR (("group_id" IS NOT NULL) AND "public"."is_group_member"("group_id", "auth"."uid"()))));



CREATE POLICY "events_update_clean" ON "public"."events" FOR UPDATE TO "authenticated" USING ((("owner_id" = "auth"."uid"()) AND (("group_id" IS NULL) OR "public"."is_group_member"("group_id", "auth"."uid"())))) WITH CHECK ((("owner_id" = "auth"."uid"()) AND (("group_id" IS NULL) OR "public"."is_group_member"("group_id", "auth"."uid"()))));



ALTER TABLE "public"."external_busy_blocks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "external_busy_blocks_select_own" ON "public"."external_busy_blocks" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."external_calendar_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "external_calendar_settings_delete_own" ON "public"."external_calendar_settings" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "external_calendar_settings_insert_own" ON "public"."external_calendar_settings" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "external_calendar_settings_select_own" ON "public"."external_calendar_settings" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "external_calendar_settings_update_own" ON "public"."external_calendar_settings" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."google_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "google_accounts_insert_own" ON "public"."google_accounts" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "google_accounts_select_own" ON "public"."google_accounts" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "google_accounts_update_own" ON "public"."google_accounts" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."group_invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_invites_delete_inviter" ON "public"."group_invites" FOR DELETE TO "authenticated" USING (("invited_by" = "auth"."uid"()));



CREATE POLICY "group_invites_insert_admin" ON "public"."group_invites" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."groups" "g"
  WHERE (("g"."id" = "group_invites"."group_id") AND ("g"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."group_members" "gm"
  WHERE (("gm"."group_id" = "group_invites"."group_id") AND ("gm"."user_id" = "auth"."uid"()) AND (COALESCE("gm"."role", 'member'::"text") = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



CREATE POLICY "group_invites_select_own" ON "public"."group_invites" FOR SELECT TO "authenticated" USING ((("lower"(COALESCE("invited_email", "email", ''::"text")) = "lower"(COALESCE("auth"."email"(), ''::"text"))) OR ("invited_by" = "auth"."uid"())));



CREATE POLICY "group_invites_update_admin" ON "public"."group_invites" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."groups" "g"
  WHERE (("g"."id" = "group_invites"."group_id") AND ("g"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."group_members" "gm"
  WHERE (("gm"."group_id" = "group_invites"."group_id") AND ("gm"."user_id" = "auth"."uid"()) AND (COALESCE("gm"."role", 'member'::"text") = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."groups" "g"
  WHERE (("g"."id" = "group_invites"."group_id") AND ("g"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."group_members" "gm"
  WHERE (("gm"."group_id" = "group_invites"."group_id") AND ("gm"."user_id" = "auth"."uid"()) AND (COALESCE("gm"."role", 'member'::"text") = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



CREATE POLICY "group_invites_update_self" ON "public"."group_invites" FOR UPDATE TO "authenticated" USING (("lower"(COALESCE("invited_email", "email", ''::"text")) = "lower"(COALESCE("auth"."email"(), ''::"text")))) WITH CHECK (("lower"(COALESCE("invited_email", "email", ''::"text")) = "lower"(COALESCE("auth"."email"(), ''::"text"))));



ALTER TABLE "public"."group_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_members_delete_owner" ON "public"."group_members" FOR DELETE TO "authenticated" USING ("public"."is_group_owner"("group_id"));



CREATE POLICY "group_members_insert_admin" ON "public"."group_members" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."groups" "g"
  WHERE (("g"."id" = "group_members"."group_id") AND ("g"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."group_members" "gm"
  WHERE (("gm"."group_id" = "group_members"."group_id") AND ("gm"."user_id" = "auth"."uid"()) AND (COALESCE("gm"."role", ''::"text") = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



CREATE POLICY "group_members_select_own" ON "public"."group_members" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "group_members_select_same_group" ON "public"."group_members" FOR SELECT TO "authenticated" USING ("public"."is_member_of_group"("group_id"));



ALTER TABLE "public"."group_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_messages_insert_members_only" ON "public"."group_messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."group_members" "gm"
  WHERE (("gm"."group_id" = "group_messages"."group_id") AND ("gm"."user_id" = "auth"."uid"())))));



CREATE POLICY "group_messages_select_members_only" ON "public"."group_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."group_members" "gm"
  WHERE (("gm"."group_id" = "group_messages"."group_id") AND ("gm"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."group_notification_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "groups_delete_owner" ON "public"."groups" FOR DELETE TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "groups_insert_owner" ON "public"."groups" FOR INSERT TO "authenticated" WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "groups_select_for_invited_users" ON "public"."groups" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."group_invites" "gi"
  WHERE (("gi"."group_id" = "groups"."id") AND ("gi"."status" = 'pending'::"text") AND ("lower"(COALESCE("gi"."invited_email", "gi"."email", ''::"text")) = "lower"(COALESCE("auth"."email"(), ''::"text")))))));



CREATE POLICY "groups_select_if_member" ON "public"."groups" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."group_members" "gm"
  WHERE (("gm"."group_id" = "groups"."id") AND ("gm"."user_id" = "auth"."uid"())))));



CREATE POLICY "groups_update_owner" ON "public"."groups" FOR UPDATE TO "authenticated" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "insert_own_group_notification_settings" ON "public"."group_notification_settings" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "members can leave group" ON "public"."group_members" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND ("role" <> 'owner'::"text")));



CREATE POLICY "members_can_update_own_membership" ON "public"."group_members" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_insert_event_rejected_actor" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK ((("type" = 'event_rejected'::"text") AND (COALESCE(("payload" ->> 'actor_user_id'::"text"), ''::"text") = ("auth"."uid"())::"text")));



CREATE POLICY "notifications_select_own" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "notifications_update_own" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_self" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "profiles_select_same_groups" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" IN ( SELECT "gm2"."user_id"
   FROM ("public"."group_members" "gm1"
     JOIN "public"."group_members" "gm2" ON (("gm1"."group_id" = "gm2"."group_id")))
  WHERE ("gm1"."user_id" = "auth"."uid"()))));



CREATE POLICY "profiles_select_self" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_update_self" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."proposal_responses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposal_responses_insert_own" ON "public"."proposal_responses" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "proposal_responses_select_own" ON "public"."proposal_responses" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "proposal_responses_update_own" ON "public"."proposal_responses" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."public_invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public_invites_insert_authenticated" ON "public"."public_invites" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "public_invites_select_authenticated_event_owner" ON "public"."public_invites" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "public_invites"."event_id") AND (("e"."owner_id" = "auth"."uid"()) OR ("e"."user_id" = "auth"."uid"()) OR ("e"."created_by" = "auth"."uid"()))))));



CREATE POLICY "public_invites_update_authenticated_event_owner" ON "public"."public_invites" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "public_invites"."event_id") AND (("e"."owner_id" = "auth"."uid"()) OR ("e"."user_id" = "auth"."uid"()) OR ("e"."created_by" = "auth"."uid"())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "public_invites"."event_id") AND (("e"."owner_id" = "auth"."uid"()) OR ("e"."user_id" = "auth"."uid"()) OR ("e"."created_by" = "auth"."uid"()))))));



ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "push_subscriptions_delete_own" ON "public"."push_subscriptions" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "push_subscriptions_insert_own" ON "public"."push_subscriptions" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "push_subscriptions_select_own" ON "public"."push_subscriptions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "push_subscriptions_update_own" ON "public"."push_subscriptions" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "select_own_group_notification_settings" ON "public"."group_notification_settings" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "update_own_group_notification_settings" ON "public"."group_notification_settings" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."user_notification_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_notification_settings_insert_own" ON "public"."user_notification_settings" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "user_notification_settings_select_own" ON "public"."user_notification_settings" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "user_notification_settings_update_own" ON "public"."user_notification_settings" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_settings_insert_own" ON "public"."user_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user_settings_select_own" ON "public"."user_settings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_settings_update_own" ON "public"."user_settings" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."accept_group_invite"("p_invite_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_group_invite"("p_invite_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."accept_group_invite"("p_invite_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."accept_pending_invites"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_pending_invites"() TO "service_role";
GRANT ALL ON FUNCTION "public"."accept_pending_invites"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."can_read_group"("p_group_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_read_group"("p_group_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."can_read_group"("p_group_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "postgres";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "anon";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_group"("p_name" "text", "p_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_group"("p_name" "text", "p_type" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."create_group"("p_name" "text", "p_type" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "postgres";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "anon";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."decline_group_invite"("p_invite_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."decline_group_invite"("p_invite_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."decline_group_invite"("p_invite_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."delete_group"("p_group_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_group"("p_group_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."delete_group"("p_group_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."ensure_group_owner_member"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ensure_group_owner_member"() TO "service_role";



GRANT ALL ON FUNCTION "public"."events_set_defaults"() TO "anon";
GRANT ALL ON FUNCTION "public"."events_set_defaults"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."events_set_defaults"() TO "service_role";



GRANT ALL ON FUNCTION "public"."events_set_time_range"() TO "anon";
GRANT ALL ON FUNCTION "public"."events_set_time_range"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."events_set_time_range"() TO "service_role";



GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "postgres";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "anon";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "service_role";



GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_event_responses"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_event_responses"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_event_responses"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_id_by_email"("p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_id_by_email"("p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."gi_fill_email"() TO "anon";
GRANT ALL ON FUNCTION "public"."gi_fill_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."gi_fill_email"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user_profile"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "postgres";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "service_role";



GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "postgres";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "postgres";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "anon";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "service_role";



REVOKE ALL ON FUNCTION "public"."invite_to_group"("p_group_id" "uuid", "p_email" "text", "p_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."invite_to_group"("p_group_id" "uuid", "p_email" "text", "p_role" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."invite_to_group"("p_group_id" "uuid", "p_email" "text", "p_role" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_group_admin"("p_group_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_group_admin"("p_group_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."is_group_admin"("p_group_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_group_admin"("p_group_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_group_admin"("p_group_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_group_admin"("p_group_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_group_admin_or_owner"("p_group_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_group_admin_or_owner"("p_group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_group_admin_or_owner"("p_group_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_group_manager"("p_group_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_group_manager"("p_group_id" "uuid", "p_user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."is_group_manager"("p_group_id" "uuid", "p_user_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_group_member"("p_group_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_group_member"("p_group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_group_member"("p_group_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_group_member"("p_group_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_group_member"("p_group_id" "uuid", "p_user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."is_group_member"("p_group_id" "uuid", "p_user_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_group_owner"("p_group_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_group_owner"("p_group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_group_owner"("p_group_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_member_of_group"("target_group_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_member_of_group"("target_group_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."is_member_of_group"("target_group_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."jwt_email"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."jwt_email"() TO "service_role";
GRANT ALL ON FUNCTION "public"."jwt_email"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."leave_group"("p_group_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."leave_group"("p_group_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."leave_group"("p_group_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."my_email"() TO "anon";
GRANT ALL ON FUNCTION "public"."my_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_email"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_conflict_on_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_conflict_on_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_conflict_on_event"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_conflicts_for_event"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."notify_conflicts_for_event"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_conflicts_for_event"("p_event_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_event_created"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_event_created"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_event_deleted"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_event_deleted"() TO "service_role";



GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "postgres";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "anon";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."event_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."event_responses" TO "service_role";



GRANT ALL ON FUNCTION "public"."respond_to_event"("p_event_id" "uuid", "p_response_status" "text", "p_comment" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."respond_to_event"("p_event_id" "uuid", "p_response_status" "text", "p_comment" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."respond_to_event"("p_event_id" "uuid", "p_response_status" "text", "p_comment" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_current_timestamp_user_notif"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_current_timestamp_user_notif"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_current_timestamp_user_notif"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_group_message_author"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_group_message_author"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_event_responses_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_event_responses_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_event_responses_set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_events_conflict_notify"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_events_conflict_notify"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "service_role";


















GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."conflict_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."conflict_preferences" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."conflict_resolutions" TO "authenticated";
GRANT ALL ON TABLE "public"."conflict_resolutions" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."conflict_resolutions_log" TO "authenticated";
GRANT ALL ON TABLE "public"."conflict_resolutions_log" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."connected_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."connected_accounts" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT SELECT,INSERT,MAINTAIN ON TABLE "public"."events_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."events_analytics" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."external_busy_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."external_busy_blocks" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."external_calendar_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."external_calendar_settings" TO "service_role";



GRANT ALL ON TABLE "public"."external_events" TO "service_role";
GRANT SELECT ON TABLE "public"."external_events" TO "authenticated";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."google_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."google_accounts" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."group_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."group_invites" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."group_members" TO "authenticated";
GRANT ALL ON TABLE "public"."group_members" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."group_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."group_messages" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."group_notification_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."group_notification_settings" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."groups" TO "authenticated";
GRANT ALL ON TABLE "public"."groups" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."proposal_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_responses" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."public_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."public_invites" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."user_notification_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_notification_settings" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































