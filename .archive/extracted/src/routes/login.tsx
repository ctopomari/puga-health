import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { type FormEvent, useState } from "react";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") {
        const result = await authClient.signUp.email({ email, password, name: email.split("@")[0] || "Patient" });
        if (result.error) throw new Error(result.error.message || "Could not create the account.");
      } else {
        const result = await authClient.signIn.email({ email, password });
        if (result.error) throw new Error(result.error.message || "Could not sign in.");
      }
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-puga-soft px-5 py-12 text-puga-ink">
      <div className="mx-auto w-full max-w-md">
        <Link to="/" className="mb-8 inline-flex items-center gap-3 no-underline">
          <img src="/puga-trinicare-compact.png" alt="Puga TriniCare" className="h-12 w-auto rounded-xl bg-white p-1" />
        </Link>
        <div className="rounded-3xl border border-[#e8e1ec] bg-white p-7 shadow-[0_16px_45px_rgba(52,24,76,0.08)]">
          <p className="text-[10px] font-black tracking-[0.18em] text-puga-purple">PUGAAI HEALTH</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sign in to your Health ID</h1>
          <p className="mt-2 text-sm leading-relaxed text-puga-muted">
            One Puga identity for health information, care navigation and PugaAccess. Voice questions remain available without an account.
          </p>
          {authEnabled ? (
            <>
              <div className="mt-5 grid gap-2">
                {GROK_PROVIDERS.map((provider) => (
                  <button
                    key={provider.providerId}
                    type="button"
                    onClick={() => signIn(provider.providerId, { callbackURL: "/" })}
                    className="w-full rounded-xl border border-[#e8e1ec] bg-white px-4 py-3 text-sm font-semibold hover:bg-puga-soft"
                  >
                    Continue with {provider.label}
                  </button>
                ))}
              </div>
              <p className="my-4 text-center text-[11px] font-bold uppercase tracking-widest text-puga-muted">or email</p>
              <form onSubmit={submit} className="grid gap-3">
                <label className="grid gap-1 text-[11px] font-bold uppercase tracking-wider text-puga-muted">
                  Email
                  <input className="rounded-xl border border-[#e8e1ec] px-3 py-3 text-sm font-normal normal-case tracking-normal text-puga-ink" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </label>
                <label className="grid gap-1 text-[11px] font-bold uppercase tracking-wider text-puga-muted">
                  Password
                  <input className="rounded-xl border border-[#e8e1ec] px-3 py-3 text-sm font-normal normal-case tracking-normal text-puga-ink" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
                </label>
                {error ? <p className="text-sm text-[#b73b3b]">{error}</p> : null}
                <button type="submit" disabled={busy} className="rounded-xl bg-puga-purple px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                  {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
                </button>
                <button type="button" className="text-sm font-semibold text-puga-purple" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
                  {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
                </button>
              </form>
            </>
          ) : (
            <p className="mt-4 text-sm text-puga-muted">Sign-in is disabled.</p>
          )}
        </div>
      </div>
    </main>
  );
}
