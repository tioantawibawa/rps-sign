/** Domain error types mapped to HTTP responses by the API layer. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Permintaan tidak valid", code = "BAD_REQUEST") {
    super(message, 400, code);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Tidak terautentikasi") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Anda tidak memiliki akses untuk tindakan ini") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Data tidak ditemukan") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message = "Konflik status data", code = "CONFLICT") {
    super(message, 409, code);
  }
}

export class UnprocessableError extends AppError {
  constructor(message = "Tidak dapat diproses", code = "UNPROCESSABLE") {
    super(message, 422, code);
  }
}
