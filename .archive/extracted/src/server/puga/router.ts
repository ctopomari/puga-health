import { getSql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/verify.server";
import { ApiError, assertRateLimit, bearer, json } from "./http";
import { hashPassword, maskHealthId, newHealthId, newId, newToken, verifyPassword } from "./crypto";
import { generateHealthReply } from "./health-ai";
import { natlasHealth, transcribeAudio } from "./natlas";

type Sql = Awaited<ReturnType<typeof getSql>>;
type Patient = { id: string; email: string | null; display_name: string; health_id: string; language: string };

const NAIC_TARGET = Number(process.env.NAIC_VALIDATION_TARGET || 50);
const ADMIN_SESSION_MS = Number(process.env.NAIC_SESSION_TIMEOUT || 8 * 60 * 60 * 1000);

function mapFamily(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    relationship: row.relationship,
    initials: row.initials,
    healthId: row.health_id,
    authorization: row.access_status,
    authorizationScope: row.access_scope,
    status: row.status,
    nextCare: row.next_care,
  };
}
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    requested: "Request pending",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
    pending: "Payment pending",
    paid: "Paid",
    failed: "Failed",
    cancellation_requested: "Cancellation requested",
    reschedule_requested: "Reschedule requested",
  };
  return map[status] || status;
}

async function audit(sql: Sql, event: { adminId?: string | null; type: string; result: string; requestId?: string; metadata?: unknown }) {
  await sql`
    insert into admin_audit_events (id, admin_id, event_type, request_id, result, metadata)
    values (${newId("aud")}, ${event.adminId || null}, ${event.type}, ${event.requestId || null}, ${event.result}, ${JSON.stringify(event.metadata || {})})
  `;
}

async function seedPatient(sql: Sql, patient: Patient) {
  const existing = await sql`select id from consents where patient_id = ${patient.id} limit 1`;
  if (existing.length) return;
  const consents = [
    ["healthDataAccess", "granted", "Care navigation and authorized service delivery"],
    ["aiPersonalization", "not-granted", "Personalized PugaAI Health support"],
    ["careHandoff", "granted", "Connect you to PugaCare services"],
  ];
  for (const [key, status, purpose] of consents) {
    await sql`insert into consents (id, patient_id, consent_key, status, purpose) values (${newId("cns")}, ${patient.id}, ${key}, ${status}, ${purpose})`;
  }
  const perms = [
    ["PC", "PugaCure · Care access", "Authorized provider workflows may access permitted information for care delivery."],
    ["AI", "PugaAI Health · Protected session", "PugaAI may use minimum necessary information for an explicitly approved protected task."],
    ["PA", "PugaCare · Service navigation", "PugaCare may receive the context needed to continue a patient service workflow."],
  ];
  for (const [icon, name, purpose] of perms) {
    await sql`insert into permissions (id, patient_id, icon, name, purpose, status) values (${newId("prm")}, ${patient.id}, ${icon}, ${name}, ${purpose}, ${"active"})`;
  }
  await sql`insert into family_members (id, patient_id, name, relationship, initials, health_id, access_status, status, next_care)
    values (${newId("fam")}, ${patient.id}, ${"You"}, ${"Self"}, ${"YO"}, ${maskHealthId(patient.health_id)}, ${"owner"}, ${"active"}, ${"No immediate action"})`;
  const notes = [
    ["care", "Welcome to PugaAI Health", "Your Puga Universal Health ID is ready. Talk to PugaAI or find care when you need it.", "appointments"],
    ["security", "Privacy access reviewed", "Your health-information access controls are available in Privacy & access.", "privacy"],
    ["system", "PugaAccess continuity", "You can continue supported journeys through IVR, USSD or SMS.", "access"],
  ];
  for (const [type, title, text, page] of notes) {
    await sql`insert into notifications (id, patient_id, type, title, text, time_label, unread, page)
      values (${newId("ntf")}, ${patient.id}, ${type}, ${title}, ${text}, ${"Just now"}, ${true}, ${page})`;
  }
  await sql`insert into health_journey_events (id, patient_id, title, status, description, date_label, action_json)
    values (${newId("jrn")}, ${patient.id}, ${"Puga Universal Health ID issued"}, ${"completed"}, ${"Your identity identifier is active. It does not expose your medical record by itself."}, ${"Today · Completed"}, ${null})`;
  await sql`insert into health_journey_events (id, patient_id, title, status, description, date_label, action_json)
    values (${newId("jrn")}, ${patient.id}, ${"Talk to PugaAI Health"}, ${"active"}, ${"Ask a health-information question by voice or text."}, ${"Next step"}, ${JSON.stringify({ label: "Open conversation", page: "talk" })})`;
}

async function createSession(sql: Sql, patientId: string): Promise<string> {
  const token = newToken();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await sql`insert into patient_sessions (token, patient_id, expires_at) values (${token}, ${patientId}, ${expires})`;
  return token;
}

async function patientFromRequest(request: Request, sql: Sql): Promise<Patient | null> {
  const token = bearer(request);
  if (token) {
    const rows = await sql<Patient & { expires_at: string }>`
      select p.id, p.email, p.display_name, p.health_id, p.language, s.expires_at
      from patient_sessions s join patients p on p.id = s.patient_id
      where s.token = ${token} limit 1
    `;
    const row = rows[0];
    if (row && new Date(row.expires_at).getTime() > Date.now()) {
      const { expires_at: _e, ...patient } = row;
      return patient;
    }
  }
  try {
    const session = await getSessionUser(token || undefined);
    if (!session?.id) return null;
    const existing = await sql<Patient>`select id, email, display_name, health_id, language from patients where id = ${session.id} limit 1`;
    if (existing[0]) return existing[0];
    const healthId = newHealthId();
    const email = session.email || `${session.id}@puga.health`;
    await sql`insert into patients (id, email, display_name, health_id) values (${session.id}, ${email}, ${"Patient"}, ${healthId})`;
    const created = { id: session.id, email, display_name: "Patient", health_id: healthId, language: "en-NG" };
    await seedPatient(sql, created);
    return created;
  } catch {
    return null;
  }
}

