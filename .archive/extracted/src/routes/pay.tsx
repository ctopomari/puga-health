import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/pay")({
  validateSearch: (search: Record<string, unknown>) => ({
    tx: typeof search.tx === "string" ? search.tx : "",
  }),
  component: Pay,
});

function Pay() {
  const { tx } = Route.useSearch();
  const [status, setStatus] = useState<"ready" | "busy" | "paid" | "error">("ready");
  const [message, setMessage] = useState("");

  const confirm = async () => {
    if (!tx) return;
    setStatus("busy");
    try {
      const response = await fetch("/api/v1/payments/complete", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("pugaai-access-token") || ""}`,
        },
        body: JSON.stringify({ transaction_id: tx }),
      });
      if (!response.ok) throw new Error("Payment could not be confirmed.");
      setStatus("paid");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Payment could not be confirmed.");
    }
  };

  return (
    <main className="min-h-screen bg-puga-soft px-5 py-16 text-puga-ink">
      <div className="mx-auto max-w-md rounded-3xl border border-[#e8e1ec] bg-white p-7">
        <p className="text-[10px] font-black tracking-[0.18em] text-puga-purple">PUGAPAY</p>
        <h1 className="mt-2 text-2xl font-semibold">Secure checkout handoff</h1>
        <p className="mt-3 text-sm leading-relaxed text-puga-muted">
          PugaAI Health never collects card PIN, OTP, password or wallet credentials. Confirm only if you intend to complete this healthcare payment through PugaPay.
        </p>
        <p className="mt-3 text-xs text-puga-muted">Reference {tx || "unavailable"}</p>
        {status === "paid" ? (
          <p className="mt-5 rounded-xl bg-[#f1faf5] p-3 text-sm text-[#24734e]">Payment marked as paid. You can return to PugaAI Health.</p>
        ) : (
          <button type="button" onClick={confirm} disabled={!tx || status === "busy"} className="mt-6 w-full rounded-xl bg-puga-purple px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {status === "busy" ? "Confirming…" : "Confirm payment"}
          </button>
        )}
        {message ? <p className="mt-3 text-sm text-[#b73b3b]">{message}</p> : null}
        <Link to="/" className="mt-6 inline-block text-sm font-semibold text-puga-purple">
          Return to PugaAI Health
        </Link>
      </div>
    </main>
  );
}
