export type BuildVersion = {
  commit: string;
  buildTime: string;
  environment: string;
};

export function getBuildVersion(): BuildVersion {
  return {
    commit: process.env.ACAORA_BUILD_COMMIT || "unknown",
    buildTime: process.env.ACAORA_BUILD_TIME || "unknown",
    environment: process.env.ACAORA_BUILD_ENVIRONMENT || process.env.NODE_ENV || "unknown",
  };
}

export function getShortCommit(commit: string) {
  return commit === "unknown" ? commit : commit.slice(0, 7);
}
