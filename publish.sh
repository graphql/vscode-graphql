#!/bin/sh

if [ ! -f .envrc ]
then
  export $(cat .envrc | xargs)
fi

if [ -z "$PAT" ]
then
    echo "\$PAT is empty. Please set the value of $PAT"
else
    if [ -z "$LOCAL" ]
    then
        echo "Printing the command because LOCAL is set"
        echo "npm run vsce:publish patch --pat $PAT"
    else
        npm run vsce:publish patch --pat $PAT
        git remote add github "https://$GITHUB_ACTOR:$GITHUB_TOKEN@github.com/$GITHUB_REPOSITORY.git" || true
        git pull github "${GITHUB_REF}" --ff-only
        git push github HEAD:"${GITHUB_REF}"
    fi
fi