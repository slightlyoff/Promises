<img src="http://promises-aplus.github.com/promises-spec/assets/logo-small.png"
     align="right" alt="Promises/A+ logo, since DOMFutures are compatible" />

# DOM Futures

DOM Futures (aka "Promises") Design, currently in IDL. Also a p(r)ollyfill 
and re-worked APIs to take advantage of the new semantics.

## Examples

```js
// New APIs that vend Futures are easier to reason about. Instead of:
if (document.readyState == 4) {
  doStartupWork();
} else {
  document.addEventListener("load", doStartupWork, false);
}

// ...a Future-vending ready() method can be used at any time:
document.ready().then(doStartupWork);

// Like other Promises-style APIs, .then() and .done() are the 
// primary way to work with Futures, including via chaining, in
// this example using an API proposed at:
//    https://github.com/slightlyoff/async-local-storage
var storage = navigator.storage;
storage.get("item 1").then(function(item1value) {
  return storage.set("item 1", "howdy");
}).
done(function() {
  // The previous future is chained to not resolve until 
  //item 1 is set to "howdy"
  storage.get("item 1").done(console.log);
});
```

Futures can also be new'd up and used in your own APIs, making them a powerful
abstraction for building asnchronous contracts for single valued operations; 
basically any time you want to do some work asynchronously but only care about
a single response value:

```js
function fetchJSON(filename) {
  // Return a Future that represents the fetch:
  return new Future(function(resolver){
    // The resolver is how a Future is satisfied. It has reject(), accept(), 
    // and resolve() methods that your code can use to inform listeners with:
    var xhr = new XMLHttpRequest();
    xhr.open("GET", filename, true);
    xhr.send();
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        try {
          resolver.accept(JSON.parse(xhr.responseText));          
        } catch(e) {
          resolver.reject(e);
        }
      }
    }
  });
}

// Now we can use the uniform Future API to reason about JSON fetches:
fetchJSON("thinger.json").then(function(object) { ...} ,
                               function(error) { ... });
```
