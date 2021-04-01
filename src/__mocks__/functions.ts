import SemVer from "semver/classes/semver";
import semverParse from "semver/functions/parse";
import Functions from "src/functions";

const mockReleaseTag = new Proxy(Object.assign(jest.fn(), {
    __mockedTag: "2.0.1"
}), {
    set(target, prop, value, receiver): boolean {
        if (prop === 'mockedTag') {
            target.__mockedTag = value;
            return true;
        }
        return Reflect.set(target, prop, value, receiver);
    },
    apply(target, thisArg): SemVer {
        return semverParse(target.__mockedTag);
    }
});

const MockFunctions: typeof Functions = jest.requireActual('src/functions').default;
MockFunctions.releaseTag = mockReleaseTag;

export default MockFunctions;
