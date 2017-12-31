#!/bin/bash
set -e # Exit with nonzero exit code if anything fails

SOURCE_BRANCH="staging"
TARGET_BRANCH="master"

function doCompile {
  #Renaming gemfile for build 
  mv Gemfile notGemfile
  gulp build
  #renaming gemfile back after build completes to avoid errors
  mv notGemfile Gemfile
}

# Pull requests and commits to other branches shouldn't try to deploy, just build to verify
# Note: This is now a feature on Travis-CI so leave it commented out here
# Note 2: Just kidding, still need to check if it's just a pull request

if [ "$TRAVIS_PULL_REQUEST" != "false" ]; then
    echo "Pull request detected. Skipping deploy; just doing a build."
    doCompile
    exit 0
fi

# Save some useful information
REPO=`git config remote.origin.url`
SSH_REPO=${REPO/https:\/\/github.com\//git@github.com:}
SHA=`git rev-parse --verify HEAD`

# Clone the existing gh-pages for this repo into out/
# Create a new empty branch if gh-pages doesn't exist yet (should only happen on first deply)
git clone $REPO serve
cd serve
git checkout $TARGET_BRANCH || git checkout --orphan $TARGET_BRANCH
MASTER_SHA=`git log -n 1 --pretty=format:"%B" | cut -d':' -f2 | cut -c2-`
cd ..

# Check if there are changes to website source or tests otherwise bail.
if ! git --no-pager diff --name-only $SHA $MASTER_SHA | grep -qP "^src\/|^test\/"; then
  echo "No changes to website source in this commit. Skipping build & push."
  exit 0
fi

# Clean out existing contents
rm -rf serve/* || exit 0
mv serve/.git .backup

# Run our compile script
doCompile

# Now let's go have some fun with the cloned repo
mv .backup serve/.git
cd serve
git config user.name "Travis CI"
git config user.email "$COMMIT_AUTHOR_EMAIL"

# If there are no changes to the compiled out (e.g. this is a README update) then just bail.
# if [ -z `git diff --exit-code` ]; then
#     echo "No changes to the output on this push; exiting."
#     exit 0
# fi

# Commit the "changes", i.e. the new version.
# The delta will show diffs between new and old versions.
git add -A
git commit -m "Deploy website to GitHub: ${SHA}"

# Get the deploy key by using Travis's stored variables to decrypt deploy_key.enc
ENCRYPTED_KEY_VAR="encrypted_${ENCRYPTION_LABEL}_key"
ENCRYPTED_IV_VAR="encrypted_${ENCRYPTION_LABEL}_iv"
ENCRYPTED_KEY=${!ENCRYPTED_KEY_VAR}
ENCRYPTED_IV=${!ENCRYPTED_IV_VAR}
openssl aes-256-cbc -K $ENCRYPTED_KEY -iv $ENCRYPTED_IV -in ../deploy_key.enc -out deploy_key -d
chmod 600 deploy_key
eval `ssh-agent -s`
ssh-add deploy_key

# Now that we're all set up, we can push.
git push $SSH_REPO $TARGET_BRANCH