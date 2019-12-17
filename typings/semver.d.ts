declare module 'semver/functions/valid' {
    import {SemVer, Options} from 'semver'
    /**
    * Return the parsed version as a string, or null if it's not valid.
    */
    export default function valid(version: string | SemVer | null | undefined, optionsOrLoose?: boolean | Options): string | null;
}

declare module 'semver/functions/major' {
    import {SemVer, Options} from 'semver'
    /**
    * Return the major version number.
    */
    export default function major(version: string | SemVer, optionsOrLoose?: boolean | Options): number;
}
