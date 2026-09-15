# Billing & Plans production-readiness upgrade

## Outcome
Turn Billing & Plans into a clear, manageable subscription overview using the existing live tenant, camera, member, alert, and AI-usage data. Remove claims that imply real payment processing or historical invoices where none exist.

## Changes
- Replace the misleading historical MRR chart with an accurate current recurring-revenue and plan-mix overview.
- Add search and status/plan filters so administrators can quickly find a tenant.
- Make each tenant row actionable with a focused plan-management dialog.
- Allow permitted administrators to change a tenant’s plan and lifecycle status, with confirmation, saved database updates, audit history, success/error feedback, and refresh.
- Show the rate card and an explicit estimated-charge breakdown before saving.
- Add robust loading, partial-load error, empty, and retry states instead of silently showing zero values after failed requests.
- Clarify which values are calculated estimates and that payment collection/invoicing is not connected on this page.
- Improve table usability on smaller screens while preserving the desktop overview.

## Validation
- Test loading, filtering, opening a tenant, editing a plan/status, cancelling, and saved-state refresh.
- Confirm tenant data remains permission-scoped, writes are rejected cleanly when unauthorized, and changes appear in the audit trail.
- Check desktop and mobile layouts, browser console/network errors, and the final production build signal.

## Technical details
- Keep the existing `tenants.plan` and `tenants.status` fields as the source of truth.
- Continue deriving estimated recurring charges from the page rate card and current camera count; label these as estimates rather than invoices or recognized revenue.
- Use existing design-system dialogs, selects, buttons, badges, and semantic tokens.
- No payment processor, invoice ledger, or checkout flow will be invented; those require a separate billing integration and data model.