async function requirePatient(request: Request, sql: Sql): Promise<Patient> {
  const patient = await patientFromRequest(request, sql);
  if (!patient) throw new ApiError(401, "UNAUTHENTICATED", "Your session has expired. Please sign in again.");
  return patient;
}

type Admin = { id: string; identifier: string; role: string; status: string };

async function requireAdmin(request: Request, sql: Sql): Promise<Admin> {
  const token = bearer(request);
  if (!token) {
    await audit(sql, { type: "NAIC_ADMIN_ACCESS_DENIED", result: "denied", metadata: { reason: "missing_token" } });
    throw new ApiError(401, "UNAUTHENTICATED", "NAIC administrator authentication is required.");
  }
  const rows = await sql<Admin & { expires_at: string }>`
    select a.id, a.identifier, a.role, a.status, s.expires_at
    from admin_sessions s join admin_users a on a.id = s.admin_id
    where s.token = ${token} limit 1
  `;
  const row = rows[0];
  if (!row || new Date(row.expires_at).getTime() <= Date.now() || row.status !== "active") {
    await audit(sql, { type: "NAIC_ADMIN_ACCESS_DENIED", result: "denied", metadata: { reason: "invalid_session" } });
    throw new ApiError(401, "UNAUTHENTICATED", "NAIC administrator authentication is required.");
  }
  if (row.role !== "naic_admin" && row.role !== "super_admin") {
    await audit(sql, { adminId: row.id, type: "NAIC_ADMIN_ACCESS_DENIED", result: "denied", metadata: { role: row.role } });
    throw new ApiError(403, "FORBIDDEN", "You are not authorized to perform this action.");
  }
  return { id: row.id, identifier: row.identifier, role: row.role, status: row.status };
}

async function registerPatient(sql: Sql, identifier: string, password: string) {
  const email = identifier.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new ApiError(422, "VALIDATION_ERROR", "Enter a valid email address.");
  if (password.length < 8) throw new ApiError(422, "VALIDATION_ERROR", "Password must be at least 8 characters.");
  const exists = await sql`select id from patients where email = ${email} limit 1`;
  if (exists.length) throw new ApiError(409, "CONFLICT", "An account with this email already exists. Sign in instead.");
  const id = newId("pat");
  const healthId = newHealthId();
  const hash = await hashPassword(password);
  await sql`insert into patients (id, email, password_hash, display_name, health_id) values (${id}, ${email}, ${hash}, ${email.split("@")[0]}, ${healthId})`;
  const patient = { id, email, display_name: email.split("@")[0], health_id: healthId, language: "en-NG" };
  await seedPatient(sql, patient);
  const token = await createSession(sql, id);
  return { token, patient };
}

async function loginPatient(sql: Sql, identifier: string, password: string) {
  const email = identifier.trim().toLowerCase();
  assertRateLimit(`patient:${email}`);
  const rows = await sql<Patient & { password_hash: string | null }>`
    select id, email, display_name, health_id, language, password_hash from patients where email = ${email} limit 1
  `;
  const row = rows[0];
  if (!row?.password_hash || !(await verifyPassword(password, row.password_hash))) {
    throw new ApiError(401, "UNAUTHENTICATED", "Incorrect email or password.");
  }
  const token = await createSession(sql, row.id);
  return { token, patient: { id: row.id, email: row.email, display_name: row.display_name, health_id: row.health_id, language: row.language } };
}

function pathOf(url: URL): string {
  return url.pathname.replace(/\/+$/, "") || "/";
}

