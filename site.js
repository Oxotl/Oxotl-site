window.OXOTL_SITE_CONFIG = {
  appName: "Oxotl",
  priceLabel: "$20",
  supportEmail: "support@oxotl.com",
  supportUrl: "mailto:support@oxotl.com",
  checkoutUrl: "https://oxotl.lemonsqueezy.com/checkout/buy/f93dcbed-470e-454d-8453-1ba3fbc883f4",
  downloadUrl: "",
  companyName: "Hunter Delattre",
  copyrightYear: ""
};

(function () {
  var config = window.OXOTL_SITE_CONFIG || {};
  var year = config.copyrightYear || new Date().getFullYear();
  var checkoutUrl = config.checkoutUrl || "";
  var sessionOrder = ["view", "create", "run", "merge", "buy"];
  var selectedSessionId = "view";
  var pinnedOpen = false;
  var collapseTimer = null;
  var introExpandTimer = null;
  var mascotRainbowTimer = null;
  var autoAdvanceTimer = null;
  var autoAdvanceFrame = null;
  var autoAdvanceStarted = false;
  var autoAdvanceDelay = 7000;
  var autoAdvanceCueLead = 2000;
  var hasUserInteracted = false;
  var previewIsActive = false;
  var coarsePointerQuery = window.matchMedia ? window.matchMedia("(hover: none), (pointer: coarse)") : null;
  var sessions = {
    view: {
      activity: "",
      mascotClass: "is-thinking"
    },
    create: {
      activity: "",
      mascotClass: "is-creating"
    },
    run: {
      activity: "",
      mascotClass: "is-running"
    },
    merge: {
      activity: "",
      mascotClass: "is-editing"
    },
    buy: {
      activity: "",
      mascotClass: "is-throwing-money"
    }
  };

  function isPlaceholder(value) {
    return /example\.com|support@example\.com/.test(value || "");
  }

  function isMacBrowser() {
    var platform = "";
    var ua = "";

    if (window.navigator && window.navigator.userAgentData && window.navigator.userAgentData.platform) {
      platform = window.navigator.userAgentData.platform;
    } else if (window.navigator && window.navigator.platform) {
      platform = window.navigator.platform;
    }

    if (window.navigator && window.navigator.userAgent) {
      ua = window.navigator.userAgent;
    }

    if (/Mac/i.test(platform)) return true;
    return /Mac OS X/i.test(ua) && !/iPhone|iPad|iPod/i.test(ua);
  }

  function setText(selector, value) {
    if (!value) return;
    document.querySelectorAll(selector).forEach(function (node) {
      node.textContent = value;
    });
  }

  function setLink(selector, href, text) {
    document.querySelectorAll(selector).forEach(function (node) {
      if (!href || isPlaceholder(href)) {
        node.setAttribute("aria-disabled", "true");
        return;
      }

      node.setAttribute("href", href);
      node.removeAttribute("aria-disabled");
      if (node.matches("[data-buy-link]")) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
      if (text) node.textContent = text;
    });
  }

  function setDownloadPageLinks() {
    var isMac = isMacBrowser();

    document.querySelectorAll("[data-download-page-link]").forEach(function (node) {
      var label = node.querySelector("[data-download-label]");
      if (!node.dataset.defaultLabel) {
        node.dataset.defaultLabel = label ? label.textContent.trim() : node.textContent.trim();
      }

      if (!isMac) {
        if (label) label.textContent = "Download on macOS";
        node.setAttribute("aria-disabled", "true");
        node.setAttribute("title", "Download Oxotl on macOS");
        return;
      }

      if (label) label.textContent = node.dataset.defaultLabel;
      node.removeAttribute("aria-disabled");
      node.removeAttribute("title");
    });
  }

  function hydrateSessionsFromDOM() {
    document.querySelectorAll("[data-session-detail]").forEach(function (card) {
      var sessionId = card.dataset.sessionDetail;
      var session = sessions[sessionId];
      if (!session) return;

      session.activity = card.dataset.sessionActivity || session.activity;
    });
  }

  function setExpanded(expanded) {
    var demo = document.querySelector("[data-island-demo]");
    var toggle = document.querySelector("[data-anchor-toggle]");
    var frame = document.querySelector("[data-island-hover-surface]");
    if (!demo || !toggle) return;

    var wasExpanded = demo.classList.contains("is-expanded");
    demo.classList.toggle("is-expanded", expanded);
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    if (expanded && frame) {
      frame.classList.add("has-expanded-once");
    }
    if (expanded && !wasExpanded && !autoAdvanceStarted) startAutoSessionAdvance();
    if (!expanded) {
      clearAutoAdvanceTimers();
      scheduleAutoSessionAdvance();
    }
  }

  function setPreviewZoomed(zoomed) {
    var frame = document.querySelector("[data-island-hover-surface]");
    if (!frame) return;
    if (zoomed && !frame.classList.contains("has-expanded-once")) return;
    frame.classList.toggle("is-zoomed", zoomed);
  }

  function scheduleCollapse() {
    window.clearTimeout(collapseTimer);
    if (pinnedOpen) return;
    collapseTimer = window.setTimeout(function () {
      setExpanded(false);
    }, 220);
  }

  function cancelCollapse() {
    window.clearTimeout(collapseTimer);
  }

  function cancelIntroExpand() {
    window.clearTimeout(introExpandTimer);
  }

  function clearAutoAdvanceCue() {
    document.querySelectorAll(".session-chip.is-auto-advance-cue").forEach(function (node) {
      node.classList.remove("is-auto-advance-cue");
      node.style.removeProperty("--session-cue-progress");
    });
  }

  function clearAutoAdvanceTimers() {
    window.clearTimeout(autoAdvanceTimer);
    window.cancelAnimationFrame(autoAdvanceFrame);
    clearAutoAdvanceCue();
  }

  function showAutoAdvanceCue(progress) {
    var activeChip = document.querySelector('.session-chip[data-session-id="' + selectedSessionId + '"]');
    if (!activeChip) return null;
    document.querySelectorAll(".session-chip.is-auto-advance-cue").forEach(function (node) {
      if (node === activeChip) return;
      node.classList.remove("is-auto-advance-cue");
      node.style.removeProperty("--session-cue-progress");
    });
    activeChip.classList.add("is-auto-advance-cue");
    activeChip.style.setProperty("--session-cue-progress", (progress * 100).toFixed(2) + "%");
    return activeChip;
  }

  function startAutoAdvanceCue() {
    var cueStartedAt = 0;
    var demo = document.querySelector("[data-island-demo]");

    if (!demo) return;
    if (document.hidden || previewIsActive) {
      scheduleAutoSessionAdvance();
      return;
    }
    if (!demo.classList.contains("is-expanded")) {
      setExpanded(true);
      setPreviewZoomed(true);
    }

    function step(timestamp) {
      if (document.hidden || previewIsActive) {
        scheduleAutoSessionAdvance();
        return;
      }

      if (!cueStartedAt) cueStartedAt = timestamp;
      var progress = Math.min((timestamp - cueStartedAt) / autoAdvanceCueLead, 1);
      showAutoAdvanceCue(progress);

      if (progress >= 1) {
        clearAutoAdvanceCue();
        selectSession(nextSessionId(selectedSessionId), true);
        return;
      }

      autoAdvanceFrame = window.requestAnimationFrame(step);
    }

    autoAdvanceFrame = window.requestAnimationFrame(step);
  }

  function scheduleAutoSessionAdvance() {
    if (document.body.dataset.page !== "home" || !autoAdvanceStarted) return;

    clearAutoAdvanceTimers();
    var demo = document.querySelector("[data-island-demo]");
    if (!demo) return;
    if (document.hidden || previewIsActive) return;

    autoAdvanceTimer = window.setTimeout(startAutoAdvanceCue, Math.max(0, autoAdvanceDelay - autoAdvanceCueLead));
  }

  function startAutoSessionAdvance() {
    if (document.body.dataset.page !== "home") return;
    autoAdvanceStarted = true;
    scheduleAutoSessionAdvance();
  }

  function setPreviewActive(active) {
    previewIsActive = active;
    if (active) {
      clearAutoAdvanceTimers();
      return;
    }

    scheduleAutoSessionAdvance();
  }

  function shouldPinOnInteract() {
    return Boolean(coarsePointerQuery && coarsePointerQuery.matches);
  }

  function setHoverSuppressed(suppressed) {
    var surface = document.querySelector("[data-island-hover-surface]");
    var demo = document.querySelector("[data-island-demo]");
    if (surface) surface.classList.toggle("is-hover-suppressed", suppressed);
    if (demo) demo.classList.toggle("is-hover-suppressed", suppressed);
  }

  function markUserInteraction() {
    cancelIntroExpand();
    scheduleAutoSessionAdvance();
    if (hasUserInteracted) return;
    hasUserInteracted = true;
    pinnedOpen = shouldPinOnInteract();
  }

  function releaseDesktopFocus(node) {
    if (shouldPinOnInteract()) return;
    if (!node || typeof node.blur !== "function") return;
    window.setTimeout(function () {
      node.blur();
    }, 0);
  }

  function blurNode(node) {
    if (!node || typeof node.blur !== "function") return;
    window.setTimeout(function () {
      node.blur();
    }, 0);
  }

  function blurIslandFocus(surface) {
    var active = document.activeElement;
    if (!active || !surface || !surface.contains(active)) return;
    blurNode(active);
  }

  function updateAnchor(session) {
    var mascotButton = document.querySelector("[data-mascot-button]");

    setText("[data-anchor-primary]", session.activity);

    if (mascotButton) {
      mascotButton.classList.remove("is-thinking", "is-creating", "is-running", "is-editing", "is-throwing-money");
      if (session.mascotClass) mascotButton.classList.add(session.mascotClass);
    }
  }

  function selectSession(sessionId, expand) {
    if (document.body.dataset.page !== "home") return;

    var session = sessions[sessionId] || sessions.view;
    if (!session) return;

    selectedSessionId = sessions[sessionId] ? sessionId : "view";
    document.querySelectorAll("[data-session-id]").forEach(function (node) {
      var active = node.dataset.sessionId === selectedSessionId;
      node.classList.toggle("is-active", active);
      node.setAttribute("aria-pressed", active ? "true" : "false");
    });
    document.querySelectorAll("[data-session-detail]").forEach(function (node) {
      node.classList.toggle("is-active", node.dataset.sessionDetail === selectedSessionId);
      node.classList.remove("is-diff-open");
    });
    document.querySelectorAll("[data-preview-toggle]").forEach(function (node) {
      node.setAttribute("aria-expanded", "false");
    });
    document.querySelectorAll("[data-preview-panel]").forEach(function (node) {
      node.hidden = true;
    });
    updateAnchor(session);
    if (expand) setExpanded(true);
    scheduleAutoSessionAdvance();
  }

  function sessionIdFromHash(hash) {
    if (!hash) return "";
    var value = hash.charAt(0) === "#" ? hash.slice(1) : hash;
    return sessions[value] ? value : "";
  }

  function nextSessionId(currentSessionId) {
    var currentIndex = sessionOrder.indexOf(currentSessionId);
    if (currentIndex === -1) return sessionOrder[0];
    return sessionOrder[(currentIndex + 1) % sessionOrder.length];
  }

  function bindAutoSessionAdvance() {
    if (document.body.dataset.page !== "home") return;

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        clearAutoAdvanceTimers();
        return;
      }

      scheduleAutoSessionAdvance();
    });
  }

  function bindSessionSelectors() {
    document.querySelectorAll("[data-session-id]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        var hash = button.tagName === "A" ? button.getAttribute("href") : "";
        if (hash && sessionIdFromHash(hash)) {
          event.preventDefault();
        }
        markUserInteraction();
        event.stopPropagation();
        pinnedOpen = shouldPinOnInteract();
        selectSession(button.dataset.sessionId, true);
        releaseDesktopFocus(button);
      });
    });
  }

  function bindComposerAdvance() {
    var submit = document.querySelector(".composer-submit");
    if (!submit) return;

    submit.addEventListener("click", function (event) {
      var nextSession = nextSessionId(selectedSessionId);
      event.preventDefault();
      markUserInteraction();
      event.stopPropagation();
      pinnedOpen = shouldPinOnInteract();
      selectSession(nextSession, true);
      releaseDesktopFocus(submit);
    });
  }

  function bindPreviewToggles() {
    document.querySelectorAll("[data-preview-toggle]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        var panelId = button.dataset.previewToggle;
        var card = button.closest("[data-session-detail]");
        var panel = document.querySelector('[data-preview-panel="' + panelId + '"]');
        if (!card || !panel) return;

        event.preventDefault();
        markUserInteraction();
        event.stopPropagation();

        var open = panel.hidden;
        card.querySelectorAll("[data-preview-panel]").forEach(function (node) {
          node.hidden = true;
        });
        card.querySelectorAll("[data-preview-toggle]").forEach(function (node) {
          node.setAttribute("aria-expanded", "false");
        });
        card.classList.toggle("is-diff-open", open);
        panel.hidden = !open;
        button.setAttribute("aria-expanded", open ? "true" : "false");
        pinnedOpen = shouldPinOnInteract();
        setExpanded(true);
        releaseDesktopFocus(button);
      });
    });
  }

  function bindMascotAnimation() {
    var mascotButton = document.querySelector("[data-mascot-button]");
    if (!mascotButton) return;

    mascotButton.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      markUserInteraction();
      window.clearTimeout(mascotRainbowTimer);
      mascotButton.classList.remove("is-rainbow");
      void mascotButton.offsetWidth;
      mascotButton.classList.add("is-rainbow");
      mascotRainbowTimer = window.setTimeout(function () {
        mascotButton.classList.remove("is-rainbow");
      }, 2000);
      releaseDesktopFocus(mascotButton);
    });
  }

  function bindIslandInteractions() {
    var demo = document.querySelector("[data-island-demo]");
    var toggle = document.querySelector("[data-anchor-toggle]");
    var surface = document.querySelector("[data-island-hover-surface]") || demo;
    if (!demo || !toggle || !surface) return;

    function isExpanded() {
      return demo.classList.contains("is-expanded");
    }

    var anchorHoverSuppressed = false;
    var pointerInsideSurface = false;

    demo.addEventListener("click", function (event) {
      event.stopPropagation();
    });

    toggle.addEventListener("click", function (event) {
      event.stopPropagation();
      markUserInteraction();
      pinnedOpen = shouldPinOnInteract();
      if (shouldPinOnInteract()) {
        setHoverSuppressed(false);
        cancelCollapse();
        setExpanded(!isExpanded());
        setPreviewZoomed(isExpanded());
        blurNode(toggle);
        blurIslandFocus(surface);
        return;
      }
      cancelCollapse();
      if (isExpanded()) {
        anchorHoverSuppressed = true;
        setHoverSuppressed(true);
        setExpanded(false);
        setPreviewZoomed(true);
      } else {
        setHoverSuppressed(false);
        setExpanded(true);
        setPreviewZoomed(true);
      }
      releaseDesktopFocus(toggle);
    });

    toggle.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      markUserInteraction();
      pinnedOpen = shouldPinOnInteract();
      cancelCollapse();
      setHoverSuppressed(false);
      if (isExpanded()) {
        setExpanded(false);
      } else {
        setExpanded(true);
        setPreviewZoomed(true);
      }
    });

    toggle.addEventListener("mouseleave", function () {
      anchorHoverSuppressed = false;
    });

    surface.addEventListener("mouseenter", function () {
      pointerInsideSurface = true;
      if (!surface.classList.contains("has-expanded-once")) return;
      setPreviewActive(true);
      markUserInteraction();
      cancelCollapse();
      if (!surface.classList.contains("is-hover-suppressed")) {
        setExpanded(true);
      }
      setPreviewZoomed(true);
    });
    surface.addEventListener("mouseleave", function () {
      pointerInsideSurface = false;
      setPreviewActive(false);
      anchorHoverSuppressed = false;
      setPreviewZoomed(false);
      if (surface.classList.contains("is-hover-suppressed")) {
        setExpanded(false);
        window.setTimeout(function () {
          setHoverSuppressed(false);
        }, 0);
        return;
      }
      scheduleCollapse();
    });
    surface.addEventListener("focusin", function () {
      if (toggle.contains(document.activeElement)) return;
      setPreviewActive(true);
      markUserInteraction();
      cancelCollapse();
      setHoverSuppressed(false);
      setExpanded(true);
      setPreviewZoomed(true);
    });
    surface.addEventListener("focusout", function () {
      setPreviewActive(false);
      if (pointerInsideSurface) return;
      scheduleCollapse();
    });
    surface.addEventListener("click", function (event) {
      if (demo.contains(event.target)) return;
      event.stopPropagation();
      markUserInteraction();
      cancelCollapse();
      if (shouldPinOnInteract()) {
        pinnedOpen = true;
        setHoverSuppressed(false);
        setExpanded(!isExpanded());
        setPreviewZoomed(isExpanded());
        blurIslandFocus(surface);
        return;
      }

      pinnedOpen = false;
      if (isExpanded()) {
        setPreviewActive(false);
        setHoverSuppressed(true);
        setExpanded(false);
        setPreviewZoomed(true);
        blurIslandFocus(surface);
        return;
      }

      setPreviewActive(true);
      setHoverSuppressed(false);
      setExpanded(true);
      setPreviewZoomed(true);
      blurIslandFocus(surface);
    });

    document.addEventListener("click", function (event) {
      if (demo.contains(event.target)) return;
      if (shouldPinOnInteract()) {
        markUserInteraction();
        cancelCollapse();
        pinnedOpen = true;
        setPreviewActive(false);
        blurIslandFocus(surface);
        setExpanded(false);
        return;
      }
      markUserInteraction();
      pinnedOpen = false;
      cancelCollapse();
      setHoverSuppressed(true);
      setPreviewActive(false);
      setPreviewZoomed(false);
      setExpanded(false);
    });
  }

  function preventDisabledLinkClicks() {
    document.addEventListener("click", function (event) {
      var disabledLink = event.target.closest && event.target.closest('a[aria-disabled="true"]');
      if (!disabledLink) return;
      event.preventDefault();
    });
  }

  function startDownloadInPlace() {
    if (document.body.dataset.page === "download") return;

    document.addEventListener("click", function (event) {
      var link = event.target.closest && event.target.closest("[data-download-page-link]");
      if (!link || link.getAttribute("aria-disabled") === "true") return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

      event.preventDefault();

      var frame = document.querySelector("[data-download-frame]");
      if (!frame) {
        frame = document.createElement("iframe");
        frame.setAttribute("title", "Oxotl download");
        frame.setAttribute("aria-hidden", "true");
        frame.dataset.downloadFrame = "true";
        frame.style.display = "none";
        document.body.appendChild(frame);
      }
      frame.src = link.getAttribute("href") || "/download";
    });
  }

  setText("[data-app-name]", config.appName);
  setText("[data-price-label]", config.priceLabel);
  setText("[data-support-email]", config.supportEmail);
  setText("[data-company-name]", config.companyName);
  setText("[data-year]", String(year));
  hydrateSessionsFromDOM();

  bindIslandInteractions();
  bindSessionSelectors();
  bindComposerAdvance();
  bindPreviewToggles();
  bindMascotAnimation();
  bindAutoSessionAdvance();
  var hashSessionId = "";
  if (document.body.dataset.page === "home") {
    hashSessionId = sessionIdFromHash(window.location.hash);
    if (hashSessionId) {
      selectedSessionId = hashSessionId;
      pinnedOpen = true;
      hasUserInteracted = true;
      window.requestAnimationFrame(function () {
        window.scrollTo(0, 0);
      });
    }
    selectSession(selectedSessionId, false);
    setExpanded(Boolean(hashSessionId));
    setPreviewZoomed(Boolean(hashSessionId));
    if (!hashSessionId) {
      introExpandTimer = window.setTimeout(function () {
        setExpanded(true);
        setPreviewZoomed(true);
      }, 2000);
    }
  }

  setLink("[data-buy-link]", checkoutUrl);
  setDownloadPageLinks();
  if (config.downloadUrl) {
    setLink("[data-direct-download-link]", config.downloadUrl);
  }
  setLink("[data-support-link]", config.supportUrl || ("mailto:" + (config.supportEmail || "")));
  preventDisabledLinkClicks();
  startDownloadInPlace();

  if (document.body.dataset.page === "home" && config.appName) {
    document.title = config.appName;
  }

})();
