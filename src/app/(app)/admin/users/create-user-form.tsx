"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Role } from "@prisma/client";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { ROLE_LABELS } from "@/domain/roles";
import { createUserAction, type UserActionState } from "./actions";

const INIT: UserActionState = { ok: false, message: "" };

export function CreateUserForm() {
  const [state, action] = useActionState(createUserAction, INIT);
  useEffect(() => {
    if (state.message) (state.ok ? toast.success : toast.error)(state.message);
  }, [state]);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="name">Nama</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="role">Peran</Label>
        <Select id="role" name="role" defaultValue={Role.DOSEN}>
          {Object.entries(ROLE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Kata sandi sementara</Label>
        <Input id="password" name="password" type="text" minLength={8} required />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit">
          <UserPlus className="size-4" /> Tambah Pengguna
        </Button>
      </div>
    </form>
  );
}
