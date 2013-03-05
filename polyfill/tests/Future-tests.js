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
var dummy = { dummy: "dummy" };

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
    return;
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


  function is_delivery_delayed() {
    var d = new doh.Deferred();
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
    return d;
  },

  function done_returns_self() {
    var f = new Future();
    t.t(f.done() === f);
  },

  function catch_returns_self() {
    var f = new Future();
    t.t(f.catch() === f);
  },

  function values_forward() {
    var d = new doh.Deferred();
    var eb = d.errback.bind(d);
    var f = accepted(dummy);
    f.then()
     .done(null, eb)
     .done(function(e) {
        t.is(dummy, e);
        d.callback();
     }, eb);
    return d;
  },

  // FIXME: add tests for:
  //  - forwarding of errors/values down the chain if unhandled
  function errors_forward() {
    var d = new doh.Deferred();
    var f = rejected("meh");
    f.then(log)
     .done(log, function(e) {
        t.is("meh", e);
        d.callback();
     });
    return d;
  },
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

  function cancel() {
    var d = new doh.Deferred();
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
    return d;
  },

  function timeout() {
    var d = new doh.Deferred();
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
    return d;
  },

  function resolve_forwards_errors() {
    var d = new doh.Deferred();
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
    return d;
  },

  function resolve_forwards_values() {
    var d = new doh.Deferred();
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
    return d;
  },

  function resolve_does_not_forward_non_futures() {
    var d = new doh.Deferred();
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
    return d;
  },

  function resolve_forwards_values_through_then() {
    var d = new doh.Deferred();
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
    return d;
  },

  //
  // Inspired by the promises-tests repo.
  //
  function non_function_callbacks_are_ignored() {
    var d = new doh.Deferred();
    var nonFunction = 10;
    rejected(dummy).then(nonFunction, d.callback.bind(d));
    return d;
  },

]);

})();
