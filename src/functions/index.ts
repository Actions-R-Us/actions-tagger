import * as core from '@actions/core';
import { context } from '@actions/github';
import SemVer from 'semver/classes/semver';
import coerce from 'semver/functions/coerce';
import semverGt from 'semver/functions/gt';
import major from 'semver/functions/major';
import semverParse from 'semver/functions/parse';
import valid from 'semver/functions/valid';
import { preferences, queryAllRefs } from '@actionstagger/util';
import type { GitHub, GraphQlQueryRepository, TaggedRef, LatestRef } from './types';

namespace Functions {
    /**
     * Checks if the event that triggered this action was a release
     * See: https://docs.github.com/en/webhooks/webhook-events-and-payloads#release
     */
    function isRelease(): boolean {
        return context.eventName === 'release';
    }

    /**
     * Check if the event that triggered this actions was as a result
     * of a prerelease or not
     *
     * For some reason, it is not enough to check if the action is
     * prereleased, because even prereleases have the action of "published"
     * See: https://github.com/orgs/community/discussions/26281
     * See also: https://docs.github.com/en/webhooks/webhook-events-and-payloads#release
     */
    function isPreRelease(): boolean {
        return context.payload.release?.prerelease === true;
    }

    /**
     * Is a release available to the public?
     * A pre-release is usually considered "not ready" for public use
     */
    function isPublicRelease(): boolean {
        return isRelease() && !isPreRelease();
    }

    /**
     * Checks if the event that triggered this action was a push
     * See: https://docs.github.com/en/webhooks/webhook-events-and-payloads#push
     */
    function isPush(): boolean {
        return context.eventName === 'push';
    }

    /**
     * Check if the push event created a new ref
     */
    function isNewRefPush(): boolean {
        return isPush() && context.payload.created === true;
    }

    function isBranchPush(): boolean {
        return isNewRefPush() && context.payload.ref.startsWith(`refs/heads/`);
    }

    function isTagPush(): boolean {
        return isNewRefPush() && context.payload.ref.startsWith(`refs/tags/`);
    }

    /**
     * Creates the given ref for this release
     * refName must begin with tags/ or heads/
     *
     * @param github The github client
     * @param refName The name of the ref to use. ex tags/latest, heads/v1, etc
     */
    async function createRef(github: GitHub, refName: string) {
        const { data: matchingRefs } = await github.rest.git.listMatchingRefs({
            ...context.repo,
            ref: refName,
        });

        const matchingRef = matchingRefs.find((refObj: { ref: string }) => {
            return refObj.ref.endsWith(refName);
        });

        let upstreamRef: unknown;

        if (matchingRef !== undefined) {
            core.info(`Updating ref: ${refName} to: ${process.env.GITHUB_SHA}`);
            ({ data: upstreamRef } = await github.rest.git.updateRef({
                ...context.repo,
                force: true,
                ref: refName,
                sha: process.env.GITHUB_SHA,
            }));
        } else {
            core.info(`Creating ref: refs/${refName} for: ${process.env.GITHUB_SHA}`);
            ({ data: upstreamRef } = await github.rest.git.createRef({
                ...context.repo,
                ref: `refs/${refName}`,
                sha: process.env.GITHUB_SHA,
            }));
        }

        if (core.isDebug()) {
            core.debug(
                `${JSON.stringify(upstreamRef)} now points to: "${
                    process.env.GITHUB_SHA
                }"`
            );
        }
    }

    /**
     * List all the refs in the repository based on user's preferred ref
     *
     * @param github The github client
     */
    async function* listAllRefs(github: GitHub) {
        for (let nextPage: string; true; ) {
            const { repository }: { repository: GraphQlQueryRepository } =
                await github.graphql(queryAllRefs, {
                    repoName: context.repo.repo,
                    repoOwner: context.repo.owner,
                    majorRef: `refs/${Functions.getPreferredRef()}/`,
                    pagination: nextPage,
                });

            for (const { ref } of repository.refs.refsList) {
                const semverRef = semverParse(ref.name);
                if (semverRef !== null) {
                    if (core.isDebug()) {
                        core.debug(`checking ${ref.name}`);
                    }
                    yield [semverRef, ref.object.shaId] as const;
                } else if (core.isDebug()) {
                    core.debug(`ignoring ${ref.name}`);
                }
            }

            if (repository.refs.pageInfo.hasNextPage) {
                nextPage = repository.refs.pageInfo.endCursor;
            } else {
                break;
            }
        }
    }

