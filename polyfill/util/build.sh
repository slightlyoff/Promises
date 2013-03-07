#!/bin/bash

# Copyright 2012:
#      Alex Russell <slightlyoff@chromium.org>
#
# Run it through uglify.
python post.py ../src/Future.js > ../bin/Future.min.js
