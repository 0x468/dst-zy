#!/bin/sh

set -e

echo "Placeholder entrypoint: launching supervisord"
exec /usr/bin/supervisord -n
