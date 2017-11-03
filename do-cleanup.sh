#!/bin/bash
docker-compose down
dm remote switch local
dm volume delete -f moby_counter
dm remote switch origin
dm volume delete -f lukemarsden/moby_counter
dm remote switch local
