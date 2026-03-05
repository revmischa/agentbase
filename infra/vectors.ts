// S3 Vectors configuration
// Vector bucket and index are created via SDK in a setup Lambda
// since CloudFormation/Pulumi support for S3 Vectors is limited.
//
// Config: bucket=agentbase-vectors-{stage}, index=knowledge
// Dimensions: 1024 (Titan V2), metric: cosine, data_type: float32
// Metadata: knowledgeId, userId, topic, contentType, language, visibility

export const vectorConfig = {
  bucketName: `agentbase-vectors-${$app.stage}`,
  indexName: "knowledge",
  dimensions: 1024,
  distanceMetric: "cosine" as const,
};
