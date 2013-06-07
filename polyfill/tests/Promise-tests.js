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

var rejected = Future.reject;
var asyncRejected = function(reason) {
  return new Future(function(r) {
    setTimeout(r.reject.bind(r, reason), 0);
  });
};

var accepted = Future.accept;
var asyncAccepted = function(value) {
  return new Future(function(r) {
    setTimeout(r.accept.bind(r, value), 0);
  });
};

var resolved = Future.resolve;
var asyncResolved = function(value) {
  return new Future(function(r) {
    setTimeout(r.resolve.bind(r, value), 0);
  });
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
var acceptedSentinel = accepted(sentinel);
var rejectedSentinel = rejected(sentinel);

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
    t.is("pending", future._state);
  },

  function base_state() {
    var resolver;
    t.is(undefined, resolver);
    var future = new Future(function(r) { resolver = r; });
    t.t(future instanceof Future);
    t.is(undefined, future._value);
    t.is(undefined, future._error);
    t.is("pending", future._state);
    t.is("object", typeof resolver);
    t.is(false, resolver._isResolved);
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

    t.is(future._state, "pending");
    t.is(false, resolved);
    // t.is(false, resolver._isResolved);
    resolver.resolve(true);
    // FIXME: what should future._value be here?

    t.is("pending", future._state);
    t.is(true, resolver._isResolved);
  }),

  function done_returns_self() {
    var f = new Future();
    t.t(f.done() === f);
  },

  function catch_does_not_return_self() {
    var f = new Future();
    t.t(f.catch() !== f);
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
      t.is(r._isResolved, false)
      var isResolvedPD = Object.getOwnPropertyDescriptor(r, "_isResolved");
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
        t.f(r._isResolved);
        r.cancel();
        t.t(resolver._isResolved);
      } catch(e) {
        d.errback(e);
      }
    });
    t.is("pending", future._state);
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
    t.t(resolver._isResolved);
    t.is("pending", future._state);
  }),

  async("timeout", function(d) {
    var resolver;
    var future = new Future(function(r) {
      try {
        resolver = r;
        t.f(r._isResolved);
        r.timeout();
        t.t(resolver._isResolved);
      } catch(e) {
        d.errback(e);
      }
    });
    t.is("pending", future._state);
    future.done(
      d.errback.bind(d),
      function(e) {
        t.is("object", typeof e);
        t.t(e instanceof Error);
        t.is("Error: Timeout", e.toString());
        d.callback();
      }
    );
    t.t(resolver._isResolved);
    t.is("pending", future._state);
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

  async("Futures forward through then", function(d, done, error) {
    // FIXME(slightlyoff)
    done();
  }),


  async("isResolved is true while forwarding", function(d) {
    var f1 = pending();
    var r1;
    var f2 = new Future(function(r) {
      r1 = r;
      r.resolve(f1);
    });
    t.t(r1._isResolved);
    d.callback();
  }),

  async("Throwing in a then callback rejects next.", function(d, done, e) {
    accepted(5).then(function(v) {
      throw new Error("Blarg!");
    }).done(e, function(e){done();});
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

  // Future.any

  async("Future.any fails on no values", function(d, done, error) {
    Future.any().done(error, done);
  }),

  async("Future.any succeeds on undefined", function(d, done, error) {
    Future.any(undefined).done(done, error);
  }),

  async("Future.any succeeds on raw values", function(d, done, error) {
    Future.any("thinger", undefined, [], new String("blarg")).done(done, error);
  }),

  async("Future.any fails on rejected", function(d, done, error) {
    Future.any(rejected()).done(error, done);
  }),

  async("Future.any succeeds on accepted", function(d, done, error) {
    Future.any(accepted()).done(done, error);
  }),

  async("Future.any succeeds on accepted sentinel", function(d, done, error) {
    Future.any(acceptedSentinel).done(done, error);
  }),

  async("Future.any succeeds on asyncAccepted", function(d, done, error) {
    Future.any(asyncAccepted()).done(done, error);
  }),

  async("Future.any succeeds on value + accepted", function(d, done, error) {
    Future.any("thinger", accepted(dummy)).done(done, error);
  }),

  async("Future.any succeeds on accepted + rejected", function(d, done, error) {
    Future.any(acceptedSentinel, rejectedSentinel).done(done, error);
  }),

  async("Future.any fails on rejected + accepted", function(d, done, error) {
    Future.any(rejected(dummy), accepted("thinger")).done(error, done);
  }),

  async("Future.any succeeds on pre-accepted + pre-rejected",
    function(d, done, error) {
      Future.any(acceptedSentinel, rejectedSentinel).done(done, error);
    }
  ),

  async("Future.any succeeds on value + rejected", function(d, done, error) {
    Future.any("value", rejected("error")).done(done, error);
  }),

  async("Future.any succeeds on rejected + value", function(d, done, error) {
    Future.any(rejectedSentinel, "thinger").done(done, error);
  }),

  // Future.every

  async("Future.every fails on no values", function(d, done, error) {
    Future.every().done(error, done);
  }),

  async("Future.every succeeds on undefined", function(d, done, error) {
    Future.every(undefined).done(done, error);
  }),

  async("Future.every succeeds on raw values", function(d, done, error) {
    Future.every("thinger", undefined, [], new String("blarg")).done(done, error);
  }),

  async("Future.every fails on rejected", function(d, done, error) {
    Future.any(rejected()).done(error, done);
  }),

  async("Future.every succeeds on accepted", function(d, done, error) {
    Future.every(accepted()).done(done, error);
  }),

  async("Future.every succeeds on asyncAccepted", function(d, done, error) {
    Future.every(asyncAccepted()).done(done, error);
  }),

  async("Future.every fails on rejected + value", function(d, done, error) {
    Future.every(rejected(), "thinger").done(error, done);
  }),

  async("Future.every fails on asyncRejected + value", function(d, done, error) {
    Future.every(asyncRejected(), "thinger").done(error, done);
  }),

  async("Future.every forwards values", function(d, done, error) {
    Future.every(
      Future.every(asyncAccepted(5), "thinger").done(function(values) {
        t.is([5, "thinger"], values);
      }),
      Future.every(asyncAccepted(5), "thinger").done(function(values) {
        t.is([5, "thinger"], values);
      })
    ).done(done, error);
  }),

  async("Future.every forwards values multiple levels",
    function(d, done, error) {
      Future.every(asyncResolved(asyncResolved(5)), "thinger")
        .done(function(values) {
          t.is([5, "thinger"], values);
          done();
        }, error);
    }
  ),

  // Future.some

  async("Future.some fails on no values", function(d, done, error) {
    Future.some().done(error, done);
  }),

  async("Future.some succeeds on undefined", function(d, done, error) {
    Future.some(undefined).done(done, error);
  }),

  async("Future.some succeeds on raw values", function(d, done, error) {
    Future.some("thinger", undefined, [], new String("blarg")).done(done, error);
  }),

  async("Future.some fails on rejected", function(d, done, error) {
    Future.some(rejected()).done(error, done);
  }),

  async("Future.some succeeds on accepted", function(d, done, error) {
    Future.some(accepted()).done(done, error);
  }),

  async("Future.some succeeds on asyncAccepted", function(d, done, error) {
    Future.some(asyncAccepted()).done(done, error);
  }),

  async("Future.some succeeds on rejected + accepted", function(d, done, error) {
    Future.some(rejectedSentinel, acceptedSentinel).done(done, error);
  }),

  async("Future.some succeeds on value + rejected", function(d, done, error) {
    Future.some("thinger", rejectedSentinel).done(done, error);
  }),

  // Future.accept

  async("Future.accept is sane", function(d, done, error) {
    Future.accept(sentinel).done(function(v) {
      t.is(sentinel, v);
      done();
    }, error);
  }),

  // FIXME(slightlyoff): MOAR TESTS


  // Future.resolve

  async("Future.resolve is sane", function(d, done, error) {
    Future.resolve(sentinel).done(function(v) {
      t.is(sentinel, v);
      done();
    }, error);
  }),

  // FIXME(slightlyoff): MOAR TESTS


  // Future.reject

  async("Future.reject is sane", function(d, done, error) {
    Future.reject(sentinel).done(error, function(reason) {
      t.is(sentinel, reason);
      done();
    });
  }),

  // FIXME(slightlyoff): MOAR TESTS
]);

})();
