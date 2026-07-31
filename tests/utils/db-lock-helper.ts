import { Client } from "pg";

export class DbLockHelper {
  private client: Client | null = null;
  private readonly dbUrl: string;

  constructor(dbUrl: string) {
    this.dbUrl = dbUrl;
  }

  async connectAndLock(userId: string, operation: string, idempotencyKey: string): Promise<void> {
    this.client = new Client({
      connectionString: this.dbUrl,
    });

    try {
      await this.client.connect();
      await this.client.query("BEGIN;");

      // Acquire the exact lifecycle advisory lock
      const res = await this.client.query(
        `
        SELECT pg_try_advisory_xact_lock(
          hashtextextended(
            jsonb_build_array(
              $1::text,
              $2::text,
              $3::text
            )::text,
            0
          )
        ) AS acquired;
      `,
        [userId, operation, idempotencyKey],
      );

      const acquired = res.rows[0]?.acquired;
      if (!acquired) {
        throw new Error("Helper failed to acquire lock; maybe already held?");
      }
    } catch (error) {
      if (this.client) {
        try {
          await this.client.query("ROLLBACK;");
        } catch {
          // preserve original failure
        }
        await this.client.end();
        this.client = null;
      }
      throw error;
    }
  }

  async releaseAndClose(): Promise<void> {
    if (this.client) {
      try {
        await this.client.query("ROLLBACK;");
      } catch {
        // preserve original failure
      } finally {
        await this.client.end();
        this.client = null;
      }
    }
  }
}
