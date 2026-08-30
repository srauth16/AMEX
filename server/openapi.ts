export const openApiDocument = {
  openapi: "3.1.0",
  info: { title: "Feature Flag Manager API", version: "1.0.0" },
  servers: [{ url: "/api/v1" }],
  paths: {
    "/flags": {
      get: {
        summary: "List feature flags",
        parameters: [
          { name: "q", in: "query", schema: { type: "string", maxLength: 200 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 0, maximum: 100, default: 50 } },
          { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
        ],
        responses: { "200": { description: "A page of flags" } },
      },
      post: {
        summary: "Create a feature flag",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateFlag" } } } },
        responses: { "201": { description: "Created" }, "400": { $ref: "#/components/responses/Error" }, "409": { $ref: "#/components/responses/Error" } },
      },
    },
    "/flags/{id}": {
      patch: {
        summary: "Set a feature flag's enabled state",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: false, required: ["enabled"], properties: { enabled: { type: "boolean" } } } } } },
        responses: { "200": { description: "Updated" }, "404": { $ref: "#/components/responses/Error" } },
      },
    },
  },
  components: {
    schemas: {
      CreateFlag: {
        type: "object", additionalProperties: false, required: ["name", "key", "description", "enabled"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 120 },
          key: { type: "string", minLength: 1, maxLength: 80, pattern: "^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$" },
          description: { type: "string", maxLength: 500 }, enabled: { type: "boolean" },
        },
      },
    },
    responses: { Error: { description: "Structured API error" } },
  },
} as const;
