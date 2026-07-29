export interface OpenApiDocument {
  openapi: string;
  info: {
    title: string;
    description?: string;
    version: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: PathsObject;
  components?: ComponentsObject;
}

export type PathsObject = Record<string, PathItemObject>;

export interface PathItemObject {
  summary?: string;
  description?: string;
  get?: OperationObject;
  put?: OperationObject;
  post?: OperationObject;
  delete?: OperationObject;
  options?: OperationObject;
  head?: OperationObject;
  patch?: OperationObject;
  trace?: OperationObject;
  parameters?: Array<ParameterObject | ReferenceObject>;
}

export interface OperationObject {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: Array<ParameterObject | ReferenceObject>;
  requestBody?: RequestBodyObject;
  responses: ResponsesObject;
  security?: SecurityRequirementObject[];
}

export interface ParameterObject {
  name: string;
  in: "query" | "header" | "path" | "cookie";
  description?: string;
  required?: boolean;
  schema?: SchemaObject | ReferenceObject;
}

export interface RequestBodyObject {
  description?: string;
  content: Record<string, MediaTypeObject>;
  required?: boolean;
}

export interface ResponsesObject {
  [statusCode: string]: ResponseObject | ReferenceObject;
  default?: ResponseObject | ReferenceObject;
}

export interface ResponseObject {
  description: string;
  headers?: Record<string, HeaderObject | ReferenceObject>;
  content?: Record<string, MediaTypeObject>;
}

export interface HeaderObject {
  description?: string;
  required?: boolean;
  schema?: SchemaObject | ReferenceObject;
}

export interface ExampleObject {
  summary?: string;
  description?: string;
  value?: unknown;
  externalValue?: string;
}

export interface MediaTypeObject {
  schema?: SchemaObject | ReferenceObject;
  example?: unknown;
  examples?: Record<string, ExampleObject | ReferenceObject>;
}

export interface SchemaObject {
  type?: "string" | "number" | "integer" | "boolean" | "array" | "object" | "null";
  format?: string;
  nullable?: boolean;
  description?: string;
  properties?: Record<string, SchemaObject | ReferenceObject>;
  required?: string[];
  items?: SchemaObject | ReferenceObject;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  minProperties?: number;
  maxProperties?: number;
  additionalProperties?: boolean | SchemaObject | ReferenceObject;
  enum?: unknown[];
  oneOf?: Array<SchemaObject | ReferenceObject>;
  anyOf?: Array<SchemaObject | ReferenceObject>;
  allOf?: Array<SchemaObject | ReferenceObject>;
  example?: unknown;
  pattern?: string;
  default?: unknown;
}

export interface ReferenceObject {
  $ref: string;
}

export interface SecurityRequirementObject {
  [name: string]: string[];
}

export interface ComponentsObject {
  schemas?: Record<string, SchemaObject | ReferenceObject>;
  responses?: Record<string, ResponseObject | ReferenceObject>;
  parameters?: Record<string, ParameterObject | ReferenceObject>;
  requestBodies?: Record<string, RequestBodyObject | ReferenceObject>;
  headers?: Record<string, HeaderObject | ReferenceObject>;
  securitySchemes?: Record<string, SecuritySchemeObject | ReferenceObject>;
}

export type SecuritySchemeObject =
  HttpSecurityScheme | ApiKeySecurityScheme | OAuth2SecurityScheme | OpenIdConnectSecurityScheme;

export interface HttpSecurityScheme {
  type: "http";
  description?: string;
  scheme: string;
  bearerFormat?: string;
}

export interface ApiKeySecurityScheme {
  type: "apiKey";
  description?: string;
  name: string;
  in: "query" | "header" | "cookie";
}

export interface OAuth2SecurityScheme {
  type: "oauth2";
  description?: string;
  flows: unknown;
}

export interface OpenIdConnectSecurityScheme {
  type: "openIdConnect";
  description?: string;
  openIdConnectUrl: string;
}
