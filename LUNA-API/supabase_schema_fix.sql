-- Idempotent Supabase schema alignment for the LUNA API and Expo app.
-- Back up public.users, public.departments, and public.resources before applying.
BEGIN;

CREATE TABLE IF NOT EXISTS public.departments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    icon text,
    sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE public.departments
    ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS name text,
    ADD COLUMN IF NOT EXISTS icon text,
    ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

UPDATE public.departments
SET id = gen_random_uuid()
WHERE id IS NULL;
UPDATE public.departments
SET name = 'Department'
WHERE name IS NULL OR btrim(name) = '';
UPDATE public.departments
SET sort_order = 0
WHERE sort_order IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS departments_id_uidx ON public.departments (id);
ALTER TABLE public.departments
    ALTER COLUMN id SET NOT NULL,
    ALTER COLUMN id SET DEFAULT gen_random_uuid(),
    ALTER COLUMN name SET NOT NULL,
    ALTER COLUMN sort_order SET DEFAULT 0,
    ALTER COLUMN sort_order SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.users (
    employee_id text PRIMARY KEY,
    name text NOT NULL,
    password_hash text,
    role text NOT NULL DEFAULT 'User',
    department text,
    active boolean NOT NULL DEFAULT true,
    email text,
    phone text,
    favorite_departments jsonb NOT NULL DEFAULT '[]'::jsonb,
    workspace_layout jsonb NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS employee_id text,
    ADD COLUMN IF NOT EXISTS name text,
    ADD COLUMN IF NOT EXISTS password_hash text,
    ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'User',
    ADD COLUMN IF NOT EXISTS department text,
    ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS email text,
    ADD COLUMN IF NOT EXISTS phone text,
    ADD COLUMN IF NOT EXISTS favorite_departments jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS workspace_layout jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.users
SET role = CASE lower(btrim(role))
        WHEN 'admin' THEN 'Admin'
        WHEN 'manager' THEN 'Manager'
        WHEN 'supervisor' THEN 'Supervisor'
        WHEN 'user' THEN 'User'
        WHEN 'staff' THEN 'User'
        WHEN 'employee' THEN 'User'
        ELSE 'User'
    END
WHERE role IS NULL
    OR role NOT IN ('Admin', 'Manager', 'Supervisor', 'User');

UPDATE public.users
SET name = COALESCE(NULLIF(btrim(name), ''), NULLIF(btrim(employee_id), ''), 'Employee')
WHERE name IS NULL OR btrim(name) = '';
UPDATE public.users
SET active = true
WHERE active IS NULL;
UPDATE public.users
SET favorite_departments = '[]'::jsonb
WHERE favorite_departments IS NULL;
UPDATE public.users
SET workspace_layout = '[]'::jsonb
WHERE workspace_layout IS NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.users
        WHERE employee_id IS NULL OR btrim(employee_id) = ''
    ) THEN
        RAISE EXCEPTION 'public.users has a missing employee_id; repair these records before applying the LUNA schema migration';
    END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS users_employee_id_uidx ON public.users (employee_id);

ALTER TABLE public.users
    ALTER COLUMN employee_id SET NOT NULL,
    ALTER COLUMN name SET NOT NULL,
    ALTER COLUMN role SET DEFAULT 'User',
    ALTER COLUMN role SET NOT NULL,
    ALTER COLUMN active SET DEFAULT true,
    ALTER COLUMN active SET NOT NULL,
    ALTER COLUMN favorite_departments SET DEFAULT '[]'::jsonb,
    ALTER COLUMN favorite_departments SET NOT NULL,
    ALTER COLUMN workspace_layout SET DEFAULT '[]'::jsonb,
    ALTER COLUMN workspace_layout SET NOT NULL;

ALTER TABLE public.users
    DROP CONSTRAINT IF EXISTS users_role_check,
    ADD CONSTRAINT users_role_check
        CHECK (role IN ('Admin', 'Manager', 'Supervisor', 'User'))
        NOT VALID;
ALTER TABLE public.users VALIDATE CONSTRAINT users_role_check;

INSERT INTO public.departments (name, icon, sort_order)
SELECT seeded.name, seeded.icon, seeded.sort_order
FROM (VALUES
    ('Automation', 'cpu', 1),
    ('Hiwin', 'factory', 2),
    ('Cutting', 'scissors', 3),
    ('Machining', 'cog', 4),
    ('Packing', 'package', 5),
    ('RFD', 'truck', 6),
    ('Invoice', 'receipt', 7),
    ('Dispatch', 'send', 8)
) AS seeded(name, icon, sort_order)
WHERE NOT EXISTS (
    SELECT 1
    FROM public.departments AS existing
    WHERE lower(btrim(existing.name)) = lower(btrim(seeded.name))
);

