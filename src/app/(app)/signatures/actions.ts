"use server";

import { revalidatePath } from "next/cache";
import { SignatureType } from "@prisma/client";
import { getSubjectOrThrow } from "@/server/auth/session";
import {
  createSignature,
  revokeSignature,
  setDefaultSignature,
} from "@/server/signatures/signature-service";

export interface SigState {
  ok: boolean;
  message: string;
}

export async function createDrawnSignature(_prev: SigState, formData: FormData): Promise<SigState> {
  try {
    const subject = await getSubjectOrThrow();
    const dataUrl = String(formData.get("dataUrl") ?? "");
    const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
    if (!match) return { ok: false, message: "Data tanda tangan tidak valid." };
    const buffer = Buffer.from(match[1]!, "base64");
    await createSignature(subject, {
      type: SignatureType.DRAWN,
      buffer,
      setDefault: formData.get("setDefault") === "on",
    });
    revalidatePath("/signatures");
    return { ok: true, message: "Tanda tangan tersimpan." };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

export async function createUploadedSignature(_prev: SigState, formData: FormData): Promise<SigState> {
  try {
    const subject = await getSubjectOrThrow();
    const file = formData.get("file");
    if (!(file instanceof Blob)) return { ok: false, message: "Berkas tidak ditemukan." };
    const buffer = Buffer.from(await file.arrayBuffer());
    await createSignature(subject, {
      type: SignatureType.UPLOADED,
      buffer,
      setDefault: formData.get("setDefault") === "on",
    });
    revalidatePath("/signatures");
    return { ok: true, message: "Tanda tangan diunggah." };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

export async function revokeSignatureAction(formData: FormData) {
  const subject = await getSubjectOrThrow();
  await revokeSignature(subject, String(formData.get("id")));
  revalidatePath("/signatures");
}

export async function setDefaultSignatureAction(formData: FormData) {
  const subject = await getSubjectOrThrow();
  await setDefaultSignature(subject, String(formData.get("id")));
  revalidatePath("/signatures");
}
