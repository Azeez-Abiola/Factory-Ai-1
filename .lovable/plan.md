# Role Access, Billing Pricing, and Operator Help

## Outcome
- Add editable custom role permissions under **User Management → Role Management**.
- Let platform administrators edit each billing plan’s base monthly fee.
- Keep **Operator Console → Help & Docs** focused only on operator-console pages and role-specific operating workflows.

## Role Management
- Add a tenant-scoped permission model for Owner, Admin, Factory Manager, Operator, and Viewer.
- Present a clear matrix grouped by module, with checkboxes for individual functions such as view, create, update, acknowledge, resolve, export, and manage.
- Keep Owner as a protected full-access role; prevent configurations that remove essential tenant administration access.
- Show each selected member’s effective permissions in their detail panel, including their role defaults and tenant-specific overrides.
- Enforce permissions in navigation, routes, action controls, and tenant-scoped database policies—not only visually.
- Log every permission change in the audit trail and update open sessions promptly.

## Billing & Plans
- Replace hardcoded base fees with persisted plan pricing available only to Super Admins.
- Add an edit action on each rate-card plan with currency-safe validation and a before-save estimate preview.
- Recalculate tenant estimates from the saved base fee and existing per-camera fee.
- Record pricing changes in the audit trail and retain clear loading, error, empty, and mobile states.

## Help & Docs
- Remove admin setup, billing, tenant management, policy configuration, infrastructure, manager portal, and backend implementation content from `/app/help`.
- Retain and update guidance for Dashboard, Shift & Handover, Alerts, Investigations, Camera Feeds, Floor Plan, Quality, AI Insights, Reports, and Maintenance.
- Tailor guidance by Operator, Supervisor, and Viewer capabilities, using the effective permission model so users are not instructed to use unavailable actions.
- Replace outdated terminology and links, including “Incidents” where the product now says “Investigations.”

## Technical Details
- Add tenant-scoped role-permission configuration with least-privilege defaults, validation, RLS, realtime updates, and a permission-check helper shared by UI guards and database enforcement.
- Add a platform plan-pricing table restricted to Super Admin reads/writes, with audit metadata and updated timestamps.
- Keep existing membership roles and invitation flows compatible; custom permissions refine role access rather than replacing tenant membership.
- Add regression tests for permission resolution, protected Owner capabilities, pricing calculations, and operator-help content filtering.
- Smoke-test member role editing, permission changes, invitations, billing fee editing, and Help & Docs at desktop and mobile widths; run build, database linter, and security scan.
