#!/bin/bash

set -e

TARGET=$1

shift

PROJECT=$(dirname $TARGET)
while [[ ! -f "$PROJECT/tsconfig.json" ]]; do
  PROJECT=$(dirname $PROJECT)
done

DEPLOY_ENV_GROUP=${DEPLOY_ENV_GROUP:-${DEPLOY_ENV:-${ENV:-development}}}
DEPLOY_ENV=${DEPLOY_ENV:-${DEPLOY_ENV_GROUP:-${ENV:-development}}}

export DEPLOY_ENV_GROUP=$DEPLOY_ENV_GROUP
export DEPLOY_ENV=$DEPLOY_ENV

./node_modules/.bin/tsx --tsconfig $PROJECT/tsconfig.json $TARGET $@
