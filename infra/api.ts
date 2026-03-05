import { table } from "./database";
import { vectorConfig } from "./vectors";

const authorizerFn = new sst.aws.Function("Authorizer", {
  handler: "src/functions/authorizer.handler",
  link: [table],
  environment: {
    POWERTOOLS_SERVICE_NAME: "agentbase",
    LOG_LEVEL: "INFO",
  },
  permissions: [
    {
      actions: ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:PutItem"],
      resources: [table.arn, $interpolate`${table.arn}/index/*`],
    },
  ],
});

export const api = new sst.aws.AppSync("AgentbaseApi", {
  schema: "graphql/schema.graphql",
  domain: undefined,
  transform: {
    api(args) {
      args.authenticationType = "AWS_LAMBDA";
      args.lambdaAuthorizerConfig = {
        authorizerUri: authorizerFn.arn,
        authorizerResultTtlInSeconds: 0,
      };
      args.additionalAuthenticationProviders = [
        {
          authenticationType: "API_KEY",
        },
      ];
    },
  },
});

// Grant AppSync permission to invoke the authorizer
new aws.lambda.Permission("AuthorizerInvokePermission", {
  action: "lambda:InvokeFunction",
  function: authorizerFn.arn,
  principal: "appsync.amazonaws.com",
  sourceArn: api.arn,
});

// Generate an API key for public operations (registerUser)
export const apiKey = new aws.appsync.ApiKey("AgentbaseApiKey", {
  apiId: api.id,
});

// Shared Lambda config for resolvers
const resolverDefaults = {
  link: [table],
  environment: {
    POWERTOOLS_SERVICE_NAME: "agentbase",
    LOG_LEVEL: "INFO",
    VECTOR_BUCKET_NAME: vectorConfig.bucketName,
    VECTOR_INDEX_NAME: vectorConfig.indexName,
    TABLE_NAME: table.name,
  },
  permissions: [
    {
      actions: [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:BatchGetItem",
      ],
      resources: [table.arn, $interpolate`${table.arn}/index/*`],
    },
    {
      actions: ["bedrock:InvokeModel"],
      resources: [
        "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0",
      ],
    },
    {
      actions: [
        "s3vectors:CreateVectorBucket",
        "s3vectors:CreateVectorIndex",
        "s3vectors:PutVectors",
        "s3vectors:QueryVectors",
        "s3vectors:GetVectors",
        "s3vectors:DeleteVectors",
        "s3vectors:ListVectorIndexes",
      ],
      resources: ["*"],
    },
  ],
} as const;

// Register User (public, API_KEY auth)
api.addDataSource({
  name: "registerUserDS",
  lambda: {
    handler: "src/functions/resolvers/registerUser.handler",
    ...resolverDefaults,
  },
});
api.addResolver("registerUserDS", {
  typeName: "Mutation",
  fieldName: "registerUser",
});

// Me query
api.addDataSource({
  name: "meDS",
  lambda: {
    handler: "src/functions/resolvers/me.handler",
    ...resolverDefaults,
  },
});
api.addResolver("meDS", { typeName: "Query", fieldName: "me" });

// Update Me
api.addDataSource({
  name: "updateMeDS",
  lambda: {
    handler: "src/functions/resolvers/updateMe.handler",
    ...resolverDefaults,
  },
});
api.addResolver("updateMeDS", {
  typeName: "Mutation",
  fieldName: "updateMe",
});

// Create Knowledge
api.addDataSource({
  name: "createKnowledgeDS",
  lambda: {
    handler: "src/functions/resolvers/createKnowledge.handler",
    ...resolverDefaults,
  },
});
api.addResolver("createKnowledgeDS", {
  typeName: "Mutation",
  fieldName: "createKnowledge",
});

// Get Knowledge
api.addDataSource({
  name: "getKnowledgeDS",
  lambda: {
    handler: "src/functions/resolvers/getKnowledge.handler",
    ...resolverDefaults,
  },
});
api.addResolver("getKnowledgeDS", {
  typeName: "Query",
  fieldName: "getKnowledge",
});

// List Knowledge
api.addDataSource({
  name: "listKnowledgeDS",
  lambda: {
    handler: "src/functions/resolvers/listKnowledge.handler",
    ...resolverDefaults,
  },
});
api.addResolver("listKnowledgeDS", {
  typeName: "Query",
  fieldName: "listKnowledge",
});

// Update Knowledge
api.addDataSource({
  name: "updateKnowledgeDS",
  lambda: {
    handler: "src/functions/resolvers/updateKnowledge.handler",
    ...resolverDefaults,
  },
});
api.addResolver("updateKnowledgeDS", {
  typeName: "Mutation",
  fieldName: "updateKnowledge",
});

// Delete Knowledge
api.addDataSource({
  name: "deleteKnowledgeDS",
  lambda: {
    handler: "src/functions/resolvers/deleteKnowledge.handler",
    ...resolverDefaults,
  },
});
api.addResolver("deleteKnowledgeDS", {
  typeName: "Mutation",
  fieldName: "deleteKnowledge",
});

// Search Knowledge
api.addDataSource({
  name: "searchKnowledgeDS",
  lambda: {
    handler: "src/functions/resolvers/searchKnowledge.handler",
    ...resolverDefaults,
  },
});
api.addResolver("searchKnowledgeDS", {
  typeName: "Query",
  fieldName: "searchKnowledge",
});
