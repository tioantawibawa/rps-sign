export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface SignedUrlOptions {
  /** Time to live in seconds. */
  ttl?: number;
  /** Force download with this filename (Content-Disposition: attachment). */
  downloadFilename?: string;
  /** Inline display (e.g. PDF viewer). Ignored when downloadFilename is set. */
  inline?: boolean;
}

export interface StorageDriver {
  putObject(input: PutObjectInput): Promise<{ key: string; size: number }>;
  getObject(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
  objectExists(key: string): Promise<boolean>;
}
