#!/bin/bash -x

version="${1//[[:space:]]/}"

if [ -z "$version" ]; then
    echo "Must specify a release version"
    exit 1
fi

git stash
git fetch origin --tags
jq --arg version "$version" '.version = $version' package.json > package.json.tmp
mv package.json.tmp package.json
yarn build
git add lib
git commit -m "release files for version $version"
git tag "v$version"
git rm -rf lib
git reset --soft HEAD~1
git stash pop
