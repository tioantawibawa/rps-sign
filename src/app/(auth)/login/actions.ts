"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/server/auth";

export interface LoginState {
  error: string | null;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
    return { error: null };
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Email atau kata sandi salah, atau akun tidak aktif." };
    }
    // Re-throw redirect (NEXT_REDIRECT) and other framework errors.
    throw err;
  }
}
