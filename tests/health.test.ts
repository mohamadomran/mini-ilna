import { describe, it, expect } from "vitest";
import { GET as healthHandler } from "../app/api/health/route";

describe("health endpoint", () => {
  it("returns 200 and { ok: true }", async () => {
    const res = await healthHandler();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});
