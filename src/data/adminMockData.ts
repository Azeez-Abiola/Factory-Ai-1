// ==================== TENANTS ====================
export type TenantPlan = "starter" | "professional" | "enterprise";
export type TenantStatus = "active" | "suspended" | "trial";

export interface Tenant {
  id: string;
  name: string;
  industry: string;
  plan: TenantPlan;
  status: TenantStatus;
  cameras: number;
  users: number;
  zones: number;
  createdAt: string;
  mrr: number;
  region: string;
  contactEmail: string;
}

export const mockTenants: Tenant[] = [
  { id: "TEN-001", name: "Tata Steel Works", industry: "Steel Manufacturing", plan: "enterprise", status: "active", cameras: 48, users: 32, zones: 8, createdAt: "2025-06-15", mrr: 4500, region: "India – Jamshedpur", contactEmail: "ops@tatasteel.com" },
  { id: "TEN-002", name: "Nestlé Nanjangud", industry: "FMCG / Food Processing", plan: "enterprise", status: "active", cameras: 36, users: 24, zones: 6, createdAt: "2025-08-20", mrr: 3800, region: "India – Karnataka", contactEmail: "plant@nestle.in" },
  { id: "TEN-003", name: "Dr. Reddy's Hyderabad", industry: "Pharmaceuticals", plan: "professional", status: "active", cameras: 24, users: 18, zones: 5, createdAt: "2025-09-10", mrr: 2200, region: "India – Telangana", contactEmail: "compliance@drreddys.com" },
  { id: "TEN-004", name: "Foxconn Chennai", industry: "Electronics Manufacturing", plan: "enterprise", status: "active", cameras: 64, users: 45, zones: 12, createdAt: "2025-07-01", mrr: 6200, region: "India – Tamil Nadu", contactEmail: "factory@foxconn.in" },
  { id: "TEN-005", name: "Amul Dairy Anand", industry: "Food Processing", plan: "professional", status: "active", cameras: 18, users: 12, zones: 4, createdAt: "2025-11-05", mrr: 1800, region: "India – Gujarat", contactEmail: "plant@amul.coop" },
  { id: "TEN-006", name: "Siemens Goa", industry: "Industrial Manufacturing", plan: "starter", status: "trial", cameras: 8, users: 5, zones: 2, createdAt: "2026-02-20", mrr: 0, region: "India – Goa", contactEmail: "pilot@siemens.in" },
  { id: "TEN-007", name: "Marico Mumbai", industry: "FMCG", plan: "professional", status: "active", cameras: 20, users: 14, zones: 4, createdAt: "2025-10-15", mrr: 2000, region: "India – Maharashtra", contactEmail: "ops@marico.com" },
  { id: "TEN-008", name: "Bajaj Auto Pune", industry: "Automotive", plan: "enterprise", status: "suspended", cameras: 40, users: 28, zones: 7, createdAt: "2025-05-10", mrr: 0, region: "India – Maharashtra", contactEmail: "factory@bajaj.com" },
];

// ==================== ADMIN USERS ====================
export type UserRole = "super_admin" | "tenant_admin" | "operator" | "viewer";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenantId: string | null;
  tenantName: string | null;
  status: "active" | "inactive" | "invited";
  lastLogin: string;
  createdAt: string;
}

