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
  const color = cspDisabled ? "#c00" : "#26c";
  const title = [
    redirectCount === 1 ? "1 redirect" : `${redirectCount} redirects`,
    cspDisabled ? "CSP disabled" : "",
    `URL Switcher is ${settings.enabled ? "enabled" : "disabled"}`
  ]
    .filter(x => x)
    .join(" | ");
  browser.browserAction.setBadgeText({ text, tabId });
  browser.browserAction.setBadgeBackgroundColor({ color, tabId });
  browser.browserAction.setTitle({ title, tabId });
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
    browser.tabs.create({ url: browser.runtime.getURL("src/settings.html") });
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
    if (!settings.enabled) {
      return {};
    }
    const { url, tabId } = event;
    for (const rule of settings.redirectRules) {
      if (!rule.enabled) {
        continue;
      }
      const match = matchURL(rule.fromPattern, url);
      if (match) {
        const data = getTabData(tabId);
        data.redirectCount++;
        updateTabBadge(tabId, data);
        return { redirectUrl: replaceURL(rule.toPattern, match) };
      }
    }
    return {};
  },

  onHeadersReceived(event) {
    if (!settings.enabled) {
      return {};
    }
    if (!event.responseHeaders) {
      return {};
    }
    const { url, responseHeaders, tabId } = event;
    const matches = settings.removeCSPRules.some(rule => {
      return rule.enabled && matchOrigin(rule.originPattern, url);
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

function updateBrowserAction() {
  browser.browserAction.setTitle({
    title: settings.enabled
      ? "URL Switcher is enabled"
      : "URL Switcher is disabled"
  });
  const enabledIcons = {
    16: browser.runtime.getURL("img/icon-enabled.png"),
    32: browser.runtime.getURL("img/icon-enabled@2x.png")
  };
  const disabledIcons = {
    16: browser.runtime.getURL("img/icon-disabled.png"),
    32: browser.runtime.getURL("img/icon-disabled@2x.png")
  };
  browser.browserAction.setIcon({
    path: settings.enabled ? enabledIcons : disabledIcons
  });
  initializeTabData().catch(err => {
    console.error(err);
  });
}

function updateSettingsJSON(json) {
  localStorage.setItem("settings", json);
  settings = getSettings();
  updateBrowserAction();
}

function getDefaultSettings() {
  return sanitizedSettings({
    settingsSchemaVersion: 1,
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

function sanitizedSettings(data) {
  return {
    settingsSchemaVersion: Number(data.settingsSchemaVersion || 1),
    enabled: Boolean(data.enabled),
    removeCSPRules: (data.removeCSPRules || []).map(sanitizedCSPRule),
    redirectRules: (data.redirectRules || []).map(sanitizedRedirectRule)
  };
}

function getSettings() {
  try {
    const json = localStorage.getItem("settings");
    if (!json) {
      return getDefaultSettings();
    }
    const data = JSON.parse(json);
    return sanitizedSettings(data);
  } catch (err) {
    console.error(err);
    return getDefaultSettings();
  }
}

let settings = getSettings();

async function initializeTabData() {
  tabData.clear();
  for (const tab of await browser.tabs.query({})) {
    getTabData(tab.id);
  }
}

initializeTabData().catch(err => {
  console.error(err);
});
