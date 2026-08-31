import { BUILD_COMMIT, BUILD_ENVIRONMENT, BUILD_TIME } from "../generated/build-version";

export type BuildVersion = {
  commit: string;
  buildTime: string;
  environment: string;
};

export function getBuildVersion(): BuildVersion {
  return {
    commit: BUILD_COMMIT,
    buildTime: BUILD_TIME,
    environment: BUILD_ENVIRONMENT,
  };
}

export function getShortCommit(commit: string) {
  return commit.slice(0, 7);
}
