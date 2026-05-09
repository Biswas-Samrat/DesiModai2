import pino from "pino";
import { getEnv } from "./env.js";

export const logger = pino({
  level: getEnv().PINO_LOG_LEVEL,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime
});
