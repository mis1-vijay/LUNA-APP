-- Run this in the Supabase SQL editor to align the live database with the app.
-- This fixes the missing department field on users and seeds the missing Packing department.
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS department text,
    ADD COLUMN IF NOT EXISTS email text,
    ADD COLUMN IF NOT EXISTS phone text;
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