export async function handlePugaApi(request: Request): Promise<Response> {
  const sql = await getSql();
  const url = new URL(request.url);
  const path = pathOf(url);
  const method = request.method.toUpperCase();
  const rest = path.replace(/^\/api\/v1/, "") || "/";

  const readJson = async () => {
    try {
      return (await request.json()) as Record<string, unknown>;
    } catch {
      return {};
    }
  };

  if (method === "GET" && (rest === "/health" || rest === "/natlas/health")) {
    const engine = natlasHealth();
    return json({
      ok: true,
      service: "pugaai-health",
      version: "1.4.2",
      natlas: engine,
      naicTarget: NAIC_TARGET,
    });
  }

  if (method === "POST" && rest === "/auth/register") {
    const body = await readJson();
    const { token, patient } = await registerPatient(sql, String(body.identifier || body.email || ""), String(body.password || body.otp || ""));
    return json({ access_token: token, token, status: "authenticated", user: { id: patient.id, email: patient.email, healthId: maskHealthId(patient.health_id) } });
  }

  if (method === "POST" && rest === "/auth/login") {
    const body = await readJson();
    const { token, patient } = await loginPatient(sql, String(body.identifier || body.email || ""), String(body.password || body.otp || ""));
    return json({ access_token: token, token, status: "authenticated", user: { id: patient.id, email: patient.email, healthId: maskHealthId(patient.health_id) } });
  }

  if (method === "POST" && rest === "/auth/logout") {
    const token = bearer(request);
    if (token) await sql`delete from patient_sessions where token = ${token}`;
    return json({ status: "signed-out" });
  }

  if (method === "POST" && rest === "/admin/auth/login") {
    const body = await readJson();
    const identifier = String(body.identifier || body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    assertRateLimit(`admin:${identifier}`);
    if (!identifier || password.length < 8) throw new ApiError(422, "VALIDATION_ERROR", "Administrator ID and password are required.");
    const existing = await sql<{ id: string; password_hash: string; role: string; status: string; identifier: string }>`
      select id, password_hash, role, status, identifier from admin_users where lower(identifier) = ${identifier} limit 1
    `;
    let admin = existing[0];
    if (!admin) {
      const count = await sql<{ n: number }>`select count(*)::int as n from admin_users`;
      if ((count[0]?.n || 0) > 0) {
        await audit(sql, { type: "ADMIN_LOGIN_FAILURE", result: "denied", metadata: { identifier } });
        throw new ApiError(401, "UNAUTHENTICATED", "Invalid NAIC administrator credentials.");
      }
      const id = newId("adm");
      const hash = await hashPassword(password);
      await sql`insert into admin_users (id, identifier, email, password_hash, role, status, last_login_at)
        values (${id}, ${identifier}, ${identifier}, ${hash}, ${"super_admin"}, ${"active"}, ${new Date().toISOString()})`;
      admin = { id, password_hash: hash, role: "super_admin", status: "active", identifier };
    } else if (admin.status !== "active" || !(await verifyPassword(password, admin.password_hash))) {
      await audit(sql, { adminId: admin.id, type: "ADMIN_LOGIN_FAILURE", result: "denied" });
      throw new ApiError(401, "UNAUTHENTICATED", "Invalid NAIC administrator credentials.");
    }
    const token = newToken();
    const expires = new Date(Date.now() + ADMIN_SESSION_MS).toISOString();
    await sql`insert into admin_sessions (token, admin_id, expires_at) values (${token}, ${admin.id}, ${expires})`;
    await sql`update admin_users set last_login_at = ${new Date().toISOString()} where id = ${admin.id}`;
    await audit(sql, { adminId: admin.id, type: "ADMIN_LOGIN_SUCCESS", result: "ok" });
    return json({ access_token: token, token, status: "authenticated", role: admin.role, user: { id: admin.id, role: admin.role, identifier: admin.identifier } });
  }

  if (method === "POST" && rest === "/admin/auth/logout") {
    const token = bearer(request);
    const admin = token ? await requireAdmin(request, sql).catch(() => null) : null;
    if (token) await sql`delete from admin_sessions where token = ${token}`;
    if (admin) await audit(sql, { adminId: admin.id, type: "ADMIN_LOGOUT", result: "ok" });
    return json({ status: "signed-out" });
  }

  if (method === "GET" && rest === "/health/topics") {
    const topics = await sql<{ id: string; title: string; category: string; summary: string }>`
      select id, title, category, summary from health_topics order by sort_order
    `;
    return json({ topics });
  }

  if (method === "POST" && rest === "/conversations") {
    const body = await readJson();
    const patient = await patientFromRequest(request, sql);
    const id = newId("conv");
    await sql`insert into conversations (id, patient_id, channel, language, status)
      values (${id}, ${patient?.id || null}, ${String(body.channel || "web")}, ${"en-NG"}, ${"active"})`;
    return json({ conversation: { id, status: "active" }, id });
  }

  const convMessage = rest.match(/^\/conversations\/([^/]+)\/messages$/);
  if (method === "POST" && convMessage) {
    const conversationId = decodeURIComponent(convMessage[1]);
    const body = await readJson();
    const patient = await patientFromRequest(request, sql);
    const found = await sql`select id from conversations where id = ${conversationId} limit 1`;
    if (!found.length) throw new ApiError(404, "NOT_FOUND", "Conversation not found.");
    const inputText = String(
      (body.input && typeof body.input === "object" && "text" in body.input ? (body.input as { text?: string }).text : null) ||
        body.message ||
        "",
    ).trim();
    if (!inputText) throw new ApiError(422, "VALIDATION_ERROR", "Enter a health question.");
    const session = (body.session && typeof body.session === "object" ? body.session : {}) as { language?: string; mode?: string };
    const language = String(session.language || body.language || "English (Nigeria)");
    const historyRows = await sql<{ role: string; content: string }>`
      select role, content from messages where conversation_id = ${conversationId} order by created_at desc limit 8
    `;
    const userMsgId = newId("msg");
    await sql`insert into messages (id, conversation_id, role, content, response_status) values (${userMsgId}, ${conversationId}, ${"user"}, ${inputText}, ${"received"})`;
    const reply = await generateHealthReply({
      message: inputText,
      language,
      history: historyRows.reverse(),
    });
    const aiId = newId("msg");
    await sql`insert into messages (id, conversation_id, role, content, safety_json, care_actions_json, response_category, response_status)
      values (${aiId}, ${conversationId}, ${"ai"}, ${reply.text}, ${JSON.stringify({ riskLevel: reply.riskLevel, label: "General information only — clinical decisions should be confirmed by an appropriate healthcare professional." })}, ${JSON.stringify(reply.careActions)}, ${reply.category}, ${"completed"})`;
    await sql`update conversations set title = coalesce(title, ${inputText.slice(0, 64)}), preview = ${inputText.slice(0, 160)}, updated_at = ${new Date().toISOString()}, patient_id = coalesce(patient_id, ${patient?.id || null}) where id = ${conversationId}`;
    if (patient) {
      await sql`insert into health_journey_events (id, patient_id, title, status, description, date_label)
        values (${newId("jrn")}, ${patient.id}, ${"PugaAI Health conversation"}, ${"completed"}, ${"Health-information guidance was provided through a PugaAI Health conversation."}, ${"Today · Completed"})`;
    }
    return json({
      message: { id: aiId, role: "assistant", content: reply.text },
      id: aiId,
      response: { text: reply.text },
      text: reply.text,
      safety: { riskLevel: reply.riskLevel, label: "General information only — clinical decisions should be confirmed by an appropriate healthcare professional.", medicalDisclaimer: true },
      care_actions: reply.careActions,
      response_category: reply.category,
    });
  }

  const convFeedback = rest.match(/^\/conversations\/([^/]+)\/feedback$/);
  if (method === "POST" && convFeedback) {
    const conversationId = decodeURIComponent(convFeedback[1]);
    const body = await readJson();
    const patient = await patientFromRequest(request, sql);
    await sql`insert into message_feedback (id, conversation_id, message_id, patient_id, feedback)
      values (${newId("fb")}, ${conversationId}, ${String(body.message_id || body.messageId || "")}, ${patient?.id || null}, ${String(body.feedback || "")})`;
    return json({ success: true });
  }

  if (method === "POST" && rest === "/voice/transcriptions") {
    const form = await request.formData();
    const audio = form.get("audio") || form.get("file");
    if (!(audio instanceof File) || audio.size < 32) {
      throw new ApiError(422, "VALIDATION_ERROR", "Voice audio is required.");
    }
    const conversationId = String(form.get("conversation_id") || form.get("conversationId") || "");
    const language = String(form.get("language") || "en-NG");
    const patient = await patientFromRequest(request, sql);
    let result;
    try {
      result = await transcribeAudio(audio, language);
    } catch {
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "Voice transcription is temporarily unavailable. Please type your question.");
    }
    if (!result.text) throw new ApiError(422, "VALIDATION_ERROR", "No speech was recognised. Please try again or type your question.");
    const id = newId("asr");
    await sql`insert into transcriptions (id, conversation_id, patient_id, language, transcript, confidence, n_atlas_used, n_atlas_service, n_atlas_request_id)
      values (${id}, ${conversationId || null}, ${patient?.id || null}, ${result.language}, ${result.text}, ${result.confidence}, ${result.nAtlasUsed}, ${result.nAtlasService}, ${result.requestId})`;
    return json({
      transcript: { text: result.text, language: result.language, confidence: result.confidence },
      text: result.text,
      language: result.language,
      confidence: result.confidence,
      n_atlas_used: result.nAtlasUsed,
      nAtlasUsed: result.nAtlasUsed,
      n_atlas_service: result.nAtlasService,
      nAtlasService: result.nAtlasService,
    });
  }

  if (method === "POST" && rest === "/naic/interactions") {
    const body = await readJson();
    const participantId = String(body.participantId || "").trim().slice(0, 64);
    const transcript = String(body.transcript || "").trim().slice(0, 4000);
    const conversationId = body.conversationId ? String(body.conversationId) : null;
    const interactionId = String(body.interactionId || newId("NAI"));
    if (!participantId || !/^P[-_]?[A-Za-z0-9]{1,32}$/i.test(participantId) && participantId.length < 2) {
      throw new ApiError(422, "VALIDATION_ERROR", "A pseudonymous participant code is required.");
    }
    if (!transcript) throw new ApiError(422, "VALIDATION_ERROR", "A transcript is required.");
    const dup = await sql`select id from naic_interactions where interaction_id = ${interactionId} limit 1`;
    if (dup.length) return json({ success: true, duplicate: true, interaction: { interactionId } });

    let sessionId: string | null = body.validationSessionId ? String(body.validationSessionId) : null;
    if (!sessionId) {
      const open = await sql<{ id: string }>`select id from naic_validation_sessions where participant_id = ${participantId} and status = ${"active"} order by started_at desc limit 1`;
      if (open[0]) sessionId = open[0].id;
      else {
        sessionId = newId("VS");
        await sql`insert into naic_validation_sessions (id, participant_id, consent_status, status)
          values (${sessionId}, ${participantId}, ${"CONSENT_GRANTED"}, ${"active"})`;
      }
    }

    const asr = conversationId
      ? await sql<{ n_atlas_used: boolean; n_atlas_service: string | null; n_atlas_request_id: string | null; confidence: number | null }>`
          select n_atlas_used, n_atlas_service, n_atlas_request_id, confidence from transcriptions
          where conversation_id = ${conversationId} order by created_at desc limit 1
        `
      : [];
    const asrRow = asr[0];
    const nAtlasUsed = Boolean(asrRow?.n_atlas_used || body.nAtlasUsed);
    const responseStatus = String(body.responseStatus || (body.status === "failed" ? "failed" : "completed"));
    const validationStatus = String(body.status || "completed");
    const eligible =
      Boolean(participantId) &&
      Boolean(transcript) &&
      nAtlasUsed &&
      validationStatus === "completed" &&
      responseStatus === "completed";

    await sql`insert into naic_interactions (
      id, interaction_id, validation_session_id, participant_id, channel, language,
      n_atlas_used, n_atlas_service, n_atlas_request_id, transcript, asr_confidence,
      conversation_id, message_id, response_category, response_status, validation_status,
      user_feedback, counts_toward_validation, completed_at, created_at
    ) values (
      ${newId("nai")}, ${interactionId}, ${sessionId}, ${participantId}, ${String(body.channel || "web_voice")}, ${String(body.language || "en-NG")},
      ${nAtlasUsed}, ${asrRow?.n_atlas_service || body.nAtlasService || null}, ${asrRow?.n_atlas_request_id || null}, ${transcript}, ${asrRow?.confidence ?? body.confidence ?? null},
      ${conversationId}, ${body.messageId ? String(body.messageId) : null}, ${String(body.responseCategory || "health_information")}, ${responseStatus}, ${validationStatus},
      ${body.feedback ? String(body.feedback) : null}, ${eligible}, ${new Date().toISOString()}, ${String(body.createdAt || new Date().toISOString())}
    )`;
    return json({ success: true, interaction: { interactionId, countsTowardValidation: eligible } });
  }

  if (method === "GET" && rest === "/naic/validation") {
    const admin = await requireAdmin(request, sql);
    await audit(sql, { adminId: admin.id, type: "NAIC_DASHBOARD_VIEW", result: "ok" });
    const rows = await sql<Record<string, unknown>>`
      select interaction_id, participant_id, language, channel, transcript, asr_confidence, conversation_id,
             message_id, response_category, user_feedback, validation_status, n_atlas_used, n_atlas_service,
             counts_toward_validation, created_at, completed_at
      from naic_interactions order by created_at desc limit 200
    `;
    const interactions = rows.map((row) => ({
      interactionId: row.interaction_id,
      participantId: row.participant_id,
      language: row.language,
      channel: row.channel,
      transcript: row.transcript,
      confidence: row.asr_confidence,
      conversationId: row.conversation_id,
      messageId: row.message_id,
      responseCategory: row.response_category,
      feedback: row.user_feedback,
      status: row.validation_status,
      nAtlasUsed: row.n_atlas_used,
      nAtlasService: row.n_atlas_service,
      countsTowardValidation: row.counts_toward_validation,
      createdAt: row.created_at,
    }));
    const completed = interactions.filter((item) => item.status === "completed" && item.countsTowardValidation);
    const languages: Record<string, number> = {};
    const channels: Record<string, number> = {};
    for (const item of interactions) {
      languages[String(item.language)] = (languages[String(item.language)] || 0) + 1;
      channels[String(item.channel)] = (channels[String(item.channel)] || 0) + 1;
    }
    return json({
      interactions,
      records: interactions,
      summary: {
        total: interactions.length,
        completed: completed.length,
        uniqueParticipants: new Set(completed.map((item) => item.participantId)).size,
        target: NAIC_TARGET,
        remaining: Math.max(NAIC_TARGET - completed.length, 0),
        languages,
        channels,
      },
      target: NAIC_TARGET,
    });
  }

  if (method === "GET" && rest === "/naic/interactions/export") {
    const admin = await requireAdmin(request, sql);
    const rows = await sql<Record<string, unknown>>`
      select interaction_id, participant_id, validation_session_id, channel, language, n_atlas_used,
             transcript, asr_confidence, response_category, response_status, validation_status,
             user_feedback, counts_toward_validation, started_at, completed_at
      from naic_interactions order by created_at
    `;
    await audit(sql, { adminId: admin.id, type: "NAIC_EXPORT_CREATED", result: "ok", metadata: { record_count: rows.length } });
    const columns = [
      "interaction_id",
      "participant_id",
      "validation_session_id",
      "started_at",
      "completed_at",
      "channel",
      "language",
      "n_atlas_used",
      "transcript",
      "asr_confidence",
      "response_category",
      "response_status",
      "validation_status",
      "feedback_rating",
      "counts_toward_validation",
    ];
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [
      columns.join(","),
      ...rows.map((row) =>
        [
          row.interaction_id,
          row.participant_id,
          row.validation_session_id,
          row.started_at,
          row.completed_at,
          row.channel,
          row.language,
          row.n_atlas_used,
          row.transcript,
          row.asr_confidence,
          row.response_category,
          row.response_status,
          row.validation_status,
          row.user_feedback,
          row.counts_toward_validation,
        ]
          .map(escape)
          .join(","),
      ),
    ].join("\n");
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="PugaAI_NAIC_Validation_Interactions.csv"',
      },
    });
  }

  if (method === "GET" && rest === "/ai/conversations") {
    const patient = await requirePatient(request, sql);
    const conversations = await sql<{ id: string; title: string | null; preview: string | null; updated_at: string }>`
      select id, title, preview, updated_at from conversations where patient_id = ${patient.id} order by updated_at desc limit 40
    `;
    return json({
      conversations: conversations.map((item) => ({
        id: item.id,
        title: item.title,
        preview: item.preview,
        updatedAt: item.updated_at,
      })),
    });
  }

  if (method === "GET" && rest === "/consent") {
    const patient = await requirePatient(request, sql);
    const rows = await sql<{ consent_key: string; status: string; purpose: string; updated_at: string }>`
      select consent_key, status, purpose, updated_at from consents where patient_id = ${patient.id}
    `;
    const consent: Record<string, { status: string; purpose: string; updatedAt: string }> = {};
    for (const row of rows) consent[row.consent_key] = { status: row.status, purpose: row.purpose, updatedAt: row.updated_at };
    return json({ consent });
  }

  if (method === "PATCH" && rest === "/consent") {
    const patient = await requirePatient(request, sql);
    const body = await readJson();
    const key = String(body.key || "");
    const status = String(body.status || "");
    await sql`update consents set status = ${status}, updated_at = ${new Date().toISOString()} where patient_id = ${patient.id} and consent_key = ${key}`;
    return json({ success: true, key, status, updated_at: "Just now" });
  }

  if (method === "GET" && (rest === "/me/health-id" || rest === "/me")) {
    const patient = await requirePatient(request, sql);
    return json({
      healthId: maskHealthId(patient.health_id),
      health_id: { healthId: maskHealthId(patient.health_id), cardStatus: "active", qrAvailable: true },
      cardStatus: "active",
      qrAvailable: true,
      verified: true,
      displayName: patient.display_name,
    });
  }

  if (method === "GET" && rest === "/care/facilities") {
    const q = url.searchParams.get("query")?.toLowerCase() || "";
    const service = url.searchParams.get("service") || "";
    const rows = await sql<{ id: string; name: string; location: string; distance: string | null; services_json: string; availability: string | null; initials: string | null }>`
      select id, name, location, distance, services_json, availability, initials from facilities
    `;
    const facilities = rows
      .map((row) => ({
        id: row.id,
        name: row.name,
        location: row.location,
        distance: row.distance,
        services: parseJson<string[]>(row.services_json, []),
        availability: row.availability,
        initials: row.initials,
      }))
      .filter((facility) => !q || `${facility.name} ${facility.location} ${facility.services.join(" ")}`.toLowerCase().includes(q))
      .filter((facility) => !service || facility.services.includes(service));
    return json({ facilities });
  }

  if (method === "GET" && rest === "/care/providers") {
    const facilityId = url.searchParams.get("facility_id") || "";
    const service = url.searchParams.get("service") || "";
    const rows = await sql<{ id: string; facility_id: string | null; name: string; specialty: string; mode: string; next_slot: string | null }>`
      select id, facility_id, name, specialty, mode, next_slot from providers
    `;
    const providers = rows
      .filter((row) => !facilityId || row.facility_id === facilityId)
      .map((row) => ({
        id: row.id,
        name: row.name,
        specialty: service || row.specialty,
        facilityId: row.facility_id,
        mode: row.mode,
        nextSlot: row.next_slot,
      }));
    return json({ providers });
  }

  if (method === "GET" && rest === "/care/appointments") {
    const patient = await requirePatient(request, sql);
    const rows = await sql<Record<string, unknown>>`
      select a.*, f.name as facility_name, p.name as provider_name
      from appointments a
      left join facilities f on f.id = a.facility_id
      left join providers p on p.id = a.provider_id
      where a.patient_id = ${patient.id}
      order by a.created_at desc
    `;
    return json({
      appointments: rows.map((row) => ({
        id: row.id,
        service: row.service,
        provider: row.provider_name || "Participating provider",
        facility: row.facility_name || "Participating facility",
        dateLabel: row.date_label || "Upcoming",
        time: row.time_label || "",
        mode: row.mode,
        status: row.status,
        statusLabel: statusLabel(String(row.status)),
        reference: row.reference,
      })),
    });
  }

  if (method === "POST" && rest === "/care/appointments") {
    const patient = await requirePatient(request, sql);
    const body = await readJson();
    const id = newId("appt");
    const reference = `PGA-${Math.floor(1000 + Math.random() * 9000)}`;
    await sql`insert into appointments (id, patient_id, facility_id, provider_id, service, mode, preferred_time, context, status, reference, date_label, time_label)
      values (${id}, ${patient.id}, ${body.facility_id ? String(body.facility_id) : null}, ${body.provider_id ? String(body.provider_id) : null}, ${String(body.service || "General consultation")}, ${String(body.mode || "In-person")}, ${String(body.preferred_time || "")}, ${String(body.context || "")}, ${"requested"}, ${reference}, ${"Upcoming"}, ${String(body.preferred_time || "")})`;
    await sql`insert into health_journey_events (id, patient_id, title, status, description, date_label, action_json)
      values (${newId("jrn")}, ${patient.id}, ${"Appointment requested"}, ${"active"}, ${"A care appointment request was submitted to PugaCare."}, ${"Next step"}, ${JSON.stringify({ label: "View appointments", page: "appointments" })})`;
    await sql`insert into notifications (id, patient_id, type, title, text, time_label, unread, page)
      values (${newId("ntf")}, ${patient.id}, ${"care"}, ${"Appointment request received"}, ${"Your appointment request is pending confirmation by the facility."}, ${"Just now"}, ${true}, ${"appointments"})`;
    return json({ appointment: { id, status: "requested", reference }, id });
  }

  const apptPatch = rest.match(/^\/care\/appointments\/([^/]+)$/);
  if (method === "PATCH" && apptPatch) {
    const patient = await requirePatient(request, sql);
    const appointmentId = decodeURIComponent(apptPatch[1]);
    const body = await readJson();
    const action = String(body.action || "");
    const status = action === "cancel" ? "cancellation_requested" : "reschedule_requested";
    const updated = await sql`update appointments set status = ${status}, preferred_time = coalesce(${String(body.preferred_time || "")}, preferred_time), updated_at = ${new Date().toISOString()}
      where id = ${appointmentId} and patient_id = ${patient.id} returning id, status`;
    if (!updated.length) throw new ApiError(404, "NOT_FOUND", "Appointment not found.");
    return json({ appointment: { id: appointmentId, status, action, preferredTime: body.preferred_time } });
  }

  const tele = rest.match(/^\/care\/appointments\/([^/]+)\/teleconsultation$/);
  if (method === "POST" && tele) {
    const patient = await requirePatient(request, sql);
    const appointmentId = decodeURIComponent(tele[1]);
    const owned = await sql`select id from appointments where id = ${appointmentId} and patient_id = ${patient.id} limit 1`;
    if (!owned.length) throw new ApiError(404, "NOT_FOUND", "Appointment not found.");
    const sessionId = newId("tel");
    await sql`insert into teleconsult_sessions (id, appointment_id, patient_id, status) values (${sessionId}, ${appointmentId}, ${patient.id}, ${"ready"})`;
    await sql`update appointments set status = ${"confirmed"} where id = ${appointmentId} and patient_id = ${patient.id}`;
    return json({ session: { sessionId, appointmentId, status: "ready" } });
  }

  if (method === "GET" && rest === "/care/laboratory/services") {
    const rows = await sql<{ id: string; name: string; description: string; facility: string | null; facility_id: string | null; turnaround: string | null }>`
      select id, name, description, facility, facility_id, turnaround from laboratory_services
    `;
    return json({
      services: rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        facility: row.facility,
        facilityId: row.facility_id,
        turnaround: row.turnaround,
      })),
    });
  }

  if (method === "POST" && rest === "/care/laboratory/requests") {
    const patient = await requirePatient(request, sql);
    const body = await readJson();
    const id = newId("lab");
    await sql`insert into laboratory_requests (id, patient_id, service_id, service_name, facility_id, status)
      values (${id}, ${patient.id}, ${String(body.service_id || "")}, ${String(body.service_name || "Laboratory service")}, ${body.facility_id ? String(body.facility_id) : null}, ${"requested"})`;
    const amount = 4500;
    await sql`insert into payments (id, patient_id, type, service, provider, status, reference, service_amount, platform_fee, amount, date_label)
      values (${newId("pay")}, ${patient.id}, ${"service"}, ${String(body.service_name || "Laboratory service")}, ${"Participating laboratory"}, ${"pending"}, ${`PAY-${Math.floor(1000 + Math.random() * 9000)}`}, ${amount}, ${200}, ${amount + 200}, ${"Today"})`;
    return json({ request: { id, status: "requested" }, id });
  }

  if (method === "GET" && rest === "/care/medications/services") {
    const rows = await sql<{ id: string; name: string; description: string; pharmacy: string | null; pharmacy_id: string | null; fulfillment: string | null }>`
      select id, name, description, pharmacy, pharmacy_id, fulfillment from medication_services
    `;
    return json({
      services: rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        pharmacy: row.pharmacy,
        pharmacyId: row.pharmacy_id,
        fulfillment: row.fulfillment,
      })),
    });
  }

  if (method === "POST" && rest === "/care/medications/refill-requests") {
    const patient = await requirePatient(request, sql);
    const body = await readJson();
    const id = newId("rfl");
    await sql`insert into refill_requests (id, patient_id, medication_id, medication_name, pharmacy_id, status)
      values (${id}, ${patient.id}, ${String(body.medication_id || "")}, ${String(body.medication_name || "Medication refill")}, ${body.pharmacy_id ? String(body.pharmacy_id) : null}, ${"requested"})`;
    return json({ request: { id, status: "requested" }, id });
  }

  if (method === "GET" && rest === "/payments/transactions") {
    const patient = await requirePatient(request, sql);
    const rows = await sql<Record<string, unknown>>`select * from payments where patient_id = ${patient.id} order by created_at desc`;
    return json({
      transactions: rows.map((row) => ({
        id: row.id,
        type: row.type,
        service: row.service,
        provider: row.provider,
        dateLabel: row.date_label,
        status: row.status,
        statusLabel: statusLabel(String(row.status)),
        reference: row.reference,
        serviceAmount: row.service_amount,
        platformFee: row.platform_fee,
        amount: row.amount,
      })),
    });
  }

  if (method === "POST" && rest === "/payments/checkout") {
    const patient = await requirePatient(request, sql);
    const body = await readJson();
    const transactionId = String(body.transaction_id || "");
    const origin = new URL(request.url).origin;
    const checkoutUrl = `${origin}/pay?tx=${encodeURIComponent(transactionId)}`;
    const updated = await sql`update payments set method = ${String(body.method || "paystack")}, checkout_url = ${checkoutUrl}, status = ${"pending"}
      where id = ${transactionId} and patient_id = ${patient.id} returning id, status`;
    if (!updated.length) throw new ApiError(404, "NOT_FOUND", "Transaction not found.");
    return json({ transaction: { id: transactionId, status: "handoff_ready" }, checkout_url: checkoutUrl, payment_url: checkoutUrl });
  }

  if (method === "POST" && rest === "/payments/complete") {
    const patient = await requirePatient(request, sql);
    const body = await readJson();
    const transactionId = String(body.transaction_id || "");
    const updated = await sql`update payments set status = ${"paid"} where id = ${transactionId} and patient_id = ${patient.id} returning id`;
    if (!updated.length) throw new ApiError(404, "NOT_FOUND", "Transaction not found.");
    return json({ transaction: { id: transactionId, status: "paid" } });
  }

  if (method === "POST" && rest === "/puga-care/handoff") {
    const patient = await patientFromRequest(request, sql);
    const body = await readJson();
    const id = newId("hnd");
    await sql`insert into care_handoffs (id, patient_id, service, context, status)
      values (${id}, ${patient?.id || null}, ${String(body.service || "care")}, ${String(body.context || "")}, ${"prepared"})`;
    return json({ handoff: { id, status: "prepared" }, id });
  }

  if (method === "POST" && rest === "/puga-access/sessions") {
    const patient = await patientFromRequest(request, sql);
    const body = await readJson();
    const channel = String(body.destination || body.channel || body.source_channel || "ivr");
    const id = newId("acc");
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const origin = new URL(request.url).origin;
    const accessUrl = `${origin}/access/${channel}?session=${id}`;
    await sql`insert into pugaaccess_sessions (id, patient_id, channel, destination, language, status, access_url, expires_at)
      values (${id}, ${patient?.id || null}, ${channel}, ${String(body.destination || "voice")}, ${String(body.language || "en-NG")}, ${"prepared"}, ${accessUrl}, ${expires})`;
    return json({
      session: {
        sessionId: id,
        id,
        channel,
        destination: body.destination || "voice",
        status: "prepared",
        accessUrl,
        expiresAt: expires,
        continuitySupported: true,
      },
    });
  }

  const accessStatus = rest.match(/^\/puga-access\/sessions\/([^/]+)$/);
  if (method === "GET" && accessStatus) {
    const id = decodeURIComponent(accessStatus[1]);
    const rows = await sql<Record<string, unknown>>`select * from pugaaccess_sessions where id = ${id} limit 1`;
    if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Session not found.");
    return json({ session: rows[0] });
  }

  if (method === "GET" && rest === "/me/family") {
    const patient = await requirePatient(request, sql);
    const family = await sql<Record<string, unknown>>`select * from family_members where patient_id = ${patient.id} order by created_at`;
    const mapped = family.map(mapFamily);
    return json({ family: mapped, members: mapped });
  }

  if (method === "POST" && rest === "/me/family/members") {
    const patient = await requirePatient(request, sql);
    const body = await readJson();
    const name = String(body.name || "").trim();
    if (!name) throw new ApiError(422, "VALIDATION_ERROR", "Name is required.");
    const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
    const id = newId("fam");
    await sql`insert into family_members (id, patient_id, name, relationship, initials, health_id, access_status, status, next_care)
      values (${id}, ${patient.id}, ${name}, ${String(body.relationship || "Family")}, ${initials}, ${"Pending identity"}, ${"pending"}, ${"pending"}, ${"Complete identity and authorization"})`;
    const member = mapFamily((await sql<Record<string, unknown>>`select * from family_members where id = ${id}`)[0] || { id, name, relationship, initials });
    return json({ member });
  }

  const famAuth = rest.match(/^\/me\/family\/members\/([^/]+)\/authorization$/);
  if (famAuth) {
    const patient = await requirePatient(request, sql);
    const memberId = decodeURIComponent(famAuth[1]);
    if (method === "GET") {
      const rows = await sql<{ id: string; access_status: string; access_scope: string | null }>`
        select id, access_status, access_scope from family_members where id = ${memberId} and patient_id = ${patient.id} limit 1
      `;
      if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Family member not found.");
      return json({ authorization: { memberId, status: rows[0].access_status, scope: rows[0].access_scope, updated: "Today" } });
    }
    if (method === "POST") {
      const body = await readJson();
      const status = String(body.status || "authorized");
      const scope = String(body.scope || "care-navigation");
      const updated = await sql`update family_members set access_status = ${status}, access_scope = ${scope}
        where id = ${memberId} and patient_id = ${patient.id} returning id`;
      if (!updated.length) throw new ApiError(404, "NOT_FOUND", "Family member not found.");
      return json({ authorization: { memberId, status, scope, updated: "Just now" } });
    }
  }

  if (method === "GET" && rest === "/me/health-dashboard") {
    const patient = await requirePatient(request, sql);
    const [appts, convos, notes, labs, meds, pays] = await Promise.all([
      sql<{ n: number }>`select count(*)::int as n from appointments where patient_id = ${patient.id} and status in ('requested','confirmed')`,
      sql<{ n: number }>`select count(*)::int as n from conversations where patient_id = ${patient.id}`,
      sql<{ n: number }>`select count(*)::int as n from notifications where patient_id = ${patient.id} and unread = true`,
      sql<{ n: number }>`select count(*)::int as n from laboratory_requests where patient_id = ${patient.id}`,
      sql<{ n: number }>`select count(*)::int as n from refill_requests where patient_id = ${patient.id}`,
      sql<{ n: number }>`select count(*)::int as n from payments where patient_id = ${patient.id}`,
    ]);
    return json({
      dashboard: {
        healthId: { status: "Active", identifier: maskHealthId(patient.health_id) },
        careJourney: { completed: 1, active: 1, next: "Continue with PugaCare" },
        appointments: { upcoming: appts[0]?.n || 0, next: "Review appointments" },
        consultations: { recent: convos[0]?.n || 0, latest: "PugaAI Health guidance" },
        laboratory: { pending: labs[0]?.n || 0, latest: "Result delivery · Awaiting provider result" },
        medications: { active: meds[0]?.n || 0, refillDue: meds[0]?.n || 0, next: "Medication refill · Review when due" },
        payments: { recent: pays[0]?.n || 0, status: pays[0]?.n ? "Receipt available" : "No recent payments" },
        conversations: { recent: convos[0]?.n || 0, latest: "Ask PugaAI Health" },
        notifications: { unread: notes[0]?.n || 0 },
        indicators: [
          { label: "Care continuity", value: "Active", context: "Journey has a next step available." },
          { label: "Privacy access", value: "Protected", context: "Review permissions and access history anytime." },
          { label: "PugaAccess", value: "Available", context: "IVR, USSD and SMS continuity is supported." },
        ],
      },
    });
  }

  if (method === "GET" && rest === "/me/health-journey") {
    const patient = await requirePatient(request, sql);
    const events = await sql<{ id: string; title: string; status: string; description: string; date_label: string | null; action_json: string | null }>`
      select id, title, status, description, date_label, action_json from health_journey_events where patient_id = ${patient.id} order by created_at
    `;
    const completed = events.filter((event) => event.status === "completed").length;
    const active = events.filter((event) => event.status === "active").length;
    return json({
      journey: {
        completed,
        active,
        nextSteps: active,
        events: events.map((event) => ({
          id: event.id,
          title: event.title,
          status: event.status,
          description: event.description,
          date: event.date_label,
          action: parseJson(event.action_json, null),
        })),
      },
    });
  }

  if (method === "GET" && rest === "/me/permissions") {
    const patient = await requirePatient(request, sql);
    const permissions = await sql`select id, icon, name, purpose, status, updated_at as updated from permissions where patient_id = ${patient.id}`;
    return json({ permissions });
  }

  const permPatch = rest.match(/^\/me\/permissions\/([^/]+)$/);
  if (method === "PATCH" && permPatch) {
    const patient = await requirePatient(request, sql);
    const permissionId = decodeURIComponent(permPatch[1]);
    const body = await readJson();
    const status = String(body.status || "revoked");
    const updated = await sql`update permissions set status = ${status}, updated_at = ${new Date().toISOString()}
      where id = ${permissionId} and patient_id = ${patient.id} returning id, status`;
    if (!updated.length) throw new ApiError(404, "NOT_FOUND", "Permission not found.");
    return json({ permission: { id: permissionId, status } });
  }

  if (method === "GET" && rest === "/me/access-log") {
    const patient = await requirePatient(request, sql);
    const entries = await sql`select id, initials, actor, purpose, time_label as time, status from access_log where patient_id = ${patient.id} order by created_at desc`;
    return json({
      entries: entries.length
        ? entries
        : [
            { id: "access-self", initials: "AI", actor: "PugaAI Health", purpose: "Protected session — minimum necessary context", time: "Today", status: "Allowed" },
          ],
    });
  }

  if (method === "GET" && rest === "/notifications") {
    const patient = await patientFromRequest(request, sql);
    if (!patient) return json({ notifications: [] });
    const rows = await sql<Record<string, unknown>>`select id, type, title, text, time_label, unread, page from notifications where patient_id = ${patient.id} order by created_at desc`;
    return json({
      notifications: rows.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        text: row.text,
        time: row.time_label,
        unread: row.unread,
        page: row.page,
      })),
    });
  }

  const notifRead = rest.match(/^\/notifications\/([^/]+)\/read$/);
  if (method === "POST" && notifRead) {
    const patient = await requirePatient(request, sql);
    const notificationId = decodeURIComponent(notifRead[1]);
    await sql`update notifications set unread = false where id = ${notificationId} and patient_id = ${patient.id}`;
    return json({ notification: { id: notificationId, unread: false } });
  }

  if (method === "POST" && rest === "/notifications/read-all") {
    const patient = await requirePatient(request, sql);
    await sql`update notifications set unread = false where patient_id = ${patient.id}`;
    return json({ unread: 0 });
  }

  throw new ApiError(404, "NOT_FOUND", "This service path was not found.");
}
