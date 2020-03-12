#!/bin/bash

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
    fi
fi