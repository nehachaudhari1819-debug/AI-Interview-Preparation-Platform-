import type { SchemaObject, ResponseObject } from "../openapi.types.js";

const livenessResponseSchema: SchemaObject = {
  type: "object",
  required: ["status"],
  properties: {
    status: {
      type: "string",
      enum: ["ok"],
      example: "ok",
    },
  },
};

const readinessReadyResponseSchema: SchemaObject = {
  type: "object",
  required: ["status", "state", "uptime"],
  properties: {
    status: {
      type: "string",
      enum: ["ready"],
      example: "ready",
    },
    state: {
      type: "string",
      description: "The application lifecycle state.",
      example: "ready",
    },
    uptime: {
      type: "number",
      description: "Milliseconds since the application entered the ready state.",
      example: 12500,
    },
  },
};

const readinessUnavailableResponseSchema: SchemaObject = {
  type: "object",
  required: ["status", "state"],
  properties: {
    status: {
      type: "string",
      enum: ["unavailable"],
      example: "unavailable",
    },
    state: {
      type: "string",
      description: "The application lifecycle state.",
      example: "shutting_down",
    },
  },
};

const readinessResponseSchema: SchemaObject = {
  oneOf: [
    { $ref: "#/components/schemas/ReadinessReadyResponse" },
    { $ref: "#/components/schemas/ReadinessUnavailableResponse" },
  ],
};

export const healthSchemas: Record<string, SchemaObject> = {
  LivenessResponse: livenessResponseSchema,
  ReadinessReadyResponse: readinessReadyResponseSchema,
  ReadinessUnavailableResponse: readinessUnavailableResponseSchema,
  ReadinessResponse: readinessResponseSchema,
};

export const healthResponses: Record<string, ResponseObject> = {
  LivenessSuccess: {
    description: "The application is alive.",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/LivenessResponse" },
      },
    },
  },
  ReadinessSuccess: {
    description: "The application is ready to receive traffic.",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ReadinessReadyResponse" },
      },
    },
  },
  ReadinessServiceUnavailable: {
    description: "The application is not ready to receive traffic.",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ReadinessUnavailableResponse" },
      },
    },
  },
};
