-- Private delivery ledger. Browser roles cannot read recipient data or alter
-- delivery state. Tokens remain hashed in commune_invites; payloads use a
-- placeholder, replaced only in memory after the supplied token is verified.
BEGIN;
CREATE TABLE public.invitation_email_deliveries (
  invite_id uuid PRIMARY KEY REFERENCES public.commune_invites(id) ON DELETE CASCADE,
  commune_id uuid NOT NULL REFERENCES public.communes(id) ON DELETE CASCADE,
  sender_id text NOT NULL,
  recipient_email text NOT NULL,
  status text NOT NULL CHECK (status IN ('sending', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts BETWEEN 1 AND 5),
  payload jsonb NOT NULL,
  provider_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invitation_email_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invitation_email_deliveries FROM PUBLIC, authenticated;
CREATE INDEX invitation_email_sender_idx ON public.invitation_email_deliveries(sender_id, created_at);
CREATE INDEX invitation_email_commune_idx ON public.invitation_email_deliveries(commune_id, created_at);
CREATE INDEX invitation_email_recipient_idx ON public.invitation_email_deliveries(recipient_email, created_at);
COMMIT;
