-- PugaAI Health core schema

create table if not exists patients (
  id text primary key,
  email text unique,
  password_hash text,
  display_name text not null default 'Patient',
  health_id text not null unique,
  language text not null default 'en-NG',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists patient_sessions (
  token text primary key,
  patient_id text not null references patients(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists patient_sessions_patient_idx on patient_sessions (patient_id);

create table if not exists admin_users (
  id text primary key,
  identifier text not null unique,
  email text,
  password_hash text not null,
  role text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists admin_sessions (
  token text primary key,
  admin_id text not null references admin_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists consents (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  consent_key text not null,
  status text not null,
  purpose text not null,
  updated_at timestamptz not null default now(),
  unique (patient_id, consent_key)
);

create table if not exists conversations (
  id text primary key,
  patient_id text,
  channel text not null default 'web',
  language text not null default 'en-NG',
  title text,
  preview text,
  status text not null default 'active',
  session_mode text not null default 'standard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists conversations_patient_idx on conversations (patient_id);

create table if not exists messages (
  id text primary key,
  conversation_id text not null references conversations(id) on delete cascade,
  role text not null,
  content text not null,
  safety_json text,
  care_actions_json text,
  response_category text,
  response_status text,
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_idx on messages (conversation_id);

create table if not exists transcriptions (
  id text primary key,
  conversation_id text,
  patient_id text,
  language text,
  transcript text not null,
  confidence double precision,
  n_atlas_used boolean not null default false,
  n_atlas_service text,
  n_atlas_request_id text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create table if not exists health_topics (
  id text primary key,
  title text not null,
  category text not null,
  summary text not null,
  body text,
  sort_order integer not null default 0
);

create table if not exists facilities (
  id text primary key,
  name text not null,
  location text not null,
  distance text,
  services_json text not null,
  availability text,
  initials text
);

create table if not exists providers (
  id text primary key,
  facility_id text references facilities(id),
  name text not null,
  specialty text not null,
  mode text not null,
  next_slot text
);

create table if not exists appointments (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  facility_id text,
  provider_id text,
  service text not null,
  mode text not null,
  preferred_time text,
  context text,
  status text not null default 'requested',
  reference text not null,
  date_label text,
  time_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists teleconsult_sessions (
  id text primary key,
  appointment_id text not null,
  patient_id text not null,
  status text not null default 'ready',
  created_at timestamptz not null default now()
);

create table if not exists laboratory_services (
  id text primary key,
  name text not null,
  description text not null,
  facility text,
  facility_id text,
  turnaround text
);

create table if not exists laboratory_requests (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  service_id text,
  service_name text not null,
  facility_id text,
  status text not null default 'requested',
  created_at timestamptz not null default now()
);

create table if not exists medication_services (
  id text primary key,
  name text not null,
  description text not null,
  pharmacy text,
  pharmacy_id text,
  fulfillment text
);

create table if not exists refill_requests (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  medication_id text,
  medication_name text not null,
  pharmacy_id text,
  status text not null default 'requested',
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  type text not null default 'service',
  service text not null,
  provider text,
  status text not null default 'pending',
  reference text not null,
  service_amount integer not null,
  platform_fee integer not null default 200,
  amount integer not null,
  method text,
  checkout_url text,
  date_label text,
  created_at timestamptz not null default now()
);

create table if not exists family_members (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  name text not null,
  relationship text not null,
  initials text,
  health_id text,
  access_status text not null default 'pending',
  access_scope text default 'care-navigation',
  status text not null default 'pending',
  next_care text,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  type text not null,
  title text not null,
  text text not null,
  time_label text,
  unread boolean not null default true,
  page text,
  created_at timestamptz not null default now()
);

create table if not exists health_journey_events (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  title text not null,
  status text not null,
  description text not null,
  date_label text,
  action_json text,
  created_at timestamptz not null default now()
);

create table if not exists permissions (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  icon text,
  name text not null,
  purpose text not null,
  status text not null default 'active',
  updated_at timestamptz not null default now()
);

create table if not exists access_log (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  initials text,
  actor text not null,
  purpose text not null,
  time_label text,
  status text not null default 'Allowed',
  created_at timestamptz not null default now()
);

create table if not exists pugaaccess_sessions (
  id text primary key,
  patient_id text,
  channel text not null,
  destination text,
  language text,
  status text not null default 'prepared',
  access_url text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists care_handoffs (
  id text primary key,
  patient_id text,
  service text not null,
  context text,
  status text not null default 'prepared',
  created_at timestamptz not null default now()
);

create table if not exists naic_validation_sessions (
  id text primary key,
  participant_id text not null,
  consent_status text not null default 'CONSENT_PENDING',
  coordinator_id text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'active'
);

create table if not exists naic_interactions (
  id text primary key,
  interaction_id text not null unique,
  validation_session_id text,
  participant_id text not null,
  channel text not null,
  language text not null,
  n_atlas_used boolean not null default false,
  n_atlas_service text,
  n_atlas_request_id text,
  transcript text not null,
  asr_confidence double precision,
  conversation_id text,
  message_id text,
  response_category text,
  response_status text,
  validation_status text not null,
  user_feedback text,
  feedback_rating text,
  counts_toward_validation boolean not null default false,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  created_at timestamptz not null default now()
);
create index if not exists naic_interactions_participant_idx on naic_interactions (participant_id);
create index if not exists naic_interactions_created_idx on naic_interactions (created_at);

create table if not exists admin_audit_events (
  id text primary key,
  admin_id text,
  event_type text not null,
  request_id text,
  result text not null,
  metadata text,
  created_at timestamptz not null default now()
);

create table if not exists message_feedback (
  id text primary key,
  conversation_id text,
  message_id text,
  patient_id text,
  feedback text not null,
  created_at timestamptz not null default now()
);

insert into health_topics (id, title, category, summary, body, sort_order) values
  ('malaria', 'Malaria prevention', 'Prevention', 'Mosquito-bite prevention, early testing and when to seek care.', 'Malaria is caused by a parasite spread through mosquito bites. Prevention includes sleeping under insecticide-treated nets, reducing standing water, and seeking prompt testing for fever. PugaAI Health does not diagnose. If fever, chills, vomiting or drowsiness appear, seek professional care quickly — especially for children and pregnant people.', 1),
  ('maternal', 'Pregnancy & maternal health', 'Maternal', 'Antenatal care, warning signs and preparation for skilled care.', 'Antenatal care helps track the health of mother and baby. Attend scheduled visits, take recommended supplements when prescribed by a clinician, and know danger signs: heavy bleeding, severe headache, convulsions, reduced fetal movement, or high fever. These require urgent professional care.', 2),
  ('child', 'Child health', 'Family', 'Immunization, nutrition, fever awareness and preventive care.', 'Childhood immunization schedules protect against serious infections. Keep a vaccination record, continue exclusive breastfeeding where recommended, and watch for danger signs in infants: poor feeding, convulsions, fast breathing, or unusual sleepiness. Seek skilled care rather than treating these as routine.', 3),
  ('blood-pressure', 'Blood pressure', 'Chronic care', 'Understanding hypertension, monitoring and care navigation.', 'High blood pressure often has no obvious symptoms. Lifestyle measures such as reduced salt, activity, and not smoking can support health, but a clinician should confirm readings and any treatment. Chest pain, sudden weakness, or severe headache with high readings need urgent care.', 4),
  ('nutrition', 'Nutrition', 'Wellness', 'Practical nutrition education for individuals and families.', 'A varied diet with local staples, vegetables, legumes, and safe water supports health. Infants, pregnant people, and those with chronic illness may need tailored advice from a qualified professional. This information is educational, not a personal meal prescription.', 5),
  ('prevention', 'Preventive health', 'Wellness', 'Everyday actions that can support healthier choices.', 'Handwashing, safe water, mosquito protection, immunization, and regular check-ups reduce many common risks. PugaAI Health can help you understand options and find participating services; it cannot replace a clinician.', 6),
  ('immunization', 'Immunization', 'Prevention', 'Routine vaccines and why completing the schedule matters.', 'Vaccines train the immune system before exposure. Keep appointments, bring your card, and ask a provider which doses are due. Fever after vaccination is often mild; difficulty breathing or collapse needs emergency care.', 7),
  ('diabetes', 'Diabetes awareness', 'Chronic care', 'Recognizing risk, monitoring and care navigation for blood sugar.', 'Diabetes is diagnosed by a clinician using tests, not by a conversation. Thirst, frequent urination, unexplained weight loss, or very high/low sugar symptoms should be assessed professionally. Medication changes must come from an authorized provider.', 8),
  ('infectious', 'Infectious disease prevention', 'Prevention', 'Hygiene, vaccination and when to isolate or seek care.', 'Cover coughs, wash hands, avoid sharing personal items when ill, and complete recommended vaccines. Difficulty breathing, persistent high fever, stiff neck, or confusion are warning signs for urgent evaluation.', 9),
  ('family-health', 'Reproductive and family health education', 'Family', 'Family planning information and respectful care navigation.', 'People can ask about contraception, fertility, and postnatal care in plain language. Method choice is personal and should be confirmed with a trained provider. PugaAI Health provides education and navigation, not prescriptions.', 10)
on conflict (id) do nothing;

insert into facilities (id, name, location, distance, services_json, availability, initials) values
  ('fac-1', 'PugaCare Partner Clinic — Yenagoa', 'Yenagoa, Bayelsa', '2.4 km', '["Teleconsultation","Laboratory","General consultation"]', 'Available today', 'PC'),
  ('fac-2', 'Puga TriniCare Network Facility', 'Yenagoa, Bayelsa', '5.1 km', '["General consultation","Laboratory","Prescription & refill"]', 'Next available tomorrow', 'PT'),
  ('fac-3', 'Participating Community Health Facility', 'Ogbia, Bayelsa', '—', '["General consultation","Maternal health"]', 'Check availability', 'CH')
on conflict (id) do nothing;

insert into providers (id, facility_id, name, specialty, mode, next_slot) values
  ('prov-1', 'fac-1', 'Available healthcare professional', 'Primary care', 'Teleconsultation', 'Today · 16:30'),
  ('prov-2', 'fac-1', 'Participating provider', 'Family health', 'In-person', 'Tomorrow · 09:00'),
  ('prov-3', 'fac-2', 'Network clinician', 'General consultation', 'In-person', 'Tomorrow · 11:00')
on conflict (id) do nothing;

insert into laboratory_services (id, name, description, facility, facility_id, turnaround) values
  ('lab-1', 'Malaria test', 'Digital request pathway for malaria testing at a participating laboratory.', 'PugaCare Partner Clinic — Yenagoa', 'fac-1', 'Same day where available'),
  ('lab-2', 'Full blood count', 'Laboratory request pathway for a full blood count.', 'Puga TriniCare Network Facility', 'fac-2', '24 hours indicative'),
  ('lab-3', 'Blood glucose test', 'Request pathway for supported blood glucose testing.', 'Participating Community Health Facility', 'fac-3', 'Check facility')
on conflict (id) do nothing;

insert into medication_services (id, name, description, pharmacy, pharmacy_id, fulfillment) values
  ('med-1', 'Approved medication refill', 'Continue a refill workflow for an existing approved prescription.', 'PugaCare Partner Pharmacy — Yenagoa', 'pharm-1', 'Pickup or supported delivery'),
  ('med-2', 'Prescription verification', 'Submit an existing prescription for pharmacy verification.', 'Puga TriniCare Network Pharmacy', 'pharm-2', 'Availability confirmed by pharmacy')
on conflict (id) do nothing;
