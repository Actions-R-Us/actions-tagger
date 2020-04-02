import SemVer from "semver/classes/semver";
import { context } from "@actions/github";
import coerce from "semver/functions/coerce";
import valid from "semver/functions/valid";
import major from "semver/functions/major";

export interface TaggedRelease {
    tag: string;
    latest: boolean;
}

/**
 * Get the actual release tag, taking into account
 * if this is a prerelease
 *
 * @returns
 */
function releaseTag() {
    let tagName: string | SemVer = context.payload.release?.tag_name;
    if (isPreRelease()) {
        tagName = coerce(tagName, { includePrerelease: true });
    }
    return tagName;
}

/**
 * Checks if the event that triggered this action was a release
 * See: https://developer.github.com/v3/activity/events/types/#releaseevent
 *
 * @returns {boolean}
 */
export function isRelease(): boolean {
    return context.eventName === "release";
}

/**
 * Check if this release is published and ready for the public.
 * A pre-release is usually considered "not ready" for public use
 *
 * @export
 * @returns {boolean}
 */
export function isPublicRelease(): boolean {
    return context.payload.action === "published" && !isPreRelease();
}

/**
 * Checks if the tag version of the release is valid semantic version
 *
 * @export
 * @returns {boolean}
 */
export function isSemVersionedRelease(): boolean {
    return valid(releaseTag()) !== null;
}

/**
 * Check if the event that triggered this actions was as a result
 * of a prerelease or not
 *
 * For some reason, it is not enough to check if the action is
 * prereleased, because even prereleases have the action of "published"
 * See: https://developer.github.com/v3/activity/events/types/#releaseevent
 *
 * @returns {boolean}
 */
export function isPreRelease(): boolean {
    return context.payload.release?.prerelease === true;
}

/**
 * Get the major number of the release tag
 *
 * @export
 * @returns {number}
 */
export function majorVersion(): number {
    return major(releaseTag());
}
