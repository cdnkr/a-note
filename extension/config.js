(function (root) {
  "use strict";

  // Replace these deployment values when the web app and Store listing launch.
  root.AnnotateConfig = Object.freeze({
    // webAppOrigin: "https://annotate.example",
    // apiBaseUrl: "https://annotate.example/api/shares",
    webAppOrigin: "http://localhost:8788",
    apiBaseUrl: "http://localhost:8788/api/shares",
    allowedWebAppOrigins: [
      "https://annotate.example",
      "http://localhost:5173",
      "http://localhost:8788",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:8788",
    ],
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
