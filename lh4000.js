javascript:(function() {
    var script = document.createElement('script');
    script.src = "http://localhost:4000/index.js";
    setTimeout(()=>script.remove());
    document.body.append(script);
})();