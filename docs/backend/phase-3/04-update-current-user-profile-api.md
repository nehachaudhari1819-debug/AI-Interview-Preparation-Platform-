# 04. Update Current User Profile API (Phase 3.4)

## Overview

This document specifies the implementation of the `PATCH /api/v1/users/me` endpoint. It provides authenticated users the ability to update their canonical profile.

## Endpoint

- **Method**: `PATCH`
- **Path**: `/api/v1/users/me`
- **Authentication**: Required (Valid Supabase JWT)
- **Authorization**: Must be an active user.

## Request Payload

The request accepts partial updates. Protected fields (e.g. `id`, `email`, `role`, `accountStatus`) and unknown fields are strictly rejected.

```json
{
  "fullName": "New Name", // 1-100 characters
  "college": "University", // nullable, <= 150 chars
  "branch": "Computer Science", // nullable, <= 100 chars
  "graduationYear": 2026, // nullable, 2000-2100
  "experienceLevel": "beginner", // nullable, fresher | beginner | intermediate | advanced
  "preferredRoles": ["role1"], // nullable, max 10 items, 1-50 chars each
  "bio": "My bio", // nullable, <= 500 chars
  "avatarUrl": "https://foo.com/a" // nullable, MUST be HTTPS
}
```

## Security Requirements

1. **Isolation**: Users can only update their own profile. The system resolves the target `userId` strictly from the verified JWT `sub` claim.
2. **RLS Integrity**: Database access leverages the `UserProfileRepository.updateOwnProfile` method using a context-aware Supabase client.
3. **Caching**: Responses include `Cache-Control: no-store` headers to prevent storing sensitive updates.
4. **Data Sanitization**: Empty or whitespace-only strings are automatically normalized to `null`.
5. **HTTPS Enforcement**: `avatarUrl` is strictly enforced to use `https://`.

## Responses

- `200 OK`: Successful update, returns mapped profile data.
- `401 Unauthorized`: Missing or invalid token.
- `404 Not Found`: Account does not exist or is hidden by RLS policies (e.g., suspended or deleted).
- `415 Unsupported Media Type`: Payload format is invalid.
- `422 Unprocessable Entity`: Schema validation failed (e.g. invalid fields, length violations, non-HTTPS URL).
