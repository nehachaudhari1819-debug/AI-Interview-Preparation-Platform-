export type ApiMeta = {
  requestId: string;
};

export type ApiFieldError = {
  field?: string;
  message: string;
};

export type ApiSuccessResponse<T> = {
  success: true;
  message?: string;
  data: T;
  meta: ApiMeta;
};

export type ApiErrorResponse = {
  success: false;
  message: string;
  code: string;
  errors?: ApiFieldError[];
  meta: ApiMeta;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type ApiCollectionResponse<T> = ApiSuccessResponse<T[]> & {
  pagination: PaginationMeta;
};
