"use strict";

const targetPage = "<all_urls>";

const tabData = new Map();

const PatternLanguage = Parsimmon.createLanguage({
  Pattern(L) {
    return Parsimmon.alt(L.Token, L.Literal).many();
  },

  Token() {
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

function replaceURL(pattern, match) {
  return parsePattern(pattern)
    .map(p => {
      if (p.name === "Token") {
        return match[p.value];
      } else if (p.name === "Literal") {
        return p.value;
      }
      throw new Error(`unknown pattern type: ${p.name}`);
    })
    .join("");
}

function matchOrigin(pattern, target) {
  try {
    const patternURL = parseURL(pattern);
    const targetURL = parseURL(target);
    return matchPart({
      pattern: parsePattern(patternURL.origin),
      target: targetURL.origin,
      separators: ":."
    });
  } catch (err) {
    if (err.type === "ParsimmonError") {
      return undefined;
    }
    throw err;
  }
}

function matchURL(pattern, target) {
  try {
    const patternURL = parseURL(pattern);
    const targetURL = parseURL(target);
    const originMatch = matchPart({
      pattern: parsePattern(patternURL.origin),
      target: targetURL.origin,
      separators: ":."
    });
    const pathnameMatch = matchPart({
      pattern: parsePattern(decodeURIComponent(patternURL.pathname)),
      target: decodeURIComponent(targetURL.pathname),
      separators: "/"
    });
    const searchMatch = matchPart({
      pattern: parsePattern(patternURL.search),
      target: targetURL.search,
      separators: "&="
    });
    const match = {
      ...originMatch,
      ...pathnameMatch,
      ...searchMatch
    };
    if (Object.keys(match).length === 0) {
      return undefined;
    }
    return match;
  } catch (err) {
    if (err.type === "ParsimmonError") {
      return undefined;
    }
    throw err;
  }
}

function updateTabBadge(tabId, tabData) {
  const { cspDisabled, redirectCount } = tabData;
  const text = String(redirectCount);
  const color = cspDisabled ? "#c00" : "#444";
  browser.browserAction.setBadgeText({ text, tabId });
  browser.browserAction.setBadgeBackgroundColor({ color, tabId });
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
    if (changeInfo.status === "complete") {
      tabData.delete(tabId);
    }
  },

  onRemoved(event) {
    tabData.delete(event.tabId);
  },

  onBeforeRequest(event) {
    if (!config.enabled) {
      return {};
    }
    const { url, tabId } = event;
    for (const obj of config.redirectRules) {
      const match = matchURL(obj.fromPattern, url);
      if (match) {
        const data = getTabData(tabId);
        data.redirectCount++;
        updateTabBadge(tabId, data);
        return { redirectUrl: replaceURL(obj.toPattern, match) };
      }
    }
    return {};
  },

  onHeadersReceived(event) {
    if (!config.enabled) {
      return {};
    }
    if (!event.responseHeaders) {
      return {};
    }
    const { url, responseHeaders, tabId } = event;
    const matches = config.removeCSPRules.some(obj => {
      return matchOrigin(obj.originPattern, url);
    });
    if (!matches) {
      return {};
    }
    return {
      responseHeaders: responseHeaders.filter(header => {
        if (header.name.toLowerCase() === "content-security-policy") {
          const data = getTabData(tabId);
          data.cspDisabled = true;
          updateTabBadge(tabId, data);
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

function updateConfigJSON(json) {
  localStorage.setItem("config", json);
  config = getConfig();
}

function getDefaultConfig() {
  return sanitizedConfig({
    configSchemaVersion: 1,
    enabled: true,
    removeCSPRules: [{ enabled: true, originPattern: "*://*.example.com" }],
    redirectRules: [
      {
        enabled: true,
        fromPattern: "https://example.com/{version}/jquery.min.js",
        toPattern: "https://example.com/{version}/jquery.js"
      },
      {
        enabled: false,
        fromPattern: "https://example.com/js/{file}",
        toPattern: "https://localhost:8000/{file}"
      }
    ]
  });
}

function sanitizedCSPRule(rule) {
  return {
    enabled: Boolean(rule.enabled),
    originPattern: String(rule.originPattern)
  };
}

function sanitizedRedirectRule(rule) {
  return {
    enabled: Boolean(rule.enabled),
    fromPattern: String(rule.fromPattern),
    toPattern: String(rule.toPattern)
  };
}

function sanitizedConfig(data) {
  return {
    configSchemaVersion: Number(data.configSchemaVersion || 1),
    enabled: Boolean(data.enabled),
    removeCSPRules: (data.removeCSPRules || []).map(sanitizedCSPRule),
    redirectRules: (data.redirectRules || []).map(sanitizedRedirectRule)
  };
}

function getConfig() {
  const json = localStorage.getItem("config");
  if (!json) {
    return getDefaultConfig();
  }
  const data = JSON.parse(json);
  return sanitizedConfig(data);
}

let config = getConfig();