    /**
     * Get the ref version for the current push
     *
     * @returns the ref for this release (if any)
     */
    function getPushRefVersion(): SemVer {
        let refName: string | SemVer = (context.payload.ref as string)?.replace(
            new RegExp(`^refs/${Functions.getPreferredRef()}/`),
            ''
        );
        return semverParse(refName);
    }

    /**
     * Get the actual tag version for this release. It also takes into account
     * whether or not this is a prerelease
     *
     * @returns the tag for this release (if any)
     */
    function getReleaseTag(): SemVer {
        let tagName: string | SemVer = context.payload.release?.tag_name;
        if (isPreRelease()) {
            tagName = coerce(tagName);
        }
        return semverParse(tagName);
    }

    /**
     * Check if this release is publically available and has been published
     */
    export function isPublishedRelease(): boolean {
        return isPublicRelease() && context.payload.action === 'published';
    }

    /**
     * Check if this release is publically available and has been edited
     */
    export function isEditedRelease(): boolean {
        return isPublicRelease() && context.payload.action === 'edited';
    }

    /**
     * Check if this event was a new tag push
     */
    export function isRefPush(): boolean {
        return isBranchPush() || isTagPush();
    }

    export async function isRefLatestMajor(github: GitHub): Promise<boolean> {
        if (Functions.isRefPush()) {
            const major = majorVersion();
            const { data: majorRef } = await github.rest.git.getRef({
                ...context.repo,
                ref: `${Functions.getPreferredRef()}/v${major}`,
            });
            return majorRef?.object.sha === process.env.GITHUB_SHA;
        }
        return false;
    }

    /**
     * Get the tag version being published via push or release event
     *
     * @returns The tag being published
     */
    export function getPublishRefVersion(): SemVer {
        return Functions.isRefPush() ? getPushRefVersion() : getReleaseTag();
    }

    /**
     * Checks if the tag version of the pushed tag/release has valid version
     */
    export function isSemVersionedTag(): boolean {
        return valid(Functions.getPublishRefVersion()) !== null;
    }

    /**
     * Get the major number of the release tag
     */
    export function majorVersion(): number {
        return major(Functions.getPublishRefVersion());
    }

    /**
     * Returns the appropriate ref depending on the input preferences
     */
    export function getPreferredRef() {
        if (preferences.preferBranchRelease) {
            return 'heads';
        }
        return 'tags';
    }

    /**
     * Finds the latest refs in the repository as well as the latest ref
     * for this event's major version. We do this to determine if we should proceed
     * with promoting the major and latest refs.
     *
     * e.g. if the current ref which triggered this actions is tagged v3.2.2,
     * but the latest ref is v4.0.3, a possible return value may be
     * {repoLatest: "v4.0.3", majorLatest: "v3.3.0"} (this is not a typo, keep reading).
     * In this case, this event should not trigger an update because it is
     * targetting a lower version than the latest v3 (v3.3.0) and we already have a latest version
     * which is v4.0.3
     *
     * @param {GitHub} github The octokit client instance
     */
    export async function findLatestRef(github: GitHub): Promise<LatestRef> {
        let [majorLatest, majorSha] = [
            Functions.getPublishRefVersion(),
            process.env.GITHUB_SHA,
        ];
        let [repoLatest, repoSha] = [majorLatest, majorSha];

        const major = majorLatest.major;
        for await (const [semverRef, shaId] of listAllRefs(github)) {
            if (semverRef.major === major && semverGt(semverRef, majorLatest)) {
                [majorLatest, majorSha] = [semverRef, shaId];
            }

            if (semverGt(semverRef, repoLatest)) {
                [repoLatest, repoSha] = [semverRef, shaId];
            }
        }
        return {
            repoLatest: { name: repoLatest.version, shaId: repoSha },
            majorLatest: { name: majorLatest.version, shaId: majorSha },
        };
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
    ): Promise<TaggedRef> {
        const mayor = Functions.majorVersion();

        const ref = `${Functions.getPreferredRef()}/v${mayor}`;
        await createRef(github, ref);

        const publishLatest: boolean = overridePublishLatest ?? preferences.publishLatest;
        if (publishLatest) {
            // TODO v3: `${getPreferredRef()}/latest`
            await createRef(github, 'tags/latest');
        }

        return {
            ref,
            latest: publishLatest,
        };
    }
}

export default Functions;
