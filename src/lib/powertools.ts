import { Logger } from "@aws-lambda-powertools/logger";
import { Tracer } from "@aws-lambda-powertools/tracer";
import middy from "@middy/core";
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";

export const logger = new Logger({
  serviceName: process.env.POWERTOOLS_SERVICE_NAME ?? "agentbase",
  logLevel: (process.env.LOG_LEVEL as "INFO" | "DEBUG" | "WARN" | "ERROR") ?? "INFO",
});

export const tracer = new Tracer({
  serviceName: process.env.POWERTOOLS_SERVICE_NAME ?? "agentbase",
});

export function createMiddyHandler<TEvent, TResult>(
  handler: (event: TEvent) => Promise<TResult>,
) {
  return middy(handler)
    .use(injectLambdaContext(logger, { clearState: true }))
    .use(captureLambdaHandler(tracer));
}
