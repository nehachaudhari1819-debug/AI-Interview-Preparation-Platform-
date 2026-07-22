export const APPLICATION_LIFECYCLE_STATES = [
  "starting",
  "ready",
  "shutting_down",
  "stopped",
  "failed",
] as const;

export type ApplicationLifecycleState = (typeof APPLICATION_LIFECYCLE_STATES)[number];

export type ApplicationLifecycleSnapshot = {
  state: ApplicationLifecycleState;
  ready: boolean;
  startedAt: string;
  updatedAt: string;
  shutdownReason?: string;
};
