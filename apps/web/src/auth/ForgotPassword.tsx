import { Link } from "wouter";
import { AuthLayout } from "./AuthLayout";
import { keepSearch } from "../nav";

export function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <div className="commune-auth-panel">
        <h2>Reset your password</h2>
        <p className="commune-auth-lede">
          Password reset email is not configured in this local build. No message
          will be sent. Keep your test password safe while we connect verified
          email delivery before public deployment.
        </p>
        <Link href={keepSearch("/login")} className="commune-auth-btn">
          Back to sign in
        </Link>
      </div>
    </AuthLayout>
  );
}
