import { AsyncLocalStorage } from "node:async_hooks";
import type { ApplicationLogger } from "./application-logger.types.js";

export type RequestLogContext = {
  requestId: string;
  logger: ApplicationLogger;
};

const requestLogContextStorage = new AsyncLocalStorage<RequestLogContext>();

export function runWithRequestLogContext<T>(context: RequestLogContext, callback: () => T): T {
  return requestLogContextStorage.run(context, callback);
}

export function getRequestLogContext(): RequestLogContext | undefined {
  return requestLogContextStorage.getStore();
}

export function getRequestLogger(): ApplicationLogger | undefined {
  return requestLogContextStorage.getStore()?.logger;
}
