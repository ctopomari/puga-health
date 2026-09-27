import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/access/$channel")({ component: AccessChannel });

const COPY: Record<string, { title: string; body: string; step: string }> = {
  ivr: {
    title: "PugaAccess IVR",
    body: "This is the same PugaAI Health service over a voice call. Dial the PugaAccess number from a feature phone when the live telephony gateway is connected.",
    step: "Say your health question after the prompt. N-ATLAS transcribes it into the same PugaAI Health engine.",
  },
  ussd: {
    title: "PugaAccess USSD",
    body: "Menu-based access for feature phones without data. Short-code routing is owned by the PugaAccess gateway.",
    step: "Select Talk to PugaAI Health from the USSD menu. Your Puga Universal Health ID is reused — no second account.",
  },
  sms: {
    title: "PugaAccess SMS",
    body: "Text a health question to the PugaAccess SMS number. Replies stay educational and will escalate urgent symptoms to professional care.",
    step: "Send a short question such as “How can I prevent malaria?” to continue this conversation by SMS.",
  },
  voice: {
    title: "PugaAccess voice path",
    body: "Low-bandwidth voice continuity into PugaAI Health. This demonstration shows the channel bridge, not a separate AI.",
    step: "Return to Talk to PugaAI to continue with microphone capture in this browser.",
  },
};

function AccessChannel() {
  const { channel } = Route.useParams();
  const meta = COPY[channel] || COPY.voice;
  return (
    <main className="min-h-screen bg-puga-soft px-5 py-16 text-puga-ink">
      <div className="mx-auto max-w-lg rounded-3xl border border-[#e8e1ec] bg-white p-7">
        <p className="text-[10px] font-black tracking-[0.18em] text-puga-purple">PUGAACCESS</p>
        <h1 className="mt-2 text-2xl font-semibold">{meta.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-puga-muted">{meta.body}</p>
        <p className="mt-4 rounded-2xl bg-puga-soft p-4 text-sm leading-relaxed">{meta.step}</p>
        <p className="mt-4 text-xs text-puga-muted">PugaAccess is a distribution channel. It does not create a separate PugaAI identity.</p>
        <Link to="/" className="mt-6 inline-block text-sm font-semibold text-puga-purple">
          Return to PugaAI Health
        </Link>
      </div>
    </main>
  );
}
