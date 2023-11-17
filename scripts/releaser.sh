#!/bin/bash -x

version="${1//[[:space:]]/}"

if [ -n "$version" ]; then
    git stash
    yarn build
    git add lib
    git commit -m "release files for version $version"
    git tag "v$version"
    git rm -rf lib
    git reset --soft HEAD~1
    git stash pop
    exit 0
fi

echo "Must specify a release version"
exit 1
