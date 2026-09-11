"use client";

import * as React from "react";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import Link from "next/link";
import {
  CheckCircle2,
  Send,
  ShieldCheck,
  XCircle,
  RotateCcw,
  Ban,
  Archive,
  PlayCircle,
} from "lucide-react";
import { RevisionCategory } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Textarea, Select, Label } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import type { ActionState } from "./actions";
import {
  approveAction,
  archiveAction,
  cancelAction,
  rejectAction,
  requestRevisionAction,
  startReviewAction,
  submitAction,
  validateAction,
} from "./actions";

const INITIAL: ActionState = { ok: false, message: "" };

function useToastState(state: ActionState) {
  useEffect(() => {
    if (state.message) {
      if (state.ok) toast.success(state.message);
      else toast.error(state.message);
    }
  }, [state]);
}

function Pending({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <>
      {pending ? "Memproses..." : children}
    </>
  );
}

export interface SignatureOption {
  id: string;
  isDefault: boolean;
  label: string;
}

/** Simple single-action button backed by a server action + toast. */
export function SimpleAction({
  action,
  documentId,
  approvalId,
  label,
  icon,
  variant = "primary",
  confirmTitle,
  confirmDescription,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  documentId: string;
  approvalId?: string;
  label: string;
  icon?: React.ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  confirmTitle?: string;
  confirmDescription?: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL);
  useToastState(state);

  const form = (
    <form action={formAction}>
      <input type="hidden" name="documentId" value={documentId} />
      {approvalId && <input type="hidden" name="approvalId" value={approvalId} />}
      <Button type="submit" variant={variant} className="w-full sm:w-auto">
        {icon}
        <Pending>{label}</Pending>
      </Button>
    </form>
  );

  if (!confirmTitle) return form;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={variant} className="w-full sm:w-auto">
          {icon}
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{confirmTitle}</DialogTitle>
          <DialogDescription>{confirmDescription}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Batal</Button>
          </DialogClose>
          <form action={formAction}>
            <input type="hidden" name="documentId" value={documentId} />
            {approvalId && <input type="hidden" name="approvalId" value={approvalId} />}
            <Button type="submit" variant={variant}>
              <Pending>{label}</Pending>
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OwnerActions({
  documentId,
  canEdit,
  canValidate,
  canSubmit,
  canCancel,
}: {
  documentId: string;
  canEdit: boolean;
  canValidate: boolean;
  canSubmit: boolean;
  canCancel: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {canEdit && (
        <Button asChild variant="outline">
          <Link href={`/documents/new?documentId=${documentId}`}>Lanjutkan Edit</Link>
        </Button>
      )}
      {canValidate && (
        <SimpleAction
          action={validateAction}
          documentId={documentId}
          label="Jalankan Validasi"
          icon={<CheckCircle2 className="size-4" />}
          variant="secondary"
        />
      )}
      {canSubmit && (
        <SimpleAction
          action={submitAction}
          documentId={documentId}
          label="Ajukan Dokumen"
          icon={<Send className="size-4" />}
          confirmTitle="Ajukan dokumen ini?"
          confirmDescription="Setelah diajukan, dokumen tidak dapat diedit tanpa melalui alur revisi. Nomor dokumen akan diterbitkan."
        />
      )}
      {canCancel && (
        <SimpleAction
          action={cancelAction}
          documentId={documentId}
          label="Batalkan"
          icon={<Ban className="size-4" />}
          variant="ghost"
          confirmTitle="Batalkan dokumen?"
          confirmDescription="Dokumen yang dibatalkan tidak dapat diproses kembali."
        />
      )}
    </div>
  );
}

export function ApproverActions({
  documentId,
  approvalId,
  reviewStarted,
  requiresSignature,
  signatures,
}: {
  documentId: string;
  approvalId: string;
  reviewStarted: boolean;
  requiresSignature: boolean;
  signatures: SignatureOption[];
}) {
  const [approveState, approveForm] = useActionState(approveAction, INITIAL);
  const [revState, revForm] = useActionState(requestRevisionAction, INITIAL);
  const [rejState, rejForm] = useActionState(rejectAction, INITIAL);
  useToastState(approveState);
  useToastState(revState);
  useToastState(rejState);

  if (!reviewStarted) {
    return (
      <SimpleAction
        action={startReviewAction}
        documentId={documentId}
        approvalId={approvalId}
        label="Mulai Review"
        icon={<PlayCircle className="size-4" />}
      />
    );
  }

  const canSign = !requiresSignature || signatures.length > 0;

  return (
    <div className="flex flex-wrap gap-2">
      {/* Approve */}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="primary">
            <ShieldCheck className="size-4" /> Setujui
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Persetujuan digital internal</DialogTitle>
            <DialogDescription>
              Tindakan ini mencatat persetujuan Anda beserta waktu dan versi dokumen.
            </DialogDescription>
          </DialogHeader>
          <form action={approveForm} className="space-y-4">
            <input type="hidden" name="documentId" value={documentId} />
            <input type="hidden" name="approvalId" value={approvalId} />
            {requiresSignature && (
              <div className="space-y-1.5">
                <Label htmlFor="signatureId">Tanda tangan</Label>
                {signatures.length === 0 ? (
                  <p className="text-sm text-danger">
                    Belum ada tanda tangan.{" "}
                    <Link href="/signatures" className="underline">
                      Buat tanda tangan
                    </Link>{" "}
                    terlebih dahulu.
                  </p>
                ) : (
                  <Select id="signatureId" name="signatureId" required defaultValue={signatures.find((s) => s.isDefault)?.id}>
                    {signatures.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="comments">Catatan (opsional)</Label>
              <Textarea id="comments" name="comments" rows={3} />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Batal</Button>
              </DialogClose>
              <Button type="submit" disabled={!canSign}>
                <Pending>Setujui & Tandatangani</Pending>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Request revision */}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="secondary">
            <RotateCcw className="size-4" /> Minta Revisi
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permintaan revisi</DialogTitle>
            <DialogDescription>
              Dokumen dikembalikan ke dosen pengembang untuk diperbaiki.
            </DialogDescription>
          </DialogHeader>
          <form action={revForm} className="space-y-4">
            <input type="hidden" name="documentId" value={documentId} />
            <input type="hidden" name="approvalId" value={approvalId} />
            <div className="space-y-1.5">
              <Label htmlFor="category">Kategori</Label>
              <Select id="category" name="category" defaultValue={RevisionCategory.CONTENT}>
                <option value={RevisionCategory.METADATA}>Metadata</option>
                <option value={RevisionCategory.CONTENT}>Konten</option>
                <option value={RevisionCategory.FORMAT}>Format</option>
                <option value={RevisionCategory.SIGNATURE}>Tanda tangan</option>
                <option value={RevisionCategory.OTHER}>Lainnya</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Catatan revisi</Label>
              <Textarea id="notes" name="notes" rows={4} required placeholder="Jelaskan perbaikan yang diperlukan..." />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Batal</Button>
              </DialogClose>
              <Button type="submit" variant="secondary">
                <Pending>Kirim Permintaan</Pending>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reject */}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="destructive">
            <XCircle className="size-4" /> Tolak
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak dokumen</DialogTitle>
            <DialogDescription>
              Penolakan menghentikan alur persetujuan untuk versi ini.
            </DialogDescription>
          </DialogHeader>
          <form action={rejForm} className="space-y-4">
            <input type="hidden" name="documentId" value={documentId} />
            <input type="hidden" name="approvalId" value={approvalId} />
            <div className="space-y-1.5">
              <Label htmlFor="rej-notes">Alasan penolakan</Label>
              <Textarea id="rej-notes" name="notes" rows={4} required />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Batal</Button>
              </DialogClose>
              <Button type="submit" variant="destructive">
                <Pending>Tolak Dokumen</Pending>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AdminActions({ documentId, canArchive }: { documentId: string; canArchive: boolean }) {
  if (!canArchive) return null;
  return (
    <SimpleAction
      action={archiveAction}
      documentId={documentId}
      label="Arsipkan"
      icon={<Archive className="size-4" />}
      variant="outline"
      confirmTitle="Arsipkan dokumen?"
      confirmDescription="Dokumen final akan dipindahkan ke arsip."
    />
  );
}
