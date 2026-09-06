# Camera Live Monitoring Validation

## Goal
Confirm that cameras configured by an administrator appear and play correctly in the operator console, with trustworthy status and AI monitoring behavior.

## Implementation
1. Secure manual AI inference so authenticated users can only run cameras belonging to tenants they are authorized to access, while scheduled processing remains service-only.
2. Replace simulated operator telemetry and placeholder actions with real camera configuration/status, and connect “Analyze with AI” to the selected camera’s real snapshot/inference workflow.
3. Harden live playback states for HLS, WHEP/WebRTC, and MJPEG, including load failures, authentication limitations, cleanup, and operator-visible diagnostics.
4. Run authenticated end-to-end smoke tests across Add/Edit/Test Camera, admin-to-operator visibility, feed rendering/error states, and AI invocation; verify function and application logs.

## Validation
- Application build and targeted tests pass.
- Admin and operator pages load without console or failed-request regressions.
- A tenant camera created/updated in admin is visible to the same tenant in the operator wall.
- Real streams render when browser-reachable; unreachable/private streams show accurate failure states rather than simulated video.
- Scheduled and manual inference paths enforce tenant authorization and report actionable results.
