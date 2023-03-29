import { Task } from "../../../../src";

const task = new Task({
  name: 'testTask1',
  description: 'testDescription',
  slug: 'test-slug-3',
  run: () => { return 3 },
})

export default task;