UPDATE public.departments
SET sort_order = CASE name
        WHEN 'Automation' THEN 1
        WHEN 'Hiwin' THEN 2
        WHEN 'Cutting' THEN 3
        WHEN 'Machining' THEN 4
        WHEN 'Packing' THEN 5
        WHEN 'RFD' THEN 6
        WHEN 'Invoice' THEN 7
        WHEN 'Dispatch' THEN 8
        ELSE sort_order
    END
WHERE name IN ('Automation', 'Hiwin', 'Cutting', 'Machining', 'Packing', 'RFD', 'Invoice', 'Dispatch')
    AND sort_order IS DISTINCT FROM CASE name
        WHEN 'Automation' THEN 1
        WHEN 'Hiwin' THEN 2
        WHEN 'Cutting' THEN 3
        WHEN 'Machining' THEN 4
        WHEN 'Packing' THEN 5
        WHEN 'RFD' THEN 6
        WHEN 'Invoice' THEN 7
        WHEN 'Dispatch' THEN 8
        ELSE sort_order
    END;

CREATE TABLE IF NOT EXISTS public.resources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    type text,
    url text,
    icon text,
    department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
    viewing_level text NOT NULL DEFAULT 'User'
);

ALTER TABLE public.resources
    ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS title text,
    ADD COLUMN IF NOT EXISTS description text,
    ADD COLUMN IF NOT EXISTS type text,
    ADD COLUMN IF NOT EXISTS url text,
    ADD COLUMN IF NOT EXISTS icon text,
    ADD COLUMN IF NOT EXISTS department_id uuid,
    ADD COLUMN IF NOT EXISTS viewing_level text NOT NULL DEFAULT 'User';

UPDATE public.resources
SET id = gen_random_uuid()
WHERE id IS NULL;
UPDATE public.resources
SET title = 'Untitled resource'
WHERE title IS NULL OR btrim(title) = '';

CREATE UNIQUE INDEX IF NOT EXISTS resources_id_uidx ON public.resources (id);
ALTER TABLE public.resources
    ALTER COLUMN id SET NOT NULL,
    ALTER COLUMN id SET DEFAULT gen_random_uuid(),
    ALTER COLUMN title SET NOT NULL;

UPDATE public.resources
SET viewing_level = CASE lower(btrim(viewing_level))
        WHEN 'admin' THEN 'Admin'
        WHEN 'manager' THEN 'Manager'
        WHEN 'supervisor' THEN 'Supervisor'
        WHEN 'user' THEN 'User'
        WHEN 'staff' THEN 'User'
        WHEN 'employee' THEN 'User'
        ELSE 'User'
    END
WHERE viewing_level IS NULL
    OR viewing_level NOT IN ('Admin', 'Manager', 'Supervisor', 'User');

ALTER TABLE public.resources
    ALTER COLUMN department_id DROP NOT NULL,
    ALTER COLUMN viewing_level SET DEFAULT 'User',
    ALTER COLUMN viewing_level SET NOT NULL;

-- Clear stale links first so a valid legacy department name can be backfilled.
UPDATE public.resources AS resource
SET department_id = NULL
WHERE resource.department_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM public.departments AS department
        WHERE department.id = resource.department_id
    );

-- Migrate legacy text department assignments to the canonical department UUID.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'resources'
            AND column_name = 'department'
            AND data_type IN ('text', 'character varying', 'character')
    ) THEN
        EXECUTE '
            UPDATE public.resources AS resource
            SET department_id = department.id
            FROM public.departments AS department
            WHERE resource.department_id IS NULL
                AND lower(btrim(resource.department)) = lower(btrim(department.name))
                AND lower(btrim(resource.department)) <> ''global''
        ';
    END IF;
END $$;

-- These are system-wide modules, never department workspace resources.
UPDATE public.resources
SET department_id = NULL
WHERE lower(btrim(title)) IN (
        'system audit',
        'task manager',
        'daily production summary',
        'user access matrix'
    )
    AND department_id IS NOT NULL;

UPDATE public.resources
SET department_id = NULL
WHERE department_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM public.departments
        WHERE departments.id = resources.department_id
    );

ALTER TABLE public.resources
    DROP CONSTRAINT IF EXISTS resources_department_id_fkey,
    ADD CONSTRAINT resources_department_id_fkey
        FOREIGN KEY (department_id)
        REFERENCES public.departments(id)
        ON DELETE SET NULL
        NOT VALID;

ALTER TABLE public.resources
    DROP CONSTRAINT IF EXISTS resources_viewing_level_check,
    ADD CONSTRAINT resources_viewing_level_check
        CHECK (viewing_level IN ('Admin', 'Manager', 'Supervisor', 'User'))
        NOT VALID;

