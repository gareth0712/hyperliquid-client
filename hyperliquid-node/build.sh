#!/bin/bash

VERSION=1.0.0
docker build \
--no-cache \
--platform linux/amd64 \
--tag "gcr.io/release-builds/hyperliquid-node:$VERSION" .
cd pruner
docker build \
--no-cache \
--platform linux/amd64 \
--tag "gcr.io/release-builds/hyperliquid-pruner:$VERSION" .
docker push "gcr.io/release-builds/hyperliquid-node:$VERSION"
docker push "gcr.io/release-builds/hyperliquid-pruner:$VERSION"
echo "published gcr.io/release-builds/hyperliquid-node:$VERSION & gcr.io/release-builds/hyperliquid-pruner:$VERSION"
