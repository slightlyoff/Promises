#!/bin/bash

# Copyright 2012:
#      Alex Russell <slightlyoff@chromium.org>
#
# Run it through uglify.
python post.py ../src/Promise.js > ../bin/Promise.min.js