ALTER TABLE public.resources VALIDATE CONSTRAINT resources_department_id_fkey;
ALTER TABLE public.resources VALIDATE CONSTRAINT resources_viewing_level_check;

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    employee_id text PRIMARY KEY REFERENCES public.users(employee_id) ON DELETE CASCADE,
    token_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    requested_at timestamptz NOT NULL,
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);

ALTER TABLE public.password_reset_tokens
    ADD COLUMN IF NOT EXISTS employee_id text,
    ADD COLUMN IF NOT EXISTS token_hash text,
    ADD COLUMN IF NOT EXISTS expires_at timestamptz,
    ADD COLUMN IF NOT EXISTS requested_at timestamptz DEFAULT now(),
    ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
UPDATE public.password_reset_tokens
SET token_hash = ''
WHERE token_hash IS NULL;
UPDATE public.password_reset_tokens
SET expires_at = now()
WHERE expires_at IS NULL;
UPDATE public.password_reset_tokens
SET requested_at = now()
WHERE requested_at IS NULL;
UPDATE public.password_reset_tokens
SET attempts = 0
WHERE attempts IS NULL;
UPDATE public.password_reset_tokens
SET attempts = 0
WHERE attempts < 0;
DELETE FROM public.password_reset_tokens AS reset_token
WHERE NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.employee_id = reset_token.employee_id
);
ALTER TABLE public.password_reset_tokens
    ALTER COLUMN employee_id SET NOT NULL,
    ALTER COLUMN token_hash SET NOT NULL,
    ALTER COLUMN expires_at SET NOT NULL,
    ALTER COLUMN requested_at SET DEFAULT now(),
    ALTER COLUMN requested_at SET NOT NULL,
    ALTER COLUMN attempts SET DEFAULT 0,
    ALTER COLUMN attempts SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS password_reset_tokens_employee_id_uidx
    ON public.password_reset_tokens (employee_id);
ALTER TABLE public.password_reset_tokens
    DROP CONSTRAINT IF EXISTS password_reset_tokens_attempts_check,
    ADD CONSTRAINT password_reset_tokens_attempts_check
        CHECK (attempts >= 0)
        NOT VALID;
ALTER TABLE public.password_reset_tokens
    VALIDATE CONSTRAINT password_reset_tokens_attempts_check;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'password_reset_tokens_employee_id_fkey'
            AND conrelid = 'public.password_reset_tokens'::regclass
    ) THEN
        ALTER TABLE public.password_reset_tokens
        ADD CONSTRAINT password_reset_tokens_employee_id_fkey
        FOREIGN KEY (employee_id)
        REFERENCES public.users(employee_id)
        ON DELETE CASCADE
        NOT VALID;
    END IF;
END $$;
ALTER TABLE public.password_reset_tokens
    VALIDATE CONSTRAINT password_reset_tokens_employee_id_fkey;

CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message text NOT NULL CHECK (length(trim(message)) > 0),
    target_role_level text NOT NULL CHECK (
        target_role_level IN ('User', 'Supervisor', 'Manager', 'Admin')
    ),
    created_at timestamptz NOT NULL DEFAULT now(),
    is_read boolean NOT NULL DEFAULT false
);

ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS message text,
    ADD COLUMN IF NOT EXISTS target_role_level text NOT NULL DEFAULT 'User',
    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false;

UPDATE public.notifications
SET id = gen_random_uuid()
WHERE id IS NULL;
UPDATE public.notifications
SET message = 'Notification message unavailable'
WHERE message IS NULL OR btrim(message) = '';
UPDATE public.notifications
SET created_at = now()
WHERE created_at IS NULL;
UPDATE public.notifications
SET is_read = false
WHERE is_read IS NULL;

UPDATE public.notifications
SET target_role_level = CASE lower(btrim(target_role_level))
        WHEN 'admin' THEN 'Admin'
        WHEN 'manager' THEN 'Manager'
        WHEN 'supervisor' THEN 'Supervisor'
        WHEN 'user' THEN 'User'
        ELSE 'User'
    END
WHERE target_role_level IS NULL
    OR target_role_level NOT IN ('Admin', 'Manager', 'Supervisor', 'User');

ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_target_role_level_check,
    ADD CONSTRAINT notifications_target_role_level_check
        CHECK (target_role_level IN ('User', 'Supervisor', 'Manager', 'Admin'))
        NOT VALID;
