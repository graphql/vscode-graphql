#!/bin/bash

if [ ! -f .envrc ]
then
  export $(cat .envrc | xargs)
fi

echo "PAT: $PAT"
echo "LOCAL: $LOCAL"

if [[ -z "$PAT" ]]; then
    echo "\$PAT is empty. Please set the value of $PAT"
else
    if [[ -z "$LOCAL" ]]; then
        echo "Printing the command because LOCAL is set"
        echo "npm run vsce:publish patch --pat $PAT"
    else
        ./node_modules/.bin/vsce publish patch --pat $PAT
    fi
fi

echo "PAT: $PAT"
echo "LOCAL: $LOCAL"

if [[ -z "$LOCAL" ]]; then
    echo "Not pushing because LOCAL is set"
else
    git remote add github "https://$GITHUB_ACTOR:$GITHUB_TOKEN@github.com/$GITHUB_REPOSITORY.git" || true
    git pull github "${GITHUB_REF}" --ff-only
    git push github HEAD:"${GITHUB_REF}"
fi