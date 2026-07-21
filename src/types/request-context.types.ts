export type RequestSecurityContext = {
  clientIp: string;
  protocol: "http" | "https";
  isSecure: boolean;
  origin?: string;
  fetchSite?: string;
};

export type RequestContext = {
  requestId: string;
  security: RequestSecurityContext;
};