ALTER TABLE public.notifications VALIDATE CONSTRAINT notifications_target_role_level_check;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_id_uidx ON public.notifications (id);
ALTER TABLE public.notifications
    ALTER COLUMN id SET NOT NULL,
    ALTER COLUMN id SET DEFAULT gen_random_uuid(),
    ALTER COLUMN message SET NOT NULL,
    ALTER COLUMN target_role_level SET NOT NULL,
    ALTER COLUMN created_at SET DEFAULT now(),
    ALTER COLUMN created_at SET NOT NULL,
    ALTER COLUMN is_read SET DEFAULT false,
    ALTER COLUMN is_read SET NOT NULL;
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications (created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_push_tokens (
    employee_id text NOT NULL REFERENCES public.users(employee_id) ON DELETE CASCADE,
    expo_push_token text PRIMARY KEY,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_push_tokens_expo_token_format CHECK (
        expo_push_token ~ '^(Expo|Exponent)PushToken\[[^]]+\]$'
    )
);

ALTER TABLE public.user_push_tokens
    ADD COLUMN IF NOT EXISTS employee_id text,
    ADD COLUMN IF NOT EXISTS expo_push_token text,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.user_push_tokens
SET updated_at = now()
WHERE updated_at IS NULL;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.user_push_tokens
        WHERE employee_id IS NULL
            OR expo_push_token IS NULL
            OR expo_push_token !~ '^(Expo|Exponent)PushToken\[[^]]+\]$'
    ) THEN
        RAISE EXCEPTION 'public.user_push_tokens contains incomplete or invalid push tokens; repair these rows before applying the LUNA schema migration';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.user_push_tokens AS token
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.users AS portal_user
            WHERE portal_user.employee_id = token.employee_id
        )
    ) THEN
        RAISE EXCEPTION 'public.user_push_tokens contains employee IDs absent from public.users; repair these rows before applying the LUNA schema migration';
    END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS user_push_tokens_expo_token_uidx
    ON public.user_push_tokens (expo_push_token);
ALTER TABLE public.user_push_tokens
    ALTER COLUMN employee_id SET NOT NULL,
    ALTER COLUMN expo_push_token SET NOT NULL,
    ALTER COLUMN updated_at SET DEFAULT now(),
    ALTER COLUMN updated_at SET NOT NULL;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'user_push_tokens_employee_id_fkey'
            AND conrelid = 'public.user_push_tokens'::regclass
    ) THEN
        ALTER TABLE public.user_push_tokens
        ADD CONSTRAINT user_push_tokens_employee_id_fkey
        FOREIGN KEY (employee_id)
        REFERENCES public.users(employee_id)
        ON DELETE CASCADE
        NOT VALID;
    END IF;
END $$;
ALTER TABLE public.user_push_tokens
    VALIDATE CONSTRAINT user_push_tokens_employee_id_fkey;
CREATE INDEX IF NOT EXISTS user_push_tokens_employee_id_idx
    ON public.user_push_tokens (employee_id);
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_employee_id text NOT NULL,
    actor_name text NOT NULL,
    action text NOT NULL,
    target_type text NOT NULL,
    target_id text,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs
    ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS actor_employee_id text,
    ADD COLUMN IF NOT EXISTS actor_name text,
    ADD COLUMN IF NOT EXISTS action text,
    ADD COLUMN IF NOT EXISTS target_type text,
    ADD COLUMN IF NOT EXISTS target_id text,
    ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
UPDATE public.audit_logs
SET id = gen_random_uuid()
WHERE id IS NULL;
UPDATE public.audit_logs
SET actor_employee_id = 'unknown'
WHERE actor_employee_id IS NULL;
UPDATE public.audit_logs
SET actor_name = 'Unknown'
WHERE actor_name IS NULL;
UPDATE public.audit_logs
SET action = 'unknown'
WHERE action IS NULL;
UPDATE public.audit_logs
SET target_type = 'unknown'
WHERE target_type IS NULL;
UPDATE public.audit_logs
SET details = '{}'::jsonb
WHERE details IS NULL;
UPDATE public.audit_logs
SET created_at = now()
WHERE created_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS audit_logs_id_uidx ON public.audit_logs (id);
ALTER TABLE public.audit_logs
    ALTER COLUMN id SET NOT NULL,
    ALTER COLUMN id SET DEFAULT gen_random_uuid(),
    ALTER COLUMN actor_employee_id SET NOT NULL,
    ALTER COLUMN actor_name SET NOT NULL,
    ALTER COLUMN action SET NOT NULL,
    ALTER COLUMN target_type SET NOT NULL,
    ALTER COLUMN details SET DEFAULT '{}'::jsonb,
    ALTER COLUMN details SET NOT NULL,
    ALTER COLUMN created_at SET DEFAULT now(),
    ALTER COLUMN created_at SET NOT NULL;
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs (created_at DESC);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS resources_department_id_idx ON public.resources (department_id);
CREATE INDEX IF NOT EXISTS resources_viewing_level_idx ON public.resources (viewing_level);

NOTIFY pgrst, 'reload schema';
COMMIT;
