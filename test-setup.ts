export default async (_: jest.GlobalConfig) => {
    process.env.INPUT_PUBLISH_LATEST_TAG = "false";
    process.env.INPUT_PREFER_BRANCH_RELEASES = "false";
};
