import { describe, it, expect } from "vitest";
import { runValidation, hasBlockingErrors, summarizeValidation, type ValidationContext } from "@/server/documents/validation";

function ctx(over: Partial<ValidationContext> = {}): ValidationContext {
  return {
    metadata: {
      courseCode: "AKT301",
      courseName: "Sistem Informasi Manajemen",
      credits: 3,
      semester: 5,
      developerName: "Rangga",
      preparationDate: new Date(),
      revisionNumber: "0",
    },
    courseExists: true,
    academicPeriodActive: true,
    developerResolved: true,
    signersHaveActiveAssignment: true,
    pdfRendered: true,
    pageCount: 4,
    sourceHash: "abc",
    hasApprovalBlockHint: true,
    ...over,
  };
}

describe("validation rule engine", () => {
  it("passes a complete document with no blocking errors", () => {
    const findings = runValidation(ctx());
    expect(hasBlockingErrors(findings)).toBe(false);
    expect(summarizeValidation(findings).errors).toBe(0);
  });

  it("blocks when metadata is incomplete", () => {
    const findings = runValidation(ctx({ metadata: { ...ctx().metadata, courseCode: null } }));
    expect(hasBlockingErrors(findings)).toBe(true);
  });

  it("flags invalid credits as a blocking error", () => {
    const findings = runValidation(ctx({ metadata: { ...ctx().metadata, credits: 99 } }));
    const rule = findings.find((f) => f.ruleCode === "CREDITS_VALID");
    expect(rule?.status).toBe("FAILED");
    expect(hasBlockingErrors(findings)).toBe(true);
  });

  it("blocks when the academic period is inactive", () => {
    expect(hasBlockingErrors(runValidation(ctx({ academicPeriodActive: false })))).toBe(true);
  });

  it("blocks when page count is zero or pdf not rendered", () => {
    expect(hasBlockingErrors(runValidation(ctx({ pageCount: 0 })))).toBe(true);
    expect(hasBlockingErrors(runValidation(ctx({ pdfRendered: false })))).toBe(true);
  });

  it("treats missing approval-block hint as a non-blocking warning", () => {
    const findings = runValidation(ctx({ hasApprovalBlockHint: false }));
    const rule = findings.find((f) => f.ruleCode === "APPROVAL_BLOCK_HINT");
    expect(rule?.severity).toBe("WARNING");
    expect(hasBlockingErrors(findings)).toBe(false);
  });
});
