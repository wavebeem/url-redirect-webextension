"use strict";

const targetPage = "<all_urls>";

const handlers = {
  onBeforeRequest(event) {
    const { url } = event;
    if (
      url ===
      "https://storage.googleapis.com/meridian-editor-frontend/3.36.0-build.3/index.bundle.js"
    ) {
      return {
        redirectUrl: "https://unpkg.com/jquery@3.4.1/dist/jquery.min.js"
      };
    }
    return {};
  },

  onHeadersReceived(event) {
    if (!event.responseHeaders) {
      return {};
    }
    const { url, responseHeaders } = event;
    console.log("onHeadersReceived", url);
    return {
      responseHeaders: responseHeaders.filter(header => {
        return header.name.toLowerCase() !== "content-security-policy";
      })
    };
  }
};

browser.webRequest.onBeforeRequest.addListener(
  handlers.onBeforeRequest,
  { urls: [targetPage] },
  ["blocking"]
);

browser.webRequest.onHeadersReceived.addListener(
  handlers.onHeadersReceived,
  { urls: [targetPage] },
  ["blocking", "responseHeaders"]
);

function updateConfig(newConfig) {
  console.log("new config", newConfig);
  localStorage.setItem("config", JSON.stringify(newConfig, null, 2));
}

function getConfig() {
  const json = localStorage.getItem("config");
  if (!json) {
    return {
      version: "1",
      remove_csp_patterns: [],
      redirect_patterns: []
    };
  }
  return JSON.parse(json);
}
