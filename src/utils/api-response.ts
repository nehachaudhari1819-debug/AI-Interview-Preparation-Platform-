import type { Response } from "express";

import type {
  ApiCollectionResponse,
  ApiSuccessResponse,
  PaginationMeta,
} from "../types/api-response.types.js";

type SendSuccessOptions<T> = {
  response: Response;
  statusCode: number;
  data: T;
  message?: string;
  requestId: string;
};

type SendCollectionOptions<T> = SendSuccessOptions<T[]> & {
  pagination: PaginationMeta;
};

export function sendSuccess<T>(options: SendSuccessOptions<T>): Response {
  const body: ApiSuccessResponse<T> = {
    success: true,
    data: options.data,
    meta: {
      requestId: options.requestId,
    },
    ...(options.message === undefined ? {} : { message: options.message }),
  };

  return options.response.status(options.statusCode).json(body);
}

export function sendCollection<T>(options: SendCollectionOptions<T>): Response {
  const body: ApiCollectionResponse<T> = {
    success: true,
    data: options.data,
    meta: {
      requestId: options.requestId,
    },
    pagination: options.pagination,
    ...(options.message === undefined ? {} : { message: options.message }),
  };

  return options.response.status(options.statusCode).json(body);
}
