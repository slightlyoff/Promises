// Copyright (C) 2013:
//    Alex Russell (slightlyoff@chromium.org)
// Use of this source code is governed by
//    http://www.apache.org/licenses/LICENSE-2.0

var promisesAplusTests = require("../third_party/promises-tests");
var fs = require("fs");
var _eval = require("eval");

var Future = _eval(fs.readFileSync("../src/Future.js", "utf-8") +
                                   "module.exports = Future;");

var adapter = {
  rejected: function(reason) {
    return new Future(function(r) { r.reject(reason); });
  },

  fulfilled: function(value) {
    return new Future(function(r) { r.accept(value); });
  },

  pending: function() {
    var resolver;
    var future = new Future(function(r) { resolver = r; });
    return {
      promise: future,
      fulfill: resolver.resolve.bind(resolver),
      reject:  resolver.reject.bind(resolver),
    };
  }
};

promisesAplusTests(adapter, console.log);
