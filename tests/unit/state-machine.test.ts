import { describe, it, expect } from "vitest";
import { DocumentStatus } from "@prisma/client";
import {
  assertTransition,
  canTransition,
  InvalidTransitionError,
  waitingStatusForStep,
} from "@/domain/state-machine";

describe("document state machine", () => {
  it("allows the happy-path sequence", () => {
    expect(canTransition(DocumentStatus.DRAFT, DocumentStatus.VALIDATING)).toBe(true);
    expect(canTransition(DocumentStatus.VALIDATING, DocumentStatus.READY_TO_SUBMIT)).toBe(true);
    expect(canTransition(DocumentStatus.READY_TO_SUBMIT, DocumentStatus.SUBMITTED)).toBe(true);
    expect(canTransition(DocumentStatus.SUBMITTED, DocumentStatus.WAITING_LECTURER_SIGNATURE)).toBe(true);
    expect(canTransition(DocumentStatus.WAITING_LECTURER_SIGNATURE, DocumentStatus.WAITING_RMK_APPROVAL)).toBe(true);
    expect(canTransition(DocumentStatus.WAITING_RMK_APPROVAL, DocumentStatus.WAITING_KAPRODI_APPROVAL)).toBe(true);
    expect(canTransition(DocumentStatus.WAITING_KAPRODI_APPROVAL, DocumentStatus.PROCESSING_FINAL_DOCUMENT)).toBe(true);
    expect(canTransition(DocumentStatus.PROCESSING_FINAL_DOCUMENT, DocumentStatus.APPROVED)).toBe(true);
  });

  it("rejects illegal jumps", () => {
    expect(canTransition(DocumentStatus.DRAFT, DocumentStatus.APPROVED)).toBe(false);
    expect(canTransition(DocumentStatus.SUBMITTED, DocumentStatus.APPROVED)).toBe(false);
    expect(canTransition(DocumentStatus.APPROVED, DocumentStatus.DRAFT)).toBe(false);
  });

  it("treats APPROVED and ARCHIVED as terminal (except archive)", () => {
    expect(canTransition(DocumentStatus.APPROVED, DocumentStatus.ARCHIVED)).toBe(true);
    expect(canTransition(DocumentStatus.ARCHIVED, DocumentStatus.DRAFT)).toBe(false);
    expect(canTransition(DocumentStatus.CANCELLED, DocumentStatus.DRAFT)).toBe(false);
  });

  it("assertTransition throws on invalid transition", () => {
    expect(() => assertTransition(DocumentStatus.DRAFT, DocumentStatus.APPROVED)).toThrow(InvalidTransitionError);
    expect(() => assertTransition(DocumentStatus.DRAFT, DocumentStatus.VALIDATING)).not.toThrow();
  });

  it("maps step order to waiting status", () => {
    expect(waitingStatusForStep(1)).toBe(DocumentStatus.WAITING_LECTURER_SIGNATURE);
    expect(waitingStatusForStep(2)).toBe(DocumentStatus.WAITING_RMK_APPROVAL);
    expect(waitingStatusForStep(3)).toBe(DocumentStatus.WAITING_KAPRODI_APPROVAL);
  });

  it("supports the revision loop", () => {
    expect(canTransition(DocumentStatus.WAITING_RMK_APPROVAL, DocumentStatus.REVISION_REQUESTED)).toBe(true);
    expect(canTransition(DocumentStatus.REVISION_REQUESTED, DocumentStatus.VALIDATING)).toBe(true);
  });
});
