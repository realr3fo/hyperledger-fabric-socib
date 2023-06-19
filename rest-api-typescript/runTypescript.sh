#!/bin/bash

TEST_NETWORK_HOME=$HOME/go/src/github.com/realr3fo/SOCIB-hfradar-blockchain-hlf/test-network npm run generateEnv

docker stop $(docker ps -q --filter "name=redis") && docker rm $(docker ps -aq --filter "name=redis")

export REDIS_PASSWORD=$(uuidgen)

npm run start:redis

SAMPLE_APIKEY=$(grep ORG1_APIKEY .env | cut -d '=' -f 2-)
echo API key
echo $SAMPLE_APIKEY

if [[ $1 == "-c" && $2 ]]; then
    CHANNEL_NAME=$2
    echo "HLF_CHANNEL_NAME=$CHANNEL_NAME" >> .env
fi

npm run build
npm run start:dev
