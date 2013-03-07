// Copyright (C) 2013:
//    Alex Russell (slightlyoff@chromium.org)
// Use of this source code is governed by
//    http://www.apache.org/licenses/LICENSE-2.0

(function() {
"use strict";

var t = doh;

//
// Trivial utilities.
//
var log = console.log.bind(console);
var rejected = function(reason) {
  return new Future(function(r) { r.reject(reason); });
};
var accepted = function(value) {
  return new Future(function(r) { r.accept(value); });
};
var resolved = function(value) {
  return new Future(function(r) { r.resolve(value); });
};
var pending = function() {
  var resolver;
  var future = new Future(function(r) { resolver = r; });
  return {
    future: future,
    accept: resolver.accept,
    reject: resolver.reject,
    resolve: resolver.resolve,
  };
};

var dummy = { dummy: "dummy" };
var sentinel = { sentinel: "sentinel" };

var async = function(desc, test) {
  return {
    name: desc,
    runTest: function() {
      var d = new doh.Deferred();
      test(d, d.callback.bind(d), d.errback.bind(d));
      return d;
    }
  };
};

t.add("Future", [
  function prototypeMethods() {
    t.is(typeof Future.prototype.then, "function");
    t.is(Future.prototype.then.length, 2);
    t.is(typeof Future.prototype.done, "function");
    t.is(Future.prototype.done.length, 2);
    t.is(typeof Future.prototype.catch, "function");
    t.is(Future.prototype.catch.length, 1);

    var c = 0;
    for(var x in Future.prototype) { c++; }
    t.is(c, 3);
  },

  function no_arg_ctor() {
    var future = new Future();
    t.is("pending", future.state);
  },

  function base_state() {
    var resolver;
    t.is(undefined, resolver);
    var future = new Future(function(r) { resolver = r; });
    t.t(future instanceof Future);
    t.is(undefined, future.value);
    t.is(undefined, future.error);
    t.is("pending", future.state);
    t.is("object", typeof resolver);
    t.is(false, resolver.isResolved);
  },

  async("Is delivery delayed?", function(d) {
    var resolver;
    var resolved = false;
    var future = new Future(function(r) { resolver = r; });
    future.then(function(value) {
      resolved = true;
      t.is(true, value);
      d.callback(value);
    });

    t.is(future.state, "pending");
    t.is(false, resolved);
    t.is(false, resolver.isResolved);
    resolver.resolve(true);
    // FIXME: what should future.value be here?
    t.is("pending", future.state);
    t.is(true, resolver.isResolved);
  }),

  function done_returns_self() {
    var f = new Future();
    t.t(f.done() === f);
  },

  function catch_returns_self() {
    var f = new Future();
    t.t(f.catch() === f);
  },

  async("Values forward correctly", function(d) {
    var eb = d.errback.bind(d);
    var f = accepted(dummy);
    f.then()
     .done(null, eb)
     .done(function(e) {
        t.is(dummy, e);
        d.callback();
     }, eb);
  }),

  async("Errors forward correctly", function(d) {
    var f = rejected("meh");
    f.then(log)
     .done(log, function(e) {
        t.is("meh", e);
        d.callback();
     });
  }),
]);

doh.add("Resolver", [

  function invariants() {
    new Future(function(r) {
      t.is(r.isResolved, false)
      var isResolvedPD = Object.getOwnPropertyDescriptor(r, "isResolved");
      t.is("function", typeof isResolvedPD.get);
      t.is("undefined", typeof isResolvedPD.set);
      t.t(isResolvedPD.enumerable);
      t.f(isResolvedPD.configurable);

      t.is("function", typeof r.accept);
      t.is("function", typeof r.reject);
      t.is("function", typeof r.resolve);
      t.is("function", typeof r.cancel);
      t.is("function", typeof r.timeout);
    });
  },

  async("cancel", function(d) {
    var resolver;
    var future = new Future(function(r) {
      try {
        resolver = r;
        t.f(r.isResolved);
        r.cancel();
        t.t(resolver.isResolved);
      } catch(e) {
        d.errback(e);
      }
    });
    t.is("pending", future.state);
    future.done(
      d.errback.bind(d),
      function(e) {
        t.is("object", typeof e);
        t.t(e instanceof Error);
        // FIXME: e doesn't seem to have a .name property!!!
        t.is("Error: Cancel", e.toString());
        d.callback();
      }
    );
    t.t(resolver.isResolved);
    t.is("pending", future.state);
  }),

  async("timeout", function(d) {
    var resolver;
    var future = new Future(function(r) {
      try {
        resolver = r;
        t.f(r.isResolved);
        r.timeout();
        t.t(resolver.isResolved);
      } catch(e) {
        d.errback(e);
      }
    });
    t.is("pending", future.state);
    future.done(
      d.errback.bind(d),
      function(e) {
        t.is("object", typeof e);
        t.t(e instanceof Error);
        t.is("Error: Timeout", e.toString());
        d.callback();
      }
    );
    t.t(resolver.isResolved);
    t.is("pending", future.state);
  }),

  async("resolve forwards errors", function(d) {
    var e = new Error("synthetic");
    var resolver;
    var f1 = new Future(function(r) {
      r.reject(e);
    });
    var f2 = new Future(function(r) {
      r.resolve(f1);
    });
    f2.done(
      d.errback.bind(d),
      function(err) {
        t.is("object", typeof err);
        t.t(err instanceof Error);
        t.is("Error: synthetic", err.toString());
        t.is(e.toString(), err.toString());
        t.is(e, err);
        d.callback();
      }
    );
  }),

  async("resolve forwards values", function(d) {
    var v = new Error("synthetic");
    var resolver;
    var f1 = new Future(function(r) {
      r.accept(v);
    });
    var f2 = new Future(function(r) {
      r.resolve(f1);
    });
    f2.done(
      function(value) {
        t.is("object", typeof value);
        t.t(value instanceof Error);
        t.is("Error: synthetic", value.toString());
        t.is(v, value);
        d.callback();
      },
      d.errback.bind(d)
    );
  }),

  async("resolve does not forward non futures", function(d) {
    var v = new Error("synthetic");
    var resolver;
    var f1 = new Future(function(r) {
      r.resolve(v);
    });
    var f2 = new Future(function(r) {
      r.resolve(f1);
    });
    f2.done(
      function(value) {
        t.is("object", typeof value);
        t.t(value instanceof Error);
        t.is("Error: synthetic", value.toString());
        t.is(v, value);
        d.callback();
      },
      d.errback.bind(d)
    );
  }),

  async("resolve forwards values through then", function(d) {
    var v = new Error("synthetic");
    var resolver;
    var f1 = new Future(function(r) {
      r.resolve(v);
    });
    var f2 = new Future(function(r) {
      r.resolve(f1);
    });
    var f3 = f2.then(
      function(value) {
        t.is("object", typeof value);
        t.t(value instanceof Error);
        t.is("Error: synthetic", value.toString());
        t.is(v, value);
        return new Future(function(r) {
          r.resolve("some other value");
        });
      },
      function(e) { return e; }
    );
    f3.done(
      function(value) {
        t.is("some other value", value);
        d.callback();
      },
      d.errback.bind(d)
    );
  }),

  //
  // Inspired by the promises-tests repo.
  //
  async("non function rejected callbacks are ignored",
    function(d, done, error) {
      var nonFunction = 10;
      rejected(dummy).then(10, done);
    }
  ),

  async("non function accepted callbacks are ignored",
    function(d, done, error) {
      var nonFunction = 10;
      accepted(dummy).then(done, 10);
    }
  ),

]);

})();
