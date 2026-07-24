(function (root) {
  "use strict";

  // Replace these deployment values when the web app and Store listing launch.
  root.AnnotateConfig = Object.freeze({
    // webAppOrigin: "https://annotate.example",
    // apiBaseUrl: "https://annotate.example/api/shares",
    webAppOrigin: "http://localhost:8788",
    apiBaseUrl: "http://localhost:8788/api/shares",
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
