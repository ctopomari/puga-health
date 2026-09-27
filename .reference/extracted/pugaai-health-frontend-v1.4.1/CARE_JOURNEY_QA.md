# PugaAI Health v1.1.2 — Care Journey QA

## Scope
Frontend-only completion of the patient care journey UX.

## Journey stages
1. Find care
2. Choose facility
3. Choose provider
4. Appointment
5. Consultation
6. Laboratory / medication
7. Follow-up

## Boundaries
- Journey state shown by the frontend is navigational and illustrative until authoritative backend state is available.
- Appointment requests require explicit confirmation.
- Clinical decisions remain with authorized clinicians.
- Payment remains in the PugaPay/payment-provider boundary.
- Laboratory and medication actions do not create prescriptions autonomously.

## QA
- Journey stages present: PASS
- Responsive journey styles present: PASS
- Existing test suite: run with `npm test` after dependencies are installed.
- Production Vite build remains environment-dependent.
