import { Link } from "wouter";
import { AuthLayout } from "./AuthLayout";
import { keepSearch } from "../nav";

export function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <div className="commune-auth-panel">
        <h2>Reset your password</h2>
        <p className="commune-auth-lede">
          Password reset is not connected in this design preview. No email will
          be sent here; account recovery will be available with real sign-in.
        </p>
        <Link href={keepSearch("/login")} className="commune-auth-btn">
          Back to preview
        </Link>
      </div>
    </AuthLayout>
  );
}
