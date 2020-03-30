import * as core from "@actions/core";
import { context, GitHub } from "@actions/github";
import valid from "semver/functions/valid";
import major from "semver/functions/major";
import { TaggedRelease } from ".";

/**
 * Checks if the event that triggered this action was a release
 * See: https://developer.github.com/v3/activity/events/types/#releaseevent
 */
function isRelease(): boolean {
    return context.payload.action === "published" && valid(context.payload.release?.tag_name) !== null;
}

/**
 * Creates the tags required and optionally a 'latest' tag
 *
 * @returns {Promise<TaggedRelease>}
 */
async function createTagRefs(): Promise<TaggedRelease> {
    const octokit = new GitHub(process.env.GITHUB_TOKEN);
    const majorVersion = major(context.payload.release?.tag_name);

    const tag = `v${majorVersion}`;
    await tagRelease(octokit, tag);

    const publishLatest: boolean = core.getInput("publish_latest").toLowerCase() === "true";
    if (publishLatest) {
        await tagRelease(octokit, "latest");
    }

    return { tag, latest: publishLatest };
}

/**
 * Tags the release with the given tagName
 * @param github The github client
 * @param tagName The name of the tag to use
 */
async function tagRelease(github: GitHub, tagName: string) {
    const { data: matchingRefs } = await github.git.listMatchingRefs({
        ...context.repo,
        ref: `tags/${tagName}`
    });

    const matchingRef = matchingRefs.find(refObj => {
        return refObj.ref.endsWith(tagName);
    });

    let upstreamRef: unknown;

    if (matchingRef !== undefined) {
        core.info(`Updating ref: tags/${tagName} to: ${process.env.GITHUB_SHA}`);
        ({ data: upstreamRef } = await github.git.updateRef({
            ...context.repo,
            force: true,
            ref: `tags/${tagName}`,
            sha: process.env.GITHUB_SHA
        }));
    } else {
        core.info(`Creating ref: refs/tags/${tagName} for: ${process.env.GITHUB_SHA}`);
        ({ data: upstreamRef } = await github.git.createRef({
            ...context.repo,
            ref: `refs/tags/${tagName}`,
            sha: process.env.GITHUB_SHA
        }));
    }
    core.info(JSON.stringify(upstreamRef));
}

async function run() {
    try {
        if (!isRelease()) {
            core.info("This action should only be used in a release context");
            core.info("If you believe this to be an error, please submit a bug report");
            return;
        }

        if (process.env.GITHUB_TOKEN) {
            const { tag, latest } = await createTagRefs();
            core.setOutput("tag", tag);
            core.setOutput("latest", latest.toString());
        } else {
            core.setFailed("Expected a `GITHUB_TOKEN` environment variable");
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
