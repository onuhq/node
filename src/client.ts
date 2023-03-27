import { IncomingMessage, ServerResponse, createServer } from "http";
import {Request as ExpressRequest, Response as ExpressResponse} from 'express';
import fse from 'fs-extra';
import path from 'path';
import { ClientOptions, RunContext } from "./types";
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
};


export class OnuClient {
  onuPath: string;
  tasks: any = {};
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

  constructor(config: ClientOptions) {
    this.onuPath = config.onuPath;
    this.#apiKey = config.apiKey;
    this.#port = config.serverPort || 3000;
    this.#serverPath = config.serverPath || '';
    if (this.#serverPath.startsWith('/')) {
      this.#serverPath = this.#serverPath.slice(1);
    }
  }

  determineIfIsExpressRequest(req: IncomingMessage | ExpressRequest): req is ExpressRequest {
    return (req as ExpressRequest).body !== undefined;
  }

  async init() {
    fse.readdirSync(this.onuPath)
      .filter(file => file !== 'index.ts' && file !== 'index.js')
      .forEach(async (file) => {
        if (file.toLowerCase().endsWith('.ts') || file.toLowerCase().endsWith('.js')) {
          // Removes '.js' from the property name
          const [filename] = file.split('.')
          const mod = await require(path.join(this.onuPath, filename))
          const task = mod.default as Task;
          this.tasks[task.slug] = task;
        }
      });
  }

  async runTask(res: ServerResponse, slug: string | null, data: any) {
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

    
    // run the task
    try {
      const resp = await task.run(input || {}, context);
      res.statusCode = HttpStatusCode.Ok;
      res.end(JSON.stringify({ response: resp, ...this.#baseApiResponse }));
    } catch (error: any) {
      res.statusCode = HttpStatusCode.BadRequest;
      res.end(JSON.stringify({ error: error.message, ...this.#baseApiResponse }));
    }
    
    return
  }

  async handleRequest(req: IncomingMessage | ExpressRequest, res: ServerResponse | ExpressResponse) {
    // Initialize the tasks if they haven't been initialized yet
    if (Object.keys(this.tasks).length === 0) {
      await this.init();
    }

    if (!req.headers['onu-signature'] || !req.url) {
      // Only allow access from cloud tasks
      res.statusCode = HttpStatusCode.Unauthorized;
      res.end(JSON.stringify({ response: 'Unauthorized' }));
      return;
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
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
          if (this.determineIfIsExpressRequest(req)) {
            // read data from the request body
            const data = req.body;
            const slug = url.searchParams.get('slug');
            await this.runTask(res, slug, data);
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
            await this.runTask(res, slug, data);
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
    this.init().then(() => {
      const server = createServer((req: IncomingMessage, res: ServerResponse) => {
        if (!req.url) {
          res.statusCode = HttpStatusCode.NotFound;
          res.end();
          return;
        }
        const url = new URL(req.url, `http://${req.headers.host}`);

        switch (url.pathname) {
          case `/${this.#serverPath}`:
            this.handleRequest(req, res);
            break;
          default:
            res.statusCode = HttpStatusCode.NotFound;
            res.end();
            break;
        }
      });
      server.listen(this.#port, () => {
        console.log(`⚡️[onu]: Onu server is running at http://localhost:${this.#port}`);
      });
    });
  }
}
