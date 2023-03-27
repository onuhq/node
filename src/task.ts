import { IndexedField, RunContext, TaskOptions } from "./types";

export class Task {
  name: string;
  description: string;
  slug: string;
  owner?: string;
  run: (input: any, ctx: RunContext) => void;
  input: IndexedField;

  constructor(config: TaskOptions) {
    this.name = config.name;
    this.description = config.description || '';
    this.slug = config.slug;
    this.owner = config.owner;
    this.input = config.input || {};
    this.run = config.run;
  }
}
