import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocumentStatus } from "@prisma/client";
import { DocumentStatusBadge } from "@/components/status-badge";

describe("DocumentStatusBadge", () => {
  it("renders the Indonesian label for a status", () => {
    render(<DocumentStatusBadge status={DocumentStatus.APPROVED} />);
    expect(screen.getByText("Disahkan")).toBeInTheDocument();
  });

  it("renders the revision label", () => {
    render(<DocumentStatusBadge status={DocumentStatus.REVISION_REQUESTED} />);
    expect(screen.getByText("Perlu Revisi")).toBeInTheDocument();
  });
});
