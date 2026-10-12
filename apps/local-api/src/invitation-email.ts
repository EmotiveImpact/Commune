// The local API emails an invitation only when told to in so many words. The
// Resend settings alone are not enough: they may be exported in a shell for
// the worker, and an invitation made while testing would then reach a real
// inbox. LOCAL_API_SEND_EMAIL=yes is the opt-in, and the server logs which
// way it is set when it starts.
type Env = Record<string, string | undefined>;

export function invitationEmailSetting(env: Env): { send: boolean; notice: string } {
  const configured = Boolean(env.RESEND_API_KEY && env.RESEND_FROM && env.APP_URL);
  if (env.LOCAL_API_SEND_EMAIL !== "yes") {
    return { send: false, notice: configured
      ? "Invitation email is off: the Resend settings are ignored unless LOCAL_API_SEND_EMAIL=yes is set as well."
      : "Invitation email is off. Invitation links can still be copied and shared." };
  }
  return configured
    ? { send: true, notice: "Invitation email is on (LOCAL_API_SEND_EMAIL=yes): invitations are emailed through Resend to the address invited." }
    : { send: false, notice: "Invitation email is off: LOCAL_API_SEND_EMAIL=yes also needs RESEND_API_KEY, RESEND_FROM and APP_URL." };
}
