import { Task } from "../../src";

const task = new Task({
  name: 'invalidTask',
  description: 'testDescription',
  slug: 'validTask',
  validate: () => { return true },
  run: () => { return 3 },
})

export default task;
