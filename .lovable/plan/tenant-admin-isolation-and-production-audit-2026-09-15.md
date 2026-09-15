# Tenant Admin isolation and production audit

## Goal
Ensure Tenant Admins can only see and manage information for sites where they hold an owner/admin membership, while Super Admins retain platform-wide access.

## Changes
- Split admin routes into platform-only and tenant-scoped access groups.
- Hide platform-only navigation and controls from Tenant Admins.
- Prevent Tenant Admins from creating, moving, suspending, or changing billing for unrelated tenants.
- Validate tenant IDs from URLs and saved site selections against the signed-in user’s accessible site list.
- Tighten database access rules that currently grant the global `tenant_admin` role cross-tenant write access.
- Correct any site-request update rule that allows records to be moved across tenants.
- Fix UI warnings encountered during the audit.

## Tenant Admin assigned pages
Tenant Admins will retain tenant-scoped access to:
- Their site directory/detail and site overview
- Users and invitations for their sites
- Cameras, AI configuration, quality datasets, KPIs and AI budgets
- Rules, escalation policies, notifications and tenant audit history
- Tenant settings

Platform-only pages and actions:
- Global system monitoring
- Billing and plan management
- Creating top-level tenants and platform-wide onboarding
- Cross-tenant lifecycle administration

## Verification
- Re-run backend security scan and linter.
- Test Tenant Admin direct URL access, navigation visibility, saved tenant switching, and tenant-specific reads/writes.
- Test Super Admin access remains intact.
- Smoke-test assigned admin pages on desktop and mobile, and confirm a clean build/runtime state.