export const mockAdminUsers: AdminUser[] = [
  { id: "USR-001", name: "Omkar Deshmukh", email: "omkar@factoryai.com", role: "super_admin", tenantId: null, tenantName: null, status: "active", lastLogin: "2026-03-26T09:30:00Z", createdAt: "2025-01-01" },
  { id: "USR-002", name: "Ananya Singh", email: "ananya@factoryai.com", role: "super_admin", tenantId: null, tenantName: null, status: "active", lastLogin: "2026-03-26T08:15:00Z", createdAt: "2025-02-10" },
  { id: "USR-003", name: "Ravi Mehta", email: "ravi@tatasteel.com", role: "tenant_admin", tenantId: "TEN-001", tenantName: "Tata Steel Works", status: "active", lastLogin: "2026-03-25T14:20:00Z", createdAt: "2025-06-15" },
  { id: "USR-004", name: "Priya Sharma", email: "priya@nestle.in", role: "tenant_admin", tenantId: "TEN-002", tenantName: "Nestlé Nanjangud", status: "active", lastLogin: "2026-03-24T11:00:00Z", createdAt: "2025-08-20" },
  { id: "USR-005", name: "Karthik Reddy", email: "karthik@drreddys.com", role: "tenant_admin", tenantId: "TEN-003", tenantName: "Dr. Reddy's Hyderabad", status: "active", lastLogin: "2026-03-23T16:45:00Z", createdAt: "2025-09-10" },
  { id: "USR-006", name: "Ming Chen", email: "ming@foxconn.in", role: "tenant_admin", tenantId: "TEN-004", tenantName: "Foxconn Chennai", status: "active", lastLogin: "2026-03-26T07:00:00Z", createdAt: "2025-07-01" },
  { id: "USR-007", name: "Suresh Kumar", email: "suresh@tatasteel.com", role: "operator", tenantId: "TEN-001", tenantName: "Tata Steel Works", status: "active", lastLogin: "2026-03-25T18:00:00Z", createdAt: "2025-07-20" },
  { id: "USR-008", name: "Neha Gupta", email: "neha@nestle.in", role: "operator", tenantId: "TEN-002", tenantName: "Nestlé Nanjangud", status: "inactive", lastLogin: "2026-02-10T09:00:00Z", createdAt: "2025-09-01" },
  { id: "USR-009", name: "Vikram Joshi", email: "vikram@amul.coop", role: "viewer", tenantId: "TEN-005", tenantName: "Amul Dairy Anand", status: "invited", lastLogin: "", createdAt: "2026-03-20" },
  { id: "USR-010", name: "Deepak Nair", email: "deepak@siemens.in", role: "tenant_admin", tenantId: "TEN-006", tenantName: "Siemens Goa", status: "active", lastLogin: "2026-03-25T10:30:00Z", createdAt: "2026-02-20" },
];

// ==================== SYSTEM MONITORING ====================
export interface SystemMetrics {
  totalApiCalls: number;
  apiCallsTrend: number;
  avgResponseTime: number;
  errorRate: number;
  activeConnections: number;
  storageUsed: number;
  storageTotal: number;
  gpuUtilization: number;
  inferenceQueue: number;
}

export const systemMetrics: SystemMetrics = {
  totalApiCalls: 2_847_391,
  apiCallsTrend: 12.4,
  avgResponseTime: 142,
  errorRate: 0.03,
  activeConnections: 186,
  storageUsed: 2.4,
  storageTotal: 5.0,
  gpuUtilization: 73,
  inferenceQueue: 24,
};

export const apiTrafficData = [
  { time: "00:00", calls: 1200, errors: 2 },
  { time: "02:00", calls: 800, errors: 1 },
  { time: "04:00", calls: 600, errors: 0 },
  { time: "06:00", calls: 3400, errors: 5 },
  { time: "08:00", calls: 8200, errors: 12 },
  { time: "10:00", calls: 12500, errors: 8 },
  { time: "12:00", calls: 9800, errors: 6 },
  { time: "14:00", calls: 11200, errors: 9 },
  { time: "16:00", calls: 10400, errors: 7 },
  { time: "18:00", calls: 7600, errors: 4 },
  { time: "20:00", calls: 4200, errors: 3 },
  { time: "22:00", calls: 2100, errors: 1 },
];

export const tenantUsageData = [
  { name: "Foxconn", api: 42000, storage: 820, inference: 3200 },
  { name: "Tata Steel", api: 38000, storage: 640, inference: 2800 },
  { name: "Nestlé", api: 28000, storage: 420, inference: 1900 },
  { name: "Dr. Reddy's", api: 18000, storage: 310, inference: 1400 },
  { name: "Marico", api: 14000, storage: 220, inference: 1100 },
  { name: "Amul", api: 9000, storage: 150, inference: 800 },
  { name: "Siemens", api: 3000, storage: 60, inference: 200 },
];

