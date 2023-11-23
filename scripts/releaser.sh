#!/bin/bash
shopt -s extglob

version="$(jq -r .version package.json)"

if [ -z "$version" ]; then
    echo "package.json does not contain a version" >&2
    exit 1
fi

version="${version##+(v)}" # discard leading v

(
    # Runs in subshell so that the git operations do not affect the rest of the script
    git fetch origin --tags
    if [ "$(git tag -l "v$version")" ]; then
        echo "Version $version already exists" >&2
        exit 1
    fi
    echo "Releasing version $version" >&2
    git stash -q
    yarn build
    git add lib
    git commit -m "release files for version $version"
    git tag "v$version"
    git rm -rf lib
    git reset --soft HEAD~1
    git stash pop -q || true
)
