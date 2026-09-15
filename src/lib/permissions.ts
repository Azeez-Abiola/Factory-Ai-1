export type TenantRole = "owner" | "admin" | "manager" | "operator" | "viewer";

export const PERMISSION_GROUPS = [
  { module: "Operator console", permissions: [
    ["dashboard.view", "View dashboard"], ["shift.view", "View shifts"], ["shift.manage", "Start and hand over shifts"],
    ["alerts.view", "View alerts"], ["alerts.acknowledge", "Acknowledge alerts"], ["alerts.resolve", "Resolve alerts"], ["alerts.export", "Export alerts"],
    ["investigations.view", "View investigations"], ["investigations.manage", "Manage investigations"], ["investigations.export", "Export investigations"],
    ["cameras.view", "View camera feeds"], ["floor_plan.view", "View floor plan"], ["quality.view", "View quality"],
    ["insights.view", "View AI insights"], ["reports.view", "View reports"], ["reports.create", "Create reports"],
    ["reports.export", "Export reports"], ["maintenance.view", "View maintenance"], ["maintenance.manage", "Manage maintenance"],
  ]},
  { module: "Administration", permissions: [
    ["admin_sites.manage", "Manage sites"], ["users.manage", "Manage users and roles"], ["admin_ai.manage", "Manage cameras, AI and datasets"],
    ["kpis.manage", "Manage KPIs"], ["budget.manage", "Manage AI budget"], ["rules.manage", "Manage rules and policies"],
    ["escalation.manage", "Manage escalation"], ["notifications.manage", "Manage notifications"], ["audit.view", "View audit log"],
    ["settings.manage", "Manage settings"],
  ]},
  { module: "Manager portal", permissions: [["portal.view", "View manager portal"]] },
] as const;

export type PermissionKey = typeof PERMISSION_GROUPS[number]["permissions"][number][0];
export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((group) => group.permissions.map(([key]) => key)) as PermissionKey[];

const defaults: Record<TenantRole, PermissionKey[]> = {
  owner: ALL_PERMISSION_KEYS,
  admin: ALL_PERMISSION_KEYS,
  manager: ["portal.view", "dashboard.view", "alerts.view", "investigations.view", "investigations.manage", "investigations.export", "cameras.view", "floor_plan.view", "quality.view", "insights.view", "reports.view", "reports.create", "reports.export", "maintenance.view", "maintenance.manage"],
  operator: ["dashboard.view", "shift.view", "shift.manage", "alerts.view", "alerts.acknowledge", "alerts.resolve", "alerts.export", "investigations.view", "investigations.manage", "investigations.export", "cameras.view", "floor_plan.view", "quality.view", "insights.view", "reports.view", "reports.export", "maintenance.view", "maintenance.manage"],
  viewer: ["dashboard.view", "alerts.view", "investigations.view", "cameras.view", "floor_plan.view", "quality.view", "insights.view", "reports.view", "maintenance.view"],
};

export const defaultPermission = (role: TenantRole, key: PermissionKey) => defaults[role].includes(key);
export const permissionLabel = (key: PermissionKey) => PERMISSION_GROUPS.flatMap((group) => group.permissions).find(([candidate]) => candidate === key)?.[1] ?? key;
