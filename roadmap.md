# Roadmap

- [x] Smoke-test Dashboard, Alerts, Incidents + alert→incident→resolution workflow (Sep 6).
- [x] Quality page filters driven by the configured defect list (Sep 9).
- [x] Fix "Tenant Not Found" on site detail — page now reads live site data (Sep 9).
- [x] Reports / Report Detail / Create Report now generated from live site alerts (Sep 9).
- [x] Maintenance now uses saved equipment and work orders per site, scored from real camera activity (Sep 9).

- [ ] Validate notifications (Resend/Twilio credentials pending) and live camera playback on a reachable stream.
- [x] Reviewed backend security warnings (Sep 9): remaining 5 are expected — 3 permission helpers must stay callable for row-level security, the invite-redemption helper is intentionally user-callable, and the outbound-request add-on is platform-managed and cannot be relocated.

