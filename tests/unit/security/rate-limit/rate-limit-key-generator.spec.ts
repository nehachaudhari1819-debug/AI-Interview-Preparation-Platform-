import { createRateLimitKeyGenerator } from "../../../../src/security/rate-limit/create-rate-limit-key-generator.js";
import { ipKeyGenerator } from "express-rate-limit";
import type { Request, Response } from "express";

describe("createRateLimitKeyGenerator", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    req = {};
    res = {};
  });

  it("should return unknown-client if request.ip is not present", () => {
    const generator = createRateLimitKeyGenerator(56);
    expect(generator(req as Request, res as Response)).toBe("unknown-client");
  });

  it("should return request.ip if present", () => {
    Object.defineProperty(req, "ip", { value: "192.168.1.1", writable: true });
    const generator = createRateLimitKeyGenerator(56);
    expect(generator(req as Request, res as Response)).toBe("192.168.1.1");
  });

  it("normalizes equivalent IPv4 and mapped IPv6 addresses", () => {
    expect(ipKeyGenerator("192.0.2.10", 56)).toBe(ipKeyGenerator("::ffff:192.0.2.10", 56));
  });

  it("does not collapse unrelated mapped IPv4 clients", () => {
    expect(ipKeyGenerator("::ffff:192.0.2.10", 56)).not.toBe(
      ipKeyGenerator("::ffff:198.51.100.10", 56),
    );
  });

  it("groups native IPv6 addresses within the configured subnet", () => {
    expect(ipKeyGenerator("2001:db8:abcd:1200::1", 56)).toBe(
      ipKeyGenerator("2001:db8:abcd:12ff::2", 56),
    );
  });
});
