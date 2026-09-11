import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import type { PutObjectInput, StorageDriver } from "./types";

/**
 * Filesystem-backed storage for local development (no Docker required).
 * Keys are namespaced paths; traversal is prevented by normalising the key.
 */
export class LocalStorageDriver implements StorageDriver {
  private readonly root: string;

  constructor(root = env.STORAGE_LOCAL_DIR) {
    this.root = path.resolve(process.cwd(), root);
  }

  private resolve(key: string): string {
    const safe = path
      .normalize(key)
      .replace(/^([/\\]|\.\.[/\\])+/, "")
      .replace(/\.\.(?=[/\\]|$)/g, "");
    const full = path.resolve(this.root, safe);
    if (!full.startsWith(this.root)) {
      throw new Error("Invalid storage key (path traversal)");
    }
    return full;
  }

  async putObject(input: PutObjectInput) {
    const full = this.resolve(input.key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, input.body);
    return { key: input.key, size: input.body.byteLength };
  }

  async getObject(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async deleteObject(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await stat(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}
