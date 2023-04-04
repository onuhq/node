import { IndexedField, RunContext, TaskOptions, ValidationResponse } from "./types";

export class Task {
  name: string;
  description: string;
  slug: string;
  owner?: string;
  run: (input: any, ctx: RunContext) => Promise<any> | any;
  validate?: (input: any, ctx: RunContext) => Promise<boolean | ValidationResponse> | boolean | ValidationResponse;
  input: IndexedField;

  constructor(config: TaskOptions) {
    this.name = config.name;
    this.description = config.description || '';
    this.slug = config.slug;
    this.owner = config.owner;
    this.input = config.input || {};
    this.run = config.run;
    this.validate = config.validate;
  }
}
