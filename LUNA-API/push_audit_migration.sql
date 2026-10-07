-- Run in the Supabase SQL editor before enabling Expo push notifications and System Audit.
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
    employee_id text NOT NULL REFERENCES public.users(employee_id) ON DELETE CASCADE,
    expo_push_token text PRIMARY KEY,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_push_tokens_expo_token_format CHECK (
        expo_push_token ~ '^(Expo|Exponent)PushToken\[[^]]+\]$'
    )
);

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

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx
    ON public.audit_logs (created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
