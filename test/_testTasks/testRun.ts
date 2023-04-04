import { Task } from "../../src";

const task = new Task({
  name: 'testTask',
  description: 'testDescription',
  slug: 'test-slug',
  run: () => { return 3 },
})

export default task;
