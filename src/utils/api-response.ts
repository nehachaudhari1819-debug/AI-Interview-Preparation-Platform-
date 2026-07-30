import type { Response } from "express";

import type {
  ApiCollectionResponse,
  ApiMetaCollectionResponse,
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
    pagination: options.pagination,
    meta: {
      requestId: options.requestId,
    },
    ...(options.message === undefined ? {} : { message: options.message }),
  };

  return options.response.status(options.statusCode).json(body);
}

export function sendMetaCollection<T>(options: SendCollectionOptions<T>): Response {
  const body: ApiMetaCollectionResponse<T> = {
    success: true,
    data: options.data,
    meta: {
      requestId: options.requestId,
      totalItems: options.pagination.totalItems,
      totalPages: options.pagination.totalItems === 0 ? 0 : options.pagination.totalPages,
      currentPage: options.pagination.page,
      limit: options.pagination.limit,
      hasNextPage: options.pagination.hasNextPage,
      hasPreviousPage: options.pagination.hasPreviousPage,
    },
    ...(options.message === undefined ? {} : { message: options.message }),
  };

  return options.response.status(options.statusCode).json(body);
}
