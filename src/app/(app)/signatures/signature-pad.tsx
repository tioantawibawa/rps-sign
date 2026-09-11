"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import SignaturePad from "signature_pad";
import { toast } from "sonner";
import { Eraser, PenLine, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import {
  createDrawnSignature,
  createUploadedSignature,
  type SigState,
} from "./actions";

const INIT: SigState = { ok: false, message: "" };

export function SignatureCreator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [dataUrl, setDataUrl] = useState("");
  const [drawState, drawAction] = useActionState(createDrawnSignature, INIT);
  const [upState, upAction] = useActionState(createUploadedSignature, INIT);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d")?.scale(ratio, ratio);
    padRef.current = new SignaturePad(canvas, { penColor: "#0f1f2e" });
    return () => padRef.current?.off();
  }, []);

  useEffect(() => {
    for (const s of [drawState, upState]) {
      if (s.message) {
        if (s.ok) {
          toast.success(s.message);
          padRef.current?.clear();
          setDataUrl("");
        } else toast.error(s.message);
      }
    }
  }, [drawState, upState]);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <PenLine className="size-4" /> Gambar Tanda Tangan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border border-input bg-white">
            <canvas ref={canvasRef} className="h-40 w-full touch-none" />
          </div>
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                padRef.current?.clear();
                setDataUrl("");
              }}
            >
              <Eraser className="size-4" /> Bersihkan
            </Button>
            <form action={drawAction} className="flex items-center gap-3">
              <input type="hidden" name="dataUrl" value={dataUrl} />
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name="setDefault" /> Jadikan default
              </label>
              <Button
                type="submit"
                size="sm"
                onClick={(e) => {
                  if (!padRef.current || padRef.current.isEmpty()) {
                    e.preventDefault();
                    toast.error("Gambar tanda tangan terlebih dahulu.");
                    return;
                  }
                  setDataUrl(padRef.current.toDataURL("image/png"));
                }}
              >
                Simpan
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Upload className="size-4" /> Unggah Gambar (PNG/JPEG)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={upAction} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="file">Berkas tanda tangan</Label>
              <input
                id="file"
                name="file"
                type="file"
                accept="image/png,image/jpeg"
                required
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:text-primary-foreground"
              />
              <p className="text-xs text-muted-foreground">Maks 2 MB. SVG tidak diperbolehkan.</p>
            </div>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name="setDefault" /> Jadikan default
            </label>
            <Button type="submit" size="sm">
              Unggah
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
