import { ApprovalStatus, DocumentStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import {
  APPROVAL_STATUS_LABELS,
  APPROVAL_STATUS_TONE,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_TONE,
} from "@/domain/document-status";

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return <Badge tone={DOCUMENT_STATUS_TONE[status]}>{DOCUMENT_STATUS_LABELS[status]}</Badge>;
}

export function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  return <Badge tone={APPROVAL_STATUS_TONE[status]}>{APPROVAL_STATUS_LABELS[status]}</Badge>;
}
