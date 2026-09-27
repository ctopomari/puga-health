const SYSTEM_PROMPT = `You are PugaAI Health, the conversational health-information and navigation layer of Puga TriniCare in Nigeria.

Role: Understand → Inform → Navigate → Connect → Assist.
You are NOT a doctor. Never independently diagnose, prescribe, or make irreversible clinical decisions.

Approved knowledge domains: maternal health, child health, immunization, malaria prevention, nutrition, hypertension awareness, diabetes awareness, infectious disease prevention, reproductive and family health education, general preventive health, and health-service navigation.

Style:
- Speak in clear, respectful Nigerian English unless the user writes in Yoruba, Igbo, or Hausa — then reply in that language.
- Avoid unexplained medical jargon.
- Give practical, community-relevant guidance (mosquito nets, antenatal visits, immunization cards, oral rehydration, when to go to a facility).
- Distinguish AI-generated information from professional care.

Safety:
- If the user may be in danger (unconscious, not breathing, severe bleeding, chest pain, stroke signs, convulsions, suicidal intent, labour with heavy bleeding, infant who will not feed), tell them this is urgent and they should seek emergency/professional care immediately. Do not delay with long education.
- Never invent appointments, test results, prescriptions, or that a booking is confirmed unless the system already created it.
- Never ask for passwords, PINs, OTPs, card numbers, or BVN.
- Do not claim access to a full medical record.

When care may be appropriate, offer navigation next steps: find a participating facility, request an appointment, teleconsultation, laboratory, or medication refill through PugaCare/PugaPay — as requests, not completed clinical acts.

Keep replies concise (about 120-180 words) unless the user asks for more detail. End with a one-line reminder that a qualified professional should confirm clinical decisions.`;

export type AiResult = {
  text: string;
  category: string;
  riskLevel: "low" | "urgent";
  careActions: Array<{ label: string; page: string }>;
};

const URGENT =
  /\b(unconscious|not breathing|can't breathe|cannot breathe|chest pain|stroke|seizure|convulsion|severe bleeding|suicide|kill myself|overdose|labour.*(bleed|blood)|won't feed|will not feed)\b/i;

export function classifyCategory(message: string, text: string): string {
  const blob = `${message} ${text}`.toLowerCase();
  if (URGENT.test(blob)) return "safety_escalation";
  if (/(hospital|clinic|doctor|appointment|teleconsult|find care)/i.test(blob)) return "care_navigation";
  if (/(prevent|net|wash|immuni|vaccine)/i.test(blob)) return "prevention";
  if (/(warning|danger sign|when to (go|seek))/i.test(blob)) return "warning_signs";
  if (/(learn|what is|educat)/i.test(blob)) return "health_education";
  return "health_information";
}

export function careActionsFor(message: string, category: string): Array<{ label: string; page: string }> {
  if (category === "safety_escalation") {
    return [{ label: "Urgent help guidance", page: "home" }];
  }
  if (category === "care_navigation" || /(doctor|hospital|book|lab|pharmacy|refill)/i.test(message)) {
    return [
      { label: "Find care", page: "care" },
      { label: "Appointments", page: "appointments" },
    ];
  }
  return [];
}

function fallbackReply(message: string): AiResult {
  const urgent = URGENT.test(message);
  const category = classifyCategory(message, "");
  const text = urgent
    ? "This may be an urgent situation. PugaAI Health is not an emergency service. Please seek immediate professional care or go to the nearest appropriate healthcare facility now. If you can, ask someone nearby to help you get there."
    : `I can share general information related to “${message.slice(0, 120)}”. This is educational guidance only — not a diagnosis or prescription. For malaria, fever, pregnancy danger signs, childhood illness, or blood pressure concerns, a trained clinician should assess you. I can also help you find a participating PugaCare facility, request an appointment, or continue by voice.`;
  return {
    text,
    category: urgent ? "safety_escalation" : category,
    riskLevel: urgent ? "urgent" : "low",
    careActions: careActionsFor(message, urgent ? "safety_escalation" : category),
  };
}

export async function generateHealthReply(input: {
  message: string;
  language?: string;
  history?: Array<{ role: string; content: string }>;
}): Promise<AiResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return fallbackReply(input.message);
  if (URGENT.test(input.message)) return fallbackReply(input.message);

  const history = (input.history || []).slice(-8).map((item) => ({
    role: item.role === "ai" || item.role === "assistant" ? "assistant" : "user",
    content: item.content,
  }));

  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.3,
        max_tokens: 500,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...history,
          {
            role: "user",
            content: `Preferred language: ${input.language || "English (Nigeria)"}\nQuestion: ${input.message}`,
          },
        ],
      }),
    });
    if (!response.ok) return fallbackReply(input.message);
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) return fallbackReply(input.message);
    const category = classifyCategory(input.message, text);
    return {
      text,
      category,
      riskLevel: category === "safety_escalation" ? "urgent" : "low",
      careActions: careActionsFor(input.message, category),
    };
  } catch {
    return fallbackReply(input.message);
  }
}
