-- Run this in the Supabase SQL editor to align the live database with the app.
-- This fixes the missing department field on users and seeds the missing Packing department.
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS department text,
    ADD COLUMN IF NOT EXISTS email text,
    ADD COLUMN IF NOT EXISTS phone text,
    ADD COLUMN IF NOT EXISTS favorite_departments jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS workspace_layout jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    employee_id text PRIMARY KEY,
    token_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    requested_at timestamptz NOT NULL,
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message text NOT NULL CHECK (length(trim(message)) > 0),
    target_role_level text NOT NULL CHECK (
        target_role_level IN ('User', 'Supervisor', 'Manager', 'Admin')
    ),
    created_at timestamptz NOT NULL DEFAULT now(),
    is_read boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications (created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
INSERT INTO public.departments (name, icon, sort_order)
SELECT 'Packing',
    'package',
    5
WHERE NOT EXISTS (
        SELECT 1
        FROM public.departments
        WHERE name = 'Packing'
    );
INSERT INTO public.departments (name, icon, sort_order)
SELECT 'Automation',
    'cpu',
    1
WHERE NOT EXISTS (
        SELECT 1
        FROM public.departments
        WHERE name = 'Automation'
    );
INSERT INTO public.departments (name, icon, sort_order)
SELECT 'Hiwin',
    'factory',
    2
WHERE NOT EXISTS (
        SELECT 1
        FROM public.departments
        WHERE name = 'Hiwin'
    );
INSERT INTO public.departments (name, icon, sort_order)
SELECT 'Cutting',
    'scissors',
    3
WHERE NOT EXISTS (
        SELECT 1
        FROM public.departments
        WHERE name = 'Cutting'
    );
INSERT INTO public.departments (name, icon, sort_order)
SELECT 'Machining',
    'cog',
    4
WHERE NOT EXISTS (
        SELECT 1
        FROM public.departments
        WHERE name = 'Machining'
    );
INSERT INTO public.departments (name, icon, sort_order)
SELECT 'RFD',
    'truck',
    6
WHERE NOT EXISTS (
        SELECT 1
        FROM public.departments
        WHERE name = 'RFD'
    );
INSERT INTO public.departments (name, icon, sort_order)
SELECT 'Invoice',
    'receipt',
    7
WHERE NOT EXISTS (
        SELECT 1
        FROM public.departments
        WHERE name = 'Invoice'
    );
INSERT INTO public.departments (name, icon, sort_order)
SELECT 'Dispatch',
    'send',
    8
WHERE NOT EXISTS (
        SELECT 1
        FROM public.departments
        WHERE name = 'Dispatch'
    );
-- Optional: backfill the existing admin user with the correct department.
UPDATE public.users
SET department = 'Operations'
WHERE employee_id = '11233'
    AND department IS NULL;
-- Normalize department ordering so the UI renders consistently.
UPDATE public.departments
SET sort_order = CASE
        name
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
WHERE name IN (
        'Automation',
        'Hiwin',
        'Cutting',
        'Machining',
        'Packing',
        'RFD',
        'Invoice',
        'Dispatch'
    );