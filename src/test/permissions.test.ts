import { describe, expect, it } from "vitest";
import { ALL_PERMISSION_KEYS, defaultPermission } from "@/lib/permissions";

describe("tenant role defaults", () => {
  it("keeps owners fully privileged", () => {
    expect(ALL_PERMISSION_KEYS.every((key) => defaultPermission("owner", key))).toBe(true);
  });

  it("keeps viewers read-only", () => {
    expect(defaultPermission("viewer", "alerts.view")).toBe(true);
    expect(defaultPermission("viewer", "alerts.acknowledge")).toBe(false);
    expect(defaultPermission("viewer", "reports.create")).toBe(false);
    expect(defaultPermission("viewer", "users.manage")).toBe(false);
  });

  it("gives operators response access without administration", () => {
    expect(defaultPermission("operator", "alerts.acknowledge")).toBe(true);
    expect(defaultPermission("operator", "maintenance.manage")).toBe(true);
    expect(defaultPermission("operator", "admin_ai.manage")).toBe(false);
  });

  it("uses the manager portal as the manager default", () => {
    expect(defaultPermission("manager", "portal.view")).toBe(true);
    expect(defaultPermission("manager", "shift.manage")).toBe(false);
  });
});
