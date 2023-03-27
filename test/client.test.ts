import { OnuClient, Task } from '../src';
const pkg = require('../package.json');
jest.mock('http')


describe('OnuClient', () => {
  test('Returns an onu Task', async () => {
    const client = new OnuClient({
      onuPath: __dirname + '/testTasks',
      apiKey: 'test',
    })
    await client.init()
    expect(Object.keys(client.tasks).length).toBe(1);
  });


  test('Handles a list request', async () => {
    const client = new OnuClient({
      onuPath: __dirname + '/testTasks',
      apiKey: 'test',
    })

    const res = {
      statusCode: 0,
      end: jest.fn(),
      setHeader: jest.fn(),

    }

    const req = {
      headers: {
        'onu-signature': 'test',
        'host': 'test.com',
      },
      url: 'http://test.com/?action=list',
      method: 'GET',
    }

    // @ts-ignore
    await client.handleRequest(req, res)
    expect(res.statusCode).toBe(200);
    const metadata = Object.keys(client.tasks).map((slug) => {
      const task: Task = client.tasks[slug];
      return {
        name: task.name,
        description: task.description,
        slug: slug,
        owner: task.owner,
        input: task.input,
      }
    })
    expect(res.end).toBeCalledWith(JSON.stringify({
      tasks: metadata,
      version: pkg.version,
      sdk: 'nodejs'
    }));

  });

  test('Handles an info request', async () => {
    const client = new OnuClient({
      onuPath: __dirname + '/testTasks',
      apiKey: 'test',
    })

    const res = {
      statusCode: 0,
      end: jest.fn(),
      setHeader: jest.fn(),

    }

    const req = {
      headers: {
        'onu-signature': 'test',
        'host': 'test.com',
      },
      url: 'http://test.com/?action=info&slug=test-slug',
      method: 'GET',
    }

    // @ts-ignore
    await client.handleRequest(req, res)
    expect(res.statusCode).toBe(200);
    const metadata = Object.keys(client.tasks).map((slug) => {
      const task: Task = client.tasks[slug];
      return {
        name: task.name,
        description: task.description,
        slug,
        owner: task.owner,
        input: task.input,
      }
    })

    expect(res.end).toBeCalledWith(JSON.stringify({
      task: metadata[0],
      version: pkg.version,
      sdk: 'nodejs'
    }));

  });

  test('Handles a run request', async () => {
    const client = new OnuClient({
      onuPath: __dirname + '/testTasks',
      apiKey: 'test',
    })

    const res = {
      statusCode: 0,
      end: jest.fn(),
      setHeader: jest.fn(),

    }

    const req = {
      headers: {
        'onu-signature': 'test',
        'host': 'test.com',
      },
      url: 'https://test.com/?action=run&slug=test-slug',
      method: 'POST',
      body: {
        _onu__input: {},
        _onu__executionId: 'test',
      }
    }

    // @ts-ignore
    await client.handleRequest(req, res)
    expect(res.statusCode).toBe(200);

    expect(res.end).toBeCalledWith(JSON.stringify({
      response: 3,
      version: pkg.version,
      sdk: 'nodejs'
    }));
  });

  it('Returns a 400 if the run request is missing an execution ID', async () => {
    const client = new OnuClient({
      onuPath: __dirname + '/testTasks',
      apiKey: 'test',
    })

    const res = {
      statusCode: 0,
      end: jest.fn(),
      setHeader: jest.fn(),

    }

    const req = {
      headers: {
        'onu-signature': 'test',
        'host': 'test.com',
      },
      url: 'https://test.com/?action=run&slug=test-slug',
      method: 'POST',
      body: {
        _onu__input: {},
      }
    }

    // @ts-ignore
    await client.handleRequest(req, res)
    expect(res.statusCode).toBe(400);

    expect(res.end).toBeCalledWith(JSON.stringify({
      error: "missing_execution_id",
      version: pkg.version,
      sdk: 'nodejs'
    }));
  });

  test('Returns a 400 if the run request is missing a name', async () => {
    const client = new OnuClient({
      onuPath: __dirname + '/testTasks',
      apiKey: 'test',
    })

    const res = {
      statusCode: 0,
      end: jest.fn(),
      setHeader: jest.fn(),

    }

    const req = {
      headers: {
        'onu-signature': 'test',
        'host': 'test.com',
      },
      url: 'http://test.com/?action=run',
      method: 'POST',
      body: {
        _onu__input: {},
      }
    }

    // @ts-ignore
    await client.handleRequest(req, res)
    expect(res.statusCode).toBe(400);

    expect(res.end).toBeCalledWith(JSON.stringify({
      error: 'missing_task_slug',
      version: pkg.version,
      sdk: 'nodejs'
    }));
  });

  test('Returns a 404 if the task is not found', async () => {
    const client = new OnuClient({
      onuPath: __dirname + '/testTasks',
      apiKey: 'test',
    })

    const res = {
      statusCode: 0,
      end: jest.fn(),
      setHeader: jest.fn(),
    }

    const req = {
      headers: {
        'onu-signature': 'test',
        'host': 'test.com',
      },
      url: 'http://test.com/?action=run&slug=chine',
      method: 'POST',
      body: {
        _onu__input: {},
      }
    }

    // @ts-ignore
    await client.handleRequest(req, res)
    expect(res.statusCode).toBe(404);

    expect(res.end).toBeCalledWith(JSON.stringify({
      error: 'no_task_found',
      version: pkg.version,
      sdk: 'nodejs'
    }));
  });
});
