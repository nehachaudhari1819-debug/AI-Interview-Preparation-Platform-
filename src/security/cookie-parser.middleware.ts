import cookieParser from "cookie-parser";
import type { RequestHandler } from "express";

export const cookieParserMiddleware: RequestHandler = cookieParser();
