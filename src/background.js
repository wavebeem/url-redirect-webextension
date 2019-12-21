"use strict";

const targetPage = "<all_urls>";

const tabData = new Map();

const PatternLanguage = Parsimmon.createLanguage({
  Pattern(L) {
    return Parsimmon.alt(L.Token, L.Literal).many();
  },

  Token(L) {
    return Parsimmon.alt(
      Parsimmon.string("*"),
      Parsimmon.regexp(/[^{}]*/).wrap(
        Parsimmon.string("{"),
        Parsimmon.string("}")
      )
    ).node("Token");
  },

  Literal() {
    return Parsimmon.regexp(/[^{}*]+/).node("Literal");
  }
});

function createMatcher({ pattern, separators }) {
  return Parsimmon.seq(
    ...pattern.map(p => {
      if (p.name === "Token") {
        return Parsimmon.noneOf(separators)
          .many()
          .tie()
          .map(m => ({ name: p.value, value: m }));
      } else if (p.name === "Literal") {
        return Parsimmon.string(p.value).result(undefined);
      }
    })
  ).map(matches => {
    const map = {};
    for (const match of matches) {
      if (match) {
        map[match.name] = match.value;
      }
    }
    return map;
  });
}

function parsePattern(pattern) {
  return PatternLanguage.Pattern.tryParse(pattern);
}

function matchPart({ pattern, target, separators }) {
  return createMatcher({ pattern, separators }).tryParse(target);
}

const URLLanguage = Parsimmon.createLanguage({
  URL(L) {
    return Parsimmon.seqObj(
      ["origin", L.Origin],
      ["pathname", L.Pathname],
      ["search", L.Search]
    );
  },

  Origin() {
    return Parsimmon.regexp(/[^:/]+[:][/][/][^/]+/);
  },

  Pathname() {
    return Parsimmon.regexp(/[/][^?]*/).or(Parsimmon.of("/"));
  },

  Search() {
    return Parsimmon.all;
  }
});

function parseURL(url) {
  return URLLanguage.URL.tryParse(url);
}

function match(pattern, target) {
  try {
    const patternURL = parseURL(pattern);
    const targetURL = parseURL(target);
    const matchOrigin = matchPart({
      pattern: parsePattern(patternURL.origin),
      target: targetURL.origin,
      separators: ":."
    });
    const matchPathname = matchPart({
      pattern: parsePattern(decodeURIComponent(patternURL.pathname)),
      target: decodeURIComponent(targetURL.pathname),
      separators: "/"
    });
    const matchSearch = matchPart({
      pattern: parsePattern(patternURL.search),
      target: targetURL.search,
      separators: "&="
    });
    const match = {
      ...matchOrigin,
      ...matchPathname,
      ...matchSearch
    };
    if (Object.keys(match).length === 0) {
      return undefined;
    }
    return match;
  } catch (err) {
    console.log(err);
    return undefined;
  }
}

function updateTabBadge(tabId, tabData) {
  browser.browserAction.setBadgeText({
    text: `${tabData.cspDisabled ? "*" : ""}${tabData.redirectCount}`,
    tabId
  });
  browser.browserAction.setBadgeBackgroundColor({
    color: tabData.cspDisabled ? "#0c0" : "#444",
    tabId
  });
}

function getTabData(tabId) {
  const data = tabData.get(tabId);
  if (data) {
    return data;
  }
  const newData = {
    redirectCount: 0,
    cspDisabled: false
  };
  tabData.set(tabId, newData);
  return newData;
}

const handlers = {
  onClicked() {
    browser.tabs.create({ url: browser.runtime.getURL("src/configure.html") });
  },

  onUpdated(tabId, changeInfo /*, tab */) {
    if (changeInfo.status === "loading" || changeInfo.status === "loading") {
      tabData.delete(tabId);
    }
  },

  onRemoved(event) {
    tabData.delete(event.tabId);
  },

  onBeforeRequest(event) {
    console.log("onBeforeRequest", event);
    const { url, tabId } = event;
    if (
      url ===
      "https://storage.googleapis.com/meridian-editor-frontend/3.36.0-build.3/index.bundle.js"
    ) {
      const data = getTabData(tabId);
      data.redirectCount++;
      updateTabBadge(tabId, data);
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
    const { url, responseHeaders, tabId } = event;
    console.log("onHeadersReceived", url);
    return {
      responseHeaders: responseHeaders.filter(header => {
        if (header.name.toLowerCase() === "content-security-policy") {
          getTabData(tabId).cspDisabled = true;
          return false;
        }
        return true;
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
browser.tabs.onRemoved.addListener(handlers.onRemoved);
browser.tabs.onUpdated.addListener(handlers.onUpdated);
browser.browserAction.onClicked.addListener(handlers.onClicked);

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
