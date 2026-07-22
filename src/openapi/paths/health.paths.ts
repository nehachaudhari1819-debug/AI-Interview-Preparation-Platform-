import type { PathItemObject } from "../openapi.types.js";

export const healthPaths: Record<string, PathItemObject> = {
  "/health": {
    get: {
      tags: ["Operational"],
      summary: "Liveness probe",
      description: "Returns a 200 OK status if the application process is running.",
      operationId: "getHealth",
      responses: {
        "200": { $ref: "#/components/responses/LivenessSuccess" },
      },
    },
  },
  "/health/ready": {
    get: {
      tags: ["Operational"],
      summary: "Readiness probe",
      description:
        "Returns a 200 OK status if the application is ready to accept traffic. Returns 503 if unavailable.",
      operationId: "getHealthReady",
      responses: {
        "200": { $ref: "#/components/responses/ReadinessSuccess" },
        "503": { $ref: "#/components/responses/ReadinessServiceUnavailable" },
      },
    },
  },
};
