import type { TenantRow } from "@/hooks/useTenants";

export interface TenantNode {
  tenant: TenantRow;
  depth: number;
  children: TenantNode[];
}

/**
 * Builds an arbitrary-depth site hierarchy from a flat tenant list.
 * Rows whose parent is missing (or unreadable under RLS) are treated as roots,
 * and cycles are broken so a bad parent_id can never hang the UI.
 */
export function buildTenantTree(tenants: TenantRow[]): TenantNode[] {
  const byId = new Map(tenants.map((t) => [t.id, t]));
  const nodes = new Map<string, TenantNode>(
    tenants.map((t) => [t.id, { tenant: t, depth: 0, children: [] }]),
  );
  const roots: TenantNode[] = [];

  const isCyclic = (t: TenantRow) => {
    const seen = new Set<string>([t.id]);
    let cur = t.parent_id ? byId.get(t.parent_id) : undefined;
    while (cur) {
      if (seen.has(cur.id)) return true;
      seen.add(cur.id);
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
    return false;
  };

  for (const t of tenants) {
    const node = nodes.get(t.id)!;
    const parent = t.parent_id ? nodes.get(t.parent_id) : undefined;
    if (parent && !isCyclic(t)) parent.children.push(node);
    else roots.push(node);
  }

  const setDepth = (node: TenantNode, depth: number) => {
    node.depth = depth;
    node.children.sort((a, b) => a.tenant.name.localeCompare(b.tenant.name));
    node.children.forEach((c) => setDepth(c, depth + 1));
  };
  roots.sort((a, b) => a.tenant.name.localeCompare(b.tenant.name));
  roots.forEach((r) => setDepth(r, 0));

  return roots;
}

/** Flattens a tree into render order, skipping children of collapsed nodes. */
export function flattenTree(roots: TenantNode[], collapsed: Set<string>): TenantNode[] {
  const out: TenantNode[] = [];
  const walk = (nodes: TenantNode[]) => {
    for (const n of nodes) {
      out.push(n);
      if (!collapsed.has(n.tenant.id)) walk(n.children);
    }
  };
  walk(roots);
  return out;
}

/** Every descendant id of a tenant (excluding itself). */
export function descendantIds(tenants: TenantRow[], id: string): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const t of tenants) {
    if (!t.parent_id) continue;
    childrenOf.set(t.parent_id, [...(childrenOf.get(t.parent_id) ?? []), t.id]);
  }
  const out: string[] = [];
  const stack = [...(childrenOf.get(id) ?? [])];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    out.push(cur);
    stack.push(...(childrenOf.get(cur) ?? []));
  }
  return out;
}

/** Ancestor chain, closest parent first. */
export function ancestors(tenants: TenantRow[], id: string): TenantRow[] {
  const byId = new Map(tenants.map((t) => [t.id, t]));
  const out: TenantRow[] = [];
  const seen = new Set<string>([id]);
  let cur = byId.get(id)?.parent_id ? byId.get(byId.get(id)!.parent_id!) : undefined;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.push(cur);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return out;
}

/** "Group › Region › Site" breadcrumb for a tenant. */
export function tenantPath(tenants: TenantRow[], id: string): string {
  const self = tenants.find((t) => t.id === id);
  if (!self) return "";
  return [...ancestors(tenants, id).reverse().map((t) => t.name), self.name].join(" › ");
}

/**
 * Valid parents for a tenant: anything that is not itself or one of its
 * descendants (which would create a cycle).
 */
export function eligibleParents(tenants: TenantRow[], id?: string | null): TenantRow[] {
  if (!id) return tenants;
  const blocked = new Set([id, ...descendantIds(tenants, id)]);
  return tenants.filter((t) => !blocked.has(t.id));
}

export interface TenantRollup {
  own: number;
  total: number;
  subSites: number;
}

/** Own value plus the sum of every descendant's value. */
export function rollup(
  tenants: TenantRow[],
  id: string,
  counts: Record<string, number>,
): TenantRollup {
  const kids = descendantIds(tenants, id);
  const own = counts[id] ?? 0;
  return {
    own,
    total: own + kids.reduce((sum, k) => sum + (counts[k] ?? 0), 0),
    subSites: kids.length,
  };
}
