export type AccountDeletionInput = {
  userId: string;
  accessToken: string;
  idempotencyKey: string;
  requestId: string;
};

export type AccountDeletionResult = {
  success: true;
  account: {
    status: "deleted";
  };
};
