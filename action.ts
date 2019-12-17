import * as core from '@actions/core';
import { context, GitHub } from '@actions/github';
import valid from 'semver/functions/valid';
import major from 'semver/functions/major';

/**
 * Checks if the event that triggered this action was a release
 * See: https://developer.github.com/v3/activity/events/types/#releaseevent
 */
function isRelease(): boolean {
    return context.payload.action === 'published'
        && valid(context.payload.release?.tag_name) !== null;
}

/**
 * Tags the release with the given tagName
 * @param github The github client
 * @param tagName The name of the tag to use
 */
async function tagRelease(github: GitHub, tagName: string) {
    const {data: updateRef} = await github.git.updateRef({
        ...context.repo,
        force: true,
        ref: `refs/tags/${tagName}`,
        sha: process.env.GITHUB_SHA
    });

    core.info(JSON.stringify(updateRef));
}

async function run(): Promise<void> {
    try {
        if (!isRelease()) {
            core.info("This action should only be used in a release context");
            core.info("If you believe this to be an error, please submit a bug report");
            return;
        }

        if (process.env.GITHUB_TOKEN) {
            const octokit = new GitHub(process.env.GITHUB_TOKEN);
            const majorVersion = major(context.payload.release?.tag_name);

            await tagRelease(octokit, `v${majorVersion}`);

            if (Boolean(core.getInput('publish_latest'))) {
                await tagRelease(octokit, 'latest');
            }
        } else {
            core.setFailed("Expected a `GITHUB_TOKEN` environment variable");
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

run()
