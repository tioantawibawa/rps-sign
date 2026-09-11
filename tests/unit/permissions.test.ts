import { describe, it, expect } from "vitest";
import { DocumentStatus, Role } from "@prisma/client";
import {
  canActOnActiveStep,
  canEditDocument,
  canReadDocument,
  hasCapability,
  type DocumentContext,
  type Subject,
} from "@/domain/permissions";

const ORG = "org1";

function subject(role: Role, over: Partial<Subject> = {}): Subject {
  return {
    userId: "u1",
    role,
    organizationId: ORG,
    facultyIds: [],
    studyProgramIds: [],
    clusterIds: [],
    ...over,
  };
}
function doc(over: Partial<DocumentContext> = {}): DocumentContext {
  return {
    organizationId: ORG,
    studyProgramId: "sp1",
    clusterId: "cl1",
    ownerId: "owner",
    status: DocumentStatus.DRAFT,
    ...over,
  };
}

describe("permission matrix", () => {
  it("grants document creation only to DOSEN", () => {
    expect(hasCapability(Role.DOSEN, "document:create")).toBe(true);
    expect(hasCapability(Role.KAPRODI, "document:create")).toBe(false);
    expect(hasCapability(Role.ADMIN, "users:manage")).toBe(true);
    expect(hasCapability(Role.AUDITOR, "audit:read")).toBe(true);
  });
});

describe("document read scope", () => {
  it("DOSEN only reads own documents", () => {
    expect(canReadDocument(subject(Role.DOSEN, { userId: "owner" }), doc())).toBe(true);
    expect(canReadDocument(subject(Role.DOSEN, { userId: "other" }), doc())).toBe(false);
  });
  it("AUDITOR reads only final/archived", () => {
    expect(canReadDocument(subject(Role.AUDITOR), doc({ status: DocumentStatus.APPROVED }))).toBe(true);
    expect(canReadDocument(subject(Role.AUDITOR), doc({ status: DocumentStatus.DRAFT }))).toBe(false);
  });
  it("KAPRODI reads within study program scope", () => {
    expect(canReadDocument(subject(Role.KAPRODI, { studyProgramIds: ["sp1"] }), doc())).toBe(true);
    expect(canReadDocument(subject(Role.KAPRODI, { studyProgramIds: ["spX"] }), doc())).toBe(false);
  });
  it("KOORDINATOR reads within cluster scope", () => {
    expect(canReadDocument(subject(Role.KOORDINATOR_RMK, { clusterIds: ["cl1"] }), doc())).toBe(true);
    expect(canReadDocument(subject(Role.KOORDINATOR_RMK, { clusterIds: ["clX"] }), doc())).toBe(false);
  });
  it("rejects cross-organization access", () => {
    expect(canReadDocument(subject(Role.ADMIN, { organizationId: "orgX" }), doc())).toBe(false);
  });
});

describe("editing & sequential approval", () => {
  it("only owner edits an editable document", () => {
    expect(canEditDocument(subject(Role.DOSEN, { userId: "owner" }), doc({ status: DocumentStatus.DRAFT }))).toBe(true);
    expect(canEditDocument(subject(Role.DOSEN, { userId: "owner" }), doc({ status: DocumentStatus.APPROVED }))).toBe(false);
    expect(canEditDocument(subject(Role.KAPRODI), doc())).toBe(false);
  });

  it("enforces the active role at each step", () => {
    const rmk = subject(Role.KOORDINATOR_RMK, { clusterIds: ["cl1"] });
    expect(canActOnActiveStep(rmk, doc({ status: DocumentStatus.WAITING_RMK_APPROVAL }))).toBe(true);
    // Not the active step for RMK
    expect(canActOnActiveStep(rmk, doc({ status: DocumentStatus.WAITING_KAPRODI_APPROVAL }))).toBe(false);
    // Kaprodi cannot act at RMK step
    const kaprodi = subject(Role.KAPRODI, { studyProgramIds: ["sp1"] });
    expect(canActOnActiveStep(kaprodi, doc({ status: DocumentStatus.WAITING_RMK_APPROVAL }))).toBe(false);
    expect(canActOnActiveStep(kaprodi, doc({ status: DocumentStatus.WAITING_KAPRODI_APPROVAL }))).toBe(true);
  });

  it("developer signs at the first step for their own doc", () => {
    const dosen = subject(Role.DOSEN, { userId: "owner" });
    expect(canActOnActiveStep(dosen, doc({ status: DocumentStatus.WAITING_LECTURER_SIGNATURE }))).toBe(true);
    const otherDosen = subject(Role.DOSEN, { userId: "other" });
    expect(canActOnActiveStep(otherDosen, doc({ status: DocumentStatus.WAITING_LECTURER_SIGNATURE }))).toBe(false);
  });
});