export const systemLogs = [
  { id: "LOG-001", timestamp: "2026-03-26T09:28:41Z", level: "error" as const, service: "inference-engine", message: "GPU memory threshold exceeded on node-3", tenant: "Foxconn Chennai" },
  { id: "LOG-002", timestamp: "2026-03-26T09:25:12Z", level: "warn" as const, service: "camera-gateway", message: "Camera CAM-05 reconnection failed (attempt 3/5)", tenant: "Tata Steel Works" },
  { id: "LOG-003", timestamp: "2026-03-26T09:22:00Z", level: "info" as const, service: "auth-service", message: "New tenant admin invited: deepak@siemens.in", tenant: "Siemens Goa" },
  { id: "LOG-004", timestamp: "2026-03-26T09:18:33Z", level: "info" as const, service: "billing-service", message: "Invoice generated for TEN-003: ₹2,200/mo", tenant: "Dr. Reddy's Hyderabad" },
  { id: "LOG-005", timestamp: "2026-03-26T09:15:01Z", level: "warn" as const, service: "inference-engine", message: "Model v2.4.1 inference latency spike: 340ms avg", tenant: "All" },
  { id: "LOG-006", timestamp: "2026-03-26T09:10:45Z", level: "error" as const, service: "storage-service", message: "S3 upload timeout for batch export RPT-008", tenant: "Nestlé Nanjangud" },
  { id: "LOG-007", timestamp: "2026-03-26T09:05:20Z", level: "info" as const, service: "camera-gateway", message: "12 cameras synced successfully", tenant: "Dr. Reddy's Hyderabad" },
  { id: "LOG-008", timestamp: "2026-03-26T09:00:00Z", level: "info" as const, service: "scheduler", message: "Daily compliance reports triggered for 7 tenants", tenant: "All" },
];

// ==================== BILLING ====================
export type InvoiceStatus = "paid" | "pending" | "overdue" | "cancelled";

export interface Invoice {
  id: string;
  tenantId: string;
  tenantName: string;
  amount: number;
  currency: string;
  period: string;
  status: InvoiceStatus;
  dueDate: string;
  paidDate?: string;
}

export const mockInvoices: Invoice[] = [
  { id: "INV-2026-031", tenantId: "TEN-004", tenantName: "Foxconn Chennai", amount: 6200, currency: "USD", period: "Mar 2026", status: "paid", dueDate: "2026-03-15", paidDate: "2026-03-12" },
  { id: "INV-2026-032", tenantId: "TEN-001", tenantName: "Tata Steel Works", amount: 4500, currency: "USD", period: "Mar 2026", status: "paid", dueDate: "2026-03-15", paidDate: "2026-03-14" },
  { id: "INV-2026-033", tenantId: "TEN-002", tenantName: "Nestlé Nanjangud", amount: 3800, currency: "USD", period: "Mar 2026", status: "pending", dueDate: "2026-03-28" },
  { id: "INV-2026-034", tenantId: "TEN-003", tenantName: "Dr. Reddy's Hyderabad", amount: 2200, currency: "USD", period: "Mar 2026", status: "pending", dueDate: "2026-03-28" },
  { id: "INV-2026-035", tenantId: "TEN-007", tenantName: "Marico Mumbai", amount: 2000, currency: "USD", period: "Mar 2026", status: "pending", dueDate: "2026-03-28" },
  { id: "INV-2026-036", tenantId: "TEN-005", tenantName: "Amul Dairy Anand", amount: 1800, currency: "USD", period: "Mar 2026", status: "overdue", dueDate: "2026-03-10" },
  { id: "INV-2026-021", tenantId: "TEN-004", tenantName: "Foxconn Chennai", amount: 6200, currency: "USD", period: "Feb 2026", status: "paid", dueDate: "2026-02-15", paidDate: "2026-02-13" },
  { id: "INV-2026-022", tenantId: "TEN-001", tenantName: "Tata Steel Works", amount: 4500, currency: "USD", period: "Feb 2026", status: "paid", dueDate: "2026-02-15", paidDate: "2026-02-14" },
  { id: "INV-2026-023", tenantId: "TEN-008", tenantName: "Bajaj Auto Pune", amount: 5200, currency: "USD", period: "Feb 2026", status: "cancelled", dueDate: "2026-02-15" },
];

export const revenueData = [
  { month: "Oct", mrr: 14200 },
  { month: "Nov", mrr: 16000 },
  { month: "Dec", mrr: 17400 },
  { month: "Jan", mrr: 18200 },
  { month: "Feb", mrr: 19700 },
  { month: "Mar", mrr: 20500 },
];

export const planDistribution = [
  { plan: "Enterprise", tenants: 3, revenue: 14500 },
  { plan: "Professional", tenants: 3, revenue: 6000 },
  { plan: "Starter / Trial", tenants: 2, revenue: 0 },
];
