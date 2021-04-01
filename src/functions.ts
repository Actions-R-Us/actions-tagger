import * as core from "@actions/core";
import { context } from "@actions/github";
import { Octokit as GitHub } from "@octokit/core";
import SemVer from "semver/classes/semver";
import coerce from "semver/functions/coerce";
import semverGt from "semver/functions/gt";
import major from "semver/functions/major";
import semverParse from "semver/functions/parse";
import valid from "semver/functions/valid";
import { GraphQlQueryRepository, LatestRelease, preferences, queryAllRefs, TaggedRelease } from ".";


namespace Functions {

    /**
     * Checks if the event that triggered this action was a release
     * See: https://developer.github.com/v3/activity/events/types/#releaseevent
     */
    function isRelease(): boolean {
        return context.eventName === "release";
    }

    /**
     * Is a release available to the public?
     * A pre-release is usually considered "not ready" for public use
     */
    function isPublicRelease(): boolean {
        return isRelease() && !isPreRelease();
    }

    /**
     * Check if the event that triggered this actions was as a result
     * of a prerelease or not
     *
     * For some reason, it is not enough to check if the action is
     * prereleased, because even prereleases have the action of "published"
     * See: https://github.community/t5/GitHub-Actions/Release-Prerelease-action-triggers/m-p/42177#M4892
     * See also: https://developer.github.com/v3/activity/events/types/#releaseevent
     */
    function isPreRelease(): boolean {
        return context.payload.release?.prerelease === true;
    }

    /**
     * Get the actual tag version for this release. It also takes into account
     * whether or not this is a prerelease
     *
     * @returns the tag for this release (if any)
     */
    export function releaseTag(): SemVer {
        let tagName: string | SemVer = context.payload.release?.tag_name;
        if (isPreRelease()) {
            tagName = coerce(tagName, { includePrerelease: true });
        }
        return semverParse(tagName);
    }

    /**
     * Check if this release is publically available and has been published
     */
    export function isPublishedRelease(): boolean {
        return isPublicRelease() && context.payload.action === "published";
    }

    /**
     * Check if this release is publically available and has been edited
     */
    export function isEditedRelease(): boolean {
        return isPublicRelease() && context.payload.action === "edited";
    }

    /**
     * Checks if the tag version of the release is valid semantic version
     */
    export function isSemVersionedRelease(): boolean {
        return valid(Functions.releaseTag()) !== null;
    }

    /**
     * Get the major number of the release tag
     */
    export function majorVersion(): number {
        return major(Functions.releaseTag());
    }

    /**
     * Returns the appropriate ref depending on the input preferences
     */
    export function getPreferredRef(): string {
        if (preferences.preferBranchRelease) {
            return "heads";
        }
        return "tags";
    }

    /**
     * Finds the latest release in the repository as well as the latest release
     * for this release major version. We do this to determine if we should proceed
     * with promoting the major and latest refs.
     *
     * e.g. if the current release which triggered this actions is tagged v3.2.2,
     * but the latest release is v4.0.3, a possible return value may be
     * {repoLatest: "v4.0.3", majorLatest: "v3.3.0"} (this is not a typo, keep reading).
     * In this case, this release should not trigger an update because the release is
     * targetting a lower version than the latest v3 (v3.3.0) and we already have a latest version
     * which is v4.0.3
     *
     * @param {GitHub} github The octokit client instance
     */
    export async function findLatestReleases(github: GitHub): Promise<LatestRelease> {
        const releaseVer = Functions.releaseTag();
        let repoLatest = releaseVer;
        let majorLatest = repoLatest;

        const major = Functions.majorVersion();

        if (core.isDebug()) {
            core.debug("Found the following releases in this repository:");
        }

        for (let nextPage: string; true;) {
            const { repository }: { repository: GraphQlQueryRepository } = await github.graphql(queryAllRefs, {
                repoName: context.repo.repo,
                repoOwner: context.repo.owner,
                majorRef: `refs/${Functions.getPreferredRef()}/`,
                pagination: nextPage,
            });

            for (const { ref } of repository.refs.refsList) {
                const semverRef = semverParse(ref.name);
                if (semverRef !== null) {
                    if (semverRef.major === major && semverGt(semverRef, majorLatest)) {
                        majorLatest = semverRef;
                    }

                    if (semverGt(semverRef, repoLatest)) {
                        repoLatest = semverRef;
                    }

                    if (core.isDebug()) {
                        core.debug(ref.name);
                    }
                }
            }

            if (repository.refs.pageInfo.hasNextPage) {
                nextPage = repository.refs.pageInfo.endCursor;
            } else {
                break;
            }
        }

        return { repoLatest: repoLatest.version, majorLatest: majorLatest.version };
    }

    /**
     * Creates the tags required and optionally a 'latest' tag
     *
     * @param {GitHub} github The octokit client for making requests
     * @param {Boolean} overridePublishLatest Flag used to force the publishing of the latest tag
     */
    export async function createRequiredRefs(
        github: GitHub,
        overridePublishLatest?: boolean
    ): Promise<TaggedRelease> {
        const mayor = Functions.majorVersion();

        const ref = `${Functions.getPreferredRef()}/v${mayor}`;
        await createRef(github, ref);

        const publishLatest: boolean = overridePublishLatest ?? preferences.publishLatestTag;
        if (publishLatest) {
            // TODO v3: `${Functions.getPreferredRef()}/latest`
            await createRef(github, "tags/latest");
        }

        return { ref, latest: publishLatest };
    }

    /**
     * Creates the given ref for this release
     * refName must begin with tags/ or heads/
     *
     * @param github The github client
     * @param refName The name of the ref to use. ex tags/latest, heads/v1, etc
     */
    async function createRef(github: GitHub, refName: string) {
        const { data: matchingRefs } = await github.git.listMatchingRefs({
            ...context.repo,
            ref: refName,
        });

        const matchingRef = matchingRefs.find((refObj: { ref: string }) => {
            return refObj.ref.endsWith(refName);
        });

        let upstreamRef: unknown;

        if (matchingRef !== undefined) {
            core.info(`Updating ref: ${refName} to: ${process.env.GITHUB_SHA}`);
            ({ data: upstreamRef } = await github.git.updateRef({
                ...context.repo,
                force: true,
                ref: refName,
                sha: process.env.GITHUB_SHA,
            }));
        } else {
            core.info(`Creating ref: refs/${refName} for: ${process.env.GITHUB_SHA}`);
            ({ data: upstreamRef } = await github.git.createRef({
                ...context.repo,
                ref: `refs/${refName}`,
                sha: process.env.GITHUB_SHA,
            }));
        }

        if (core.isDebug()) {
            core.debug(`${JSON.stringify(upstreamRef)} now points to: "${process.env.GITHUB_SHA}"`);
        }
    }

    /**
     * Sets the output of this action to indicate the version that was published/updated
     * @param refName The tag version
     */
    export function outputTagName(refName: string) {
        core.setOutput("tag", refName);
        // TODO: Deprecate: v3
        core.setOutput("ref_name", refName);
    }

    /**
     * Sets the output of this action to indicate if the latest tag was published
     * @param isLatest
     */
    export function outputLatest(isLatest: boolean) {
        core.setOutput("latest", isLatest.toString());
    }
}

export default Functions;
