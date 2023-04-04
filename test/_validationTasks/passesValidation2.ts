import { Task } from "../../src";

const task = new Task({
  name: 'invalidTask',
  description: 'testDescription',
  slug: 'validTask2',
  validate: () => { return { valid: true } },
  run: () => { return 3 },
})

export default task;
