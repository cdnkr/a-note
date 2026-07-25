(function (root) {
  "use strict";

  // Replace these deployment values when the web app and Store listing launch.
  root.ANoteConfig = Object.freeze({
    // webAppOrigin: "https://a-note.example",
    // apiBaseUrl: "https://a-note.example/api/shares",
    webAppOrigin: "http://localhost:8788",
    apiBaseUrl: "http://localhost:8788/api/shares",
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
