import { Task } from "../src";

describe('Task', () => {
  test('Returns an onu Task', async () => {
    const task = new Task({
      name: 'testTask',
      slug: 'test-slug',
      description: 'testDescription',
      run: () => { },
    })
    expect(task).toBeInstanceOf(Task);
  });

  it('does not require a description', async () => {
    const task = new Task({
      name: 'testTask',
      slug: 'test-slug',
      run: () => { },
    })
    expect(task).toBeInstanceOf(Task);
  });
});
