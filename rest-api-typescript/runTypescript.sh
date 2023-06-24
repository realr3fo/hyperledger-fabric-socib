#!/bin/bash

TEST_NETWORK_HOME=$(pwd)/../test-network npm run generateEnv

docker stop $(docker ps -q --filter "name=redis")
docker rm $(docker ps -aq --filter "name=redis")

export REDIS_PASSWORD=$(uuidgen)

npm run start:redis

SAMPLE_APIKEY=$(grep ORG1_APIKEY .env | cut -d '=' -f 2-)

if [[ $1 == "-c" && $2 ]]; then
    CHANNEL_NAME=$2
    echo "HLF_CHANNEL_NAME=$CHANNEL_NAME" >> .env
fi

npm run build

echo "$(tput bold)API key$(tput sgr0)"
echo "Use the following api key for CRUD: $(tput setaf 2)${SAMPLE_APIKEY}$(tput sgr0)"

npm run start:dev
