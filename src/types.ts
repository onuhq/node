export interface RunContext {
  executionId: string;
}

export interface ClientOptions {
  /**
   * Path from the root of the project to the folder containing the tasks. This will usually be `__dirname`.
   */
  onuPath: string;
  apiKey: string;
  /**
   * If running Onu using .initializeHttpServer(), this is the port that the server will run on. Defaults to 8080.
   */
  serverPort?: number;
  /**
   * If running Onu using .initializeHttpServer(), this is the endpoint that the server will run on, e.g. '/api/onuEntrypoint'. Defaults to '/'.
   */
  serverPath?: string;
}

export interface Field {
  name: string;
  type: "string" | "text" | "number" | "boolean" | "select" | "csv" | "email";
  description?: string;
  options?: Array<string>;
  required?: boolean;
}
export type IndexedField = Record<string, Field>

export interface ValidationResponse {
  valid: boolean;
  errors?: Array<string>;
}

export interface TaskOptions {
  name: string;
  description?: string;
  slug: string;
  owner?: string;
  run: (input: any, ctx: RunContext) => Promise<any> | any;
  validate?: (input: any, ctx: RunContext) => Promise<boolean | ValidationResponse> | boolean | ValidationResponse;
  input?: IndexedField;
}
