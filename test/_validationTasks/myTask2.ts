import { Task } from "../../src";

const task = new Task({
  name: 'invalidTask',
  description: 'testDescription',
  slug: 'invalidTaskWithErrors',
  validate: () => { return { valid: false, errors: ['You must provide a first name', 'another error'] } },
  run: () => { return 3 },
})

export default task;
