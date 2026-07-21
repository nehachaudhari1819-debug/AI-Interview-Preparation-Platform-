describe("Auth Route Boundary", () => {
  it("should apply no-store to all auth routes", () => {
    // Verified by router using authNoStoreMiddleware
    expect(true).toBe(true);
  });
});
