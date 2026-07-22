import { ipKeyGenerator } from "express-rate-limit";

import type { Request, Response } from "express";

export function createRateLimitKeyGenerator(
  ipv6Subnet: number,
): (request: Request, response: Response) => string {
  return (request): string => {
    const ipAddress = request.ip;

    if (!ipAddress) {
      return "unknown-client";
    }

    return ipKeyGenerator(ipAddress, ipv6Subnet);
  };
}
