export type InFlightRequestTracker = {
  increment(): void;
  decrement(): void;
  getCount(): number;
  waitForZero(): Promise<void>;
};

export function createInFlightRequestTracker(): InFlightRequestTracker {
  let count = 0;
  let waitResolvers: Array<() => void> = [];

  return {
    increment() {
      count++;
    },
    decrement() {
      if (count > 0) {
        count--;
        if (count === 0 && waitResolvers.length > 0) {
          const resolvers = waitResolvers;
          waitResolvers = [];
          for (const resolve of resolvers) {
            resolve();
          }
        }
      }
    },
    getCount() {
      return count;
    },
    waitForZero() {
      if (count === 0) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        waitResolvers.push(resolve);
      });
    },
  };
}
