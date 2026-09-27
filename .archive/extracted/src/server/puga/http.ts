export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(data: unknown, status = 200, extra?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extra,
    },
  });
}

export function apiErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return json(
      { error: { code: error.code, message: error.message } },
      error.status,
    );
  }
  console.error("[pugaai] unhandled", error instanceof Error ? error.message : "error");
  return json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "The service is temporarily unavailable. Please try again shortly.",
      },
    },
    500,
  );
}

export function bearer(request: Request): string {
  const header = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

const attempts = new Map<string, { count: number; resetAt: number }>();

export function assertRateLimit(key: string, limit = 8, windowMs = 15 * 60 * 1000): void {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  current.count += 1;
  if (current.count > limit) {
    throw new ApiError(429, "RATE_LIMITED", "Too many attempts. Please wait and try again.");
  }
}
