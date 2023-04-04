import { Task } from "../../src";

const task = new Task({
  name: 'invalidTask',
  description: 'testDescription',
  slug: 'invalidTask',
  validate: () => { return false },
  run: () => { return 3 },
})

export default task;
