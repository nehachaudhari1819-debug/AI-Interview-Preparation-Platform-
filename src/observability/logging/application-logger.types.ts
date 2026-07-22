import type { Bindings, Logger } from "pino";

export type ApplicationLogger = Pick<
  Logger,
  "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent" | "child" | "flush"
>;

export type LoggerBindings = Readonly<Bindings>;
