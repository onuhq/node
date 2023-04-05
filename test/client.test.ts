import { OnuClient, Task } from '../src';
const pkg = require('../package.json');
jest.mock('http')


describe('OnuClient', () => {
  test('Returns an onu Task', async () => {
    const client = new OnuClient({
      onuPath: __dirname + '/_testTasks',
      apiKey: 'test',
    })
    await client.init()
    expect(Object.keys(client.tasks).length).toBe(3);
  });


  test('Handles a list request', async () => {
    const client = new OnuClient({
      onuPath: __dirname + '/_testTasks',
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
      onuPath: __dirname + '/_testTasks',
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

    const task: Task = client.tasks['test-slug'];
    const expectedResponse = {
      name: task.name,
      description: task.description,
      slug: 'test-slug',
      owner: task.owner,
      input: task.input,
    }

    expect(res.end).toBeCalledWith(JSON.stringify({
      task: expectedResponse,
      version: pkg.version,
      sdk: 'nodejs'
    }));

  });

  test('Handles a run request', async () => {
    const client = new OnuClient({
      onuPath: __dirname + '/_testTasks',
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
      onuPath: __dirname + '/_testTasks',
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
      onuPath: __dirname + '/_testTasks',
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

  test('Returns a 200 on a successful healthcheck', async () => {
    const client = new OnuClient({
      onuPath: __dirname + '/_testTasks',
      apiKey: 'test',
    })

    const res = {
      statusCode: 0,
      end: jest.fn(),
      setHeader: jest.fn(),
    }

    const req = {
      headers: {
        'host': 'test.com',
      },
      url: 'http://test.com/healthcheck',
      method: 'GET'
    }

    // @ts-ignore
    await client.handleRequest(req, res)

    // @ts-ignore
    expect(res.statusCode).toBe(200);

    expect(res.end).toBeCalledWith("200 OK");
  });


  test('Returns a 500 on an unsuccessful healthcheck', async () => {
    const client = new OnuClient({
      onuPath: __dirname + '/badPath',
      apiKey: 'test',
    })

    const res = {
      statusCode: 0,
      end: jest.fn(),
      setHeader: jest.fn(),
    }

    const req = {
      headers: {
        'host': 'test.com',
      },
      url: 'http://test.com/healthcheck',
      method: 'GET'
    }


    // @ts-ignore
    await expect(client.handleRequest(req, res)).rejects.toThrow(Error);

  });

  test('Returns a 404 if the task is not found', async () => {
    const client = new OnuClient({
      onuPath: __dirname + '/_testTasks',
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

  test('Returns a 422 if the task does not pass validation', async () => {
    const client = new OnuClient({
      onuPath: __dirname + '/_validationTasks',
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
      url: 'http://test.com/?action=run&slug=invalidTask',
      method: 'POST',
      body: {
        _onu__input: {},
        _onu__executionId: 'test',
      }
    }

    // @ts-ignore
    await client.handleRequest(req, res)
    expect(res.statusCode).toBe(422);

    expect(res.end).toBeCalledWith(JSON.stringify({
      error: 'invalid_input',
      version: pkg.version,
      sdk: 'nodejs'
    }));
  });

  test('Returns a 422 and validation errors if the task does not pass validation', async () => {
    const client = new OnuClient({
      onuPath: __dirname + '/_validationTasks',
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
      url: 'http://test.com/?action=run&slug=invalidTaskWithErrors',
      method: 'POST',
      body: {
        _onu__input: {},
        _onu__executionId: 'test',
      }
    }

    // @ts-ignore
    await client.handleRequest(req, res)
    expect(res.statusCode).toBe(422);

    expect(res.end).toBeCalledWith(JSON.stringify({
      error: 'invalid_input',
      errors: [
        "You must provide a first name",
        "another error"
      ],
      version: pkg.version,
      sdk: 'nodejs'
    }));
  });

  test('Handles a run request with validation', async () => {
    const client = new OnuClient({
      onuPath: __dirname + '/_validationTasks',
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
      url: 'https://test.com/?action=run&slug=validTask',
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

  test('Handles a run request with a valid ValidationResponse', async () => {
    const client = new OnuClient({
      onuPath: __dirname + '/_validationTasks',
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
      url: 'https://test.com/?action=run&slug=validTask2',
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
});
