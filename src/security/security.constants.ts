export const SAFE_HTTP_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const CORS_ALLOWED_METHODS = [
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
] as const;

export const CORS_ALLOWED_HEADERS = [
  "Authorization",
  "Content-Type",
  "X-Request-ID",
  "X-CSRF-Token",
] as const;

export const CORS_EXPOSED_HEADERS = [
  "X-Request-ID",
  "RateLimit",
  "RateLimit-Policy",
  "Retry-After",
] as const;

export const JSON_MEDIA_TYPES = ["application/json"] as const;
