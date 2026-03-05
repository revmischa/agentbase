export const site = new sst.aws.StaticSite("AgentbaseSite", {
  path: "web",
  buildOutput: ".",
  buildCommand: "",
});
