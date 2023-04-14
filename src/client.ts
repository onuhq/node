import { IncomingMessage, Server, ServerResponse, createServer } from "http";
import { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import fse from 'fs-extra';
import path from 'path';
import { ClientOptions, RunContext, ValidationResponse } from "./types";
import { Task } from "./task";
const pkg = require('../package.json');

const ACTIONS = {
  LIST: 'list',
  RUN: 'run',
  INFO: 'info',
};

const HttpStatusCode = {
  Ok: 200,
  MethodNotAllowed: 405,
  Unauthorized: 401,
  NotFound: 404,
  BadRequest: 400,
  Forbidden: 403,
  UnprocessableEntity: 422,
};

interface Tasks {
  [key: string]: Task;
}


export class OnuClient {
  onuPath: string;
  tasks: Tasks = {};
  #port: number;
  #serverPath: string;
  #sdkVersion: string = pkg.version;
  #sdk: string = "nodejs";
  #baseApiResponse = {
    version: this.#sdkVersion,
    sdk: this.#sdk,
  }
  #apiKey: string;
  #context: RunContext = {
    executionId: '',
  }
  #useAuth: boolean = false;
  #authenticator: (req: IncomingMessage | ExpressRequest) => Promise<boolean> | boolean = (req: IncomingMessage | ExpressRequest) => {
    return true
  }

  app: Server = createServer(async (req: IncomingMessage, res: ServerResponse) => {

    if (!req.url) {
      res.statusCode = HttpStatusCode.Forbidden;
      res.end();
      return;
    }

    const authenticated = this.#useAuth ? await this.#authenticator(req) : true;

    const url = new URL(req.url, `http://${req.headers.host}`);
    if (!authenticated && url.pathname !== '/healthcheck') {
      res.statusCode = HttpStatusCode.Unauthorized;
      res.end();
      return;
    }

    switch (url.pathname) {
      case '/healthcheck':
        this.handleRequest(req, res);
        break;
      case `/${this.#serverPath}`:
        this.handleRequest(req, res);
        break;
      default:
        res.statusCode = HttpStatusCode.Forbidden;
        res.end();
        break;
    }
  });

  constructor(config: ClientOptions) {
    this.onuPath = config.onuPath;
    this.#apiKey = config.apiKey;
    this.#port = config.serverPort || 8080;
    this.#authenticator = config.authenticator || this.#authenticator;
    this.#serverPath = config.serverPath || '';
    if (this.#serverPath.startsWith('/')) {
      this.#serverPath = this.#serverPath.slice(1);
    }
  }

  #determineIfIsExpressRequest(req: IncomingMessage | ExpressRequest): req is ExpressRequest {
    return (req as ExpressRequest).body !== undefined;
  }

  async init() {
    await this.#walkFilesRecursive(this.onuPath, true);
  }

  async #walkFilesRecursive(dir: string, initialRun: boolean = false) {
    try {
      const files = await fse.readdir(dir, { withFileTypes: true });
      const filteredFiles = files.filter((file) => {
        if (initialRun) {
          return file.name !== 'index.ts' && file.name !== 'index.js' && file.name !== '_onuHandler.ts' && file.name !== '_onuHandler.js';
        }
        return true;
      });

      for (const file of filteredFiles) {
        if (file.isDirectory()) {
          const newPath = path.join(dir, file.name);
          await this.#walkFilesRecursive(newPath);
        }

        if (file.name.toLowerCase().endsWith('.ts') || file.name.toLowerCase().endsWith('.js')) {
          // Removes '.js' from the end of the file name
          const filename = file.name.slice(0, -3);
          // In debug mode only - if the path already exists in the require cache, delete it
          if (require.cache[require.resolve(path.join(dir, filename))] && process.env.ONU_INTERNAL__DEBUG_MODE === 'true') {
            delete require.cache[require.resolve(path.join(dir, `${filename}`))];
          }
          const mod = await require(path.join(dir, filename))
          const task = mod.default as Task;
          if (!task) {
            // log an error and skip it
            console.warn(`No default Task export found in ${path.join(dir, filename)}`);
            continue;
          }
          this.tasks[task.slug] = task;
        }
      }
    } catch (e: any) {
      throw new Error(`Error loading tasks: ${e.message}`);
    }

  }

  #determineIfIsValidationResponse(response: boolean | ValidationResponse): response is ValidationResponse {
    return (response as ValidationResponse).valid !== undefined;
  }

  #resetEnv() {
    process.env.ONU_INTERNAL__EXECUTION_ID = "";
  }

  async #runTask(res: ServerResponse, slug: string | null, data: any) {
    if (!slug) {
      res.statusCode = HttpStatusCode.BadRequest;
      res.end(JSON.stringify({ error: 'missing_task_slug', ...this.#baseApiResponse }));
      return;
    }
    // get the task from the tasks object
    const task = this.tasks[slug];

    if (!task) {
      res.statusCode = HttpStatusCode.NotFound;
      res.end(JSON.stringify({ error: 'no_task_found', ...this.#baseApiResponse }));
      return;
    }

    const input = data._onu__input;
    const executionId = data._onu__executionId;

    if (!executionId) {
      res.statusCode = HttpStatusCode.BadRequest;
      res.end(JSON.stringify({ error: 'missing_execution_id', ...this.#baseApiResponse }));
      return;
    }

    const context: RunContext = {
      executionId: executionId,
    }
    // Set the env for this task run
    process.env.ONU_INTERNAL__API_KEY = this.#apiKey || "";
    process.env.ONU_INTERNAL__DEBUG_MODE = "false"
    process.env.ONU_INTERNAL__EXECUTION_ID = executionId;
    const validationResponse = task.validate ? await task.validate(input || {}, context) : true;
    if (this.#determineIfIsValidationResponse(validationResponse)) {
      const { valid, errors } = validationResponse;
      if (!valid) {
        this.#resetEnv();
        res.statusCode = HttpStatusCode.UnprocessableEntity;
        res.end(JSON.stringify({ error: 'invalid_input', errors: errors || [], ...this.#baseApiResponse }));
        return;
      }
      // ensure that the validation response is a boolean
    } else if (typeof validationResponse === 'boolean') {
      if (!validationResponse) {
        this.#resetEnv();
        res.statusCode = HttpStatusCode.UnprocessableEntity;
        res.end(JSON.stringify({ error: 'invalid_input', ...this.#baseApiResponse }));
        return;
      }
    } else {
      this.#resetEnv();
      res.statusCode = HttpStatusCode.UnprocessableEntity;
      res.end(JSON.stringify({ error: 'invalid_validation', errors: ['Received unexpected response from validation function'], ...this.#baseApiResponse }));
    }


    // run the task
    try {
      const resp = await task.run(input || {}, context);
      this.#resetEnv();
      res.statusCode = HttpStatusCode.Ok;
      res.end(JSON.stringify({ response: resp, ...this.#baseApiResponse }));
    } catch (error: any) {
      this.#resetEnv();
      res.statusCode = HttpStatusCode.BadRequest;
      res.end(JSON.stringify({ error: error.message, ...this.#baseApiResponse }));
    }
    this.#resetEnv();
    return
  }

  async handleRequest(req: IncomingMessage | ExpressRequest, res: ServerResponse | ExpressResponse) {
    // Initialize the tasks if they haven't been initialized yet
    if (Object.keys(this.tasks).length === 0) {
      await this.init();
    }

    if (!req.url) {
      res.statusCode = HttpStatusCode.Unauthorized;
      res.end(JSON.stringify({ response: 'Unauthorized' }));
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === '/healthcheck') {
      res.statusCode = HttpStatusCode.Ok;
      res.end("200 OK");
      return;
    }

    if (!req.headers['onu-signature'] || !req.url) {
      // Only allow access from cloud tasks
      res.statusCode = HttpStatusCode.Unauthorized;
      res.end(JSON.stringify({ response: 'Unauthorized' }));
      return;
    }
    const action = url.searchParams.get('action');
    if (!action) {
      res.statusCode = HttpStatusCode.NotFound;
      res.end(JSON.stringify({ error: 'no_action_found', ...this.#baseApiResponse }));
      return;
    }

    // Handle the request
    if (req.method === 'GET') {
      switch (action) {
        case ACTIONS.LIST:
          // return metadata about all tasks
          // metadata should include: name, description, fileName
          const metadata = Object.keys(this.tasks).map((slug) => {
            const task: Task = this.tasks[slug];
            return {
              name: task.name,
              description: task.description,
              slug: task.slug,
              owner: task.owner,
              input: task.input,
            }
          })
          res.statusCode = HttpStatusCode.Ok;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ tasks: metadata, ...this.#baseApiResponse }));
          break;
        // handle getting the information for one specific task
        case ACTIONS.INFO:
          // get the task name from the query string
          const slug = url.searchParams.get('slug');
          // if there is no task name, return a 404
          if (!slug) {
            res.statusCode = HttpStatusCode.NotFound;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'missing_task_slug', ...this.#baseApiResponse }));
            return;
          }
          const task = this.tasks[slug];

          if (!task) {
            res.statusCode = HttpStatusCode.NotFound;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'no_task_found', ...this.#baseApiResponse }));
            return;
          }

          const taskInfo = {
            name: task.name,
            description: task.description,
            slug: task.slug,
            owner: task.owner,
            input: task.input,
          }
          // return the task information
          res.statusCode = HttpStatusCode.Ok;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ task: taskInfo, ...this.#baseApiResponse }));
          break;
        default:

          res.statusCode = HttpStatusCode.NotFound;
          res.end(JSON.stringify({ error: Object.values(ACTIONS).includes(action) ? 'invalid_action' : 'unrecognized_action', ...this.#baseApiResponse }));
          break;
      }
    } else if (req.method === 'POST') {
      switch (action) {
        case 'run':
          // if the request is an ExpressRequest, we may need to read the body
          // differently than if it is an IncomingMessage
          if (this.#determineIfIsExpressRequest(req)) {
            // read data from the request body
            const data = req.body;
            const slug = url.searchParams.get('slug');
            await this.#runTask(res, slug, data);
            return;
          }
          // read data from the request body
          let body = '';
          req.on('data', (chunk) => {
            body += chunk.toString();
          });
          req.on('end', async () => {
            const data = JSON.parse(body);
            const slug = url.searchParams.get('slug');
            await this.#runTask(res, slug, data);
          });
          break;
        default:
          res.statusCode = HttpStatusCode.NotFound;
          res.end(JSON.stringify({ error: Object.values(ACTIONS).includes(action) ? 'invalid_action' : 'unrecognized_action', ...this.#baseApiResponse }));
          break;
      }

    } else {
      res.statusCode = HttpStatusCode.MethodNotAllowed;
      res.end();
    }
  }

  initializeHttpServer() {
    this.#useAuth = true;
    this.app.listen(this.#port, () => {
      console.log(`⚡️[onu]: Onu server is running at http://localhost:${this.#port}`);
    });
  }
}
