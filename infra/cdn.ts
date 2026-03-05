import { api } from "./api";

// CloudFront distribution in front of AppSync to get geo headers
const apiOriginUrl = api.url.apply((url: string) => new URL(url).hostname);

const cachePolicy = new aws.cloudfront.CachePolicy("AgentbaseCachePolicy", {
  name: `agentbase-no-cache-${$app.stage}`,
  defaultTtl: 0,
  maxTtl: 0,
  minTtl: 0,
  parametersInCacheKeyAndForwardedToOrigin: {
    cookiesConfig: { cookieBehavior: "none" },
    headersConfig: {
      headerBehavior: "whitelist",
      headers: { items: ["Authorization", "Content-Type", "x-api-key"] },
    },
    queryStringsConfig: { queryStringBehavior: "none" },
  },
});

export const cdn = new aws.cloudfront.Distribution("AgentbaseCdn", {
  enabled: true,
  comment: `AgentBase API CDN (${$app.stage})`,
  defaultCacheBehavior: {
    allowedMethods: [
      "DELETE",
      "GET",
      "HEAD",
      "OPTIONS",
      "PATCH",
      "POST",
      "PUT",
    ],
    cachedMethods: ["GET", "HEAD"],
    targetOriginId: "appsync",
    viewerProtocolPolicy: "https-only",
    cachePolicyId: cachePolicy.id,
    originRequestPolicyId: undefined,
    compress: true,
  },
  origins: [
    {
      domainName: apiOriginUrl,
      originId: "appsync",
      customOriginConfig: {
        httpPort: 80,
        httpsPort: 443,
        originProtocolPolicy: "https-only",
        originSslProtocols: ["TLSv1.2"],
      },
    },
  ],
  restrictions: {
    geoRestriction: { restrictionType: "none" },
  },
  viewerCertificate: {
    cloudfrontDefaultCertificate: true,
  },
});
