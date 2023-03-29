import { Task } from "../../../src";

const task = new Task({
  name: 'testTask1',
  description: 'testDescription',
  slug: 'test-slug-2',
  run: () => { return 2 },
})

export default task;
