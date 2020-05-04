import { Config } from "@jest/types";

export default async (_: Config.GlobalConfig) => {
    process.env.INPUT_PUBLISH_LATEST_TAG = "false";
    process.env.INPUT_PREFER_BRANCH_RELEASES = "false";
};
