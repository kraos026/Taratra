-- Manual privacy workflow; no operator is granted by this migration.
ALTER TABLE public.privacy_requests
  ADD COLUMN revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0);

CREATE TABLE private.privacy_request_operators (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 5 AND 500),
  CHECK (expires_at > granted_at)
);
CREATE TABLE private.privacy_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.privacy_requests(id) ON DELETE RESTRICT,
  operator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  from_status text NOT NULL CHECK (from_status IN ('RECEIVED','IN_REVIEW','NEEDS_INFORMATION')),
  to_status text NOT NULL CHECK (to_status IN ('IN_REVIEW','NEEDS_INFORMATION','COMPLETED','DECLINED')),
  response text NOT NULL CHECK (char_length(btrim(response)) BETWEEN 5 AND 2000),
  revision integer NOT NULL CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, revision)
);
ALTER TABLE private.privacy_request_operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.privacy_request_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.privacy_request_operators, private.privacy_request_events
  FROM PUBLIC, anon, authenticated, service_role;
-- Preserve existing self-service column grants. No client may update a status,
-- response, revision, operator grant or history, even if it owns the request.
