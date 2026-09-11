import { describe, it, expect } from "vitest";
import { computeDueAt, evaluateSla, turnaroundHours, agingBucket } from "@/domain/sla";

describe("SLA calculation", () => {
  const start = new Date("2026-09-01T00:00:00Z");

  it("computes the due date", () => {
    expect(computeDueAt(start, 48).toISOString()).toBe("2026-09-03T00:00:00.000Z");
  });

  it("detects breach and approaching windows", () => {
    const onTrack = evaluateSla(start, 48, new Date("2026-09-01T12:00:00Z"));
    expect(onTrack.breached).toBe(false);
    expect(onTrack.approaching).toBe(false);

    const approaching = evaluateSla(start, 48, new Date("2026-09-02T18:00:00Z"));
    expect(approaching.breached).toBe(false);
    expect(approaching.approaching).toBe(true);

    const breached = evaluateSla(start, 48, new Date("2026-09-04T00:00:00Z"));
    expect(breached.breached).toBe(true);
  });

  it("computes turnaround and aging buckets", () => {
    expect(turnaroundHours(start, new Date("2026-09-02T00:00:00Z"))).toBe(24);
    expect(agingBucket(10)).toBe("0-24");
    expect(agingBucket(30)).toBe("24-48");
    expect(agingBucket(60)).toBe("48-72");
    expect(agingBucket(100)).toBe(">72");
  });
});
