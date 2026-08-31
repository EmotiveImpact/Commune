(function () {
  var HUBS = {
    park: {
      name: "14 Park Street",
      type: "Household",
      lede: "Rent, bills, and the Tuesday bins. One kitchen.",
      people: "Maya, Jordan, and Alex · since 2024",
      photo: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1600&q=80",
      switchMeta: "Household · 3 people",
      status: "August · you owe £42 · gas Friday · fund £420",
      youMeta: "Standard · 14 Park Street",
      avatars: [["maya", "MC"], ["jordan", "JH"], ["alex", "AR"]],
      oweLabel: "You owe",
      oweAmount: "£42.00",
      oweCopy: "Pay Jordan this week. Or net Tesco £18 and send £24.",
      oweCta: "Settle with Jordan",
      credit: false,
      kpis: [
        { go: "funds", tone: "peach", kicker: "House fund", num: "£420", hint: "£180 still from Alex" },
        { go: "analytics", tone: "lilac", kicker: "This month", num: "£2,140", hint: "of £2,400 · on track" },
        { go: "recurring", tone: "sage", kicker: "Open bills", num: "2", hint: "Gas + Virgin Media" },
        { go: "expenses", tone: "ink", kicker: "Next due", num: "Fri", hint: "British Gas · 29 Aug" }
      ],
      now: [
        { go: "expenses", pill: "warn", tag: "Friday", title: "British Gas", when: "£94.20 · Jordan paid · your share open" },
        { go: "operations", pill: "warn", tag: "Overdue", title: "Bins", when: "Still Jordan’s Tuesday" },
        { go: "funds", pill: "open", tag: "Collect", title: "Alex · house fund", when: "£180 still to pay in" }
      ],
      moves: [
        { go: "settle", arrow: "→", names: "You → Jordan", why: "Gas share · or £24 if you net Tesco", amt: "£42" },
        { go: "settle", arrow: "→", names: "Jordan → You", why: "Tesco extras from Monday", amt: "£18" },
        { go: "members", arrow: "↔", names: "Alex ↔ You", why: "Even on expenses · still £180 for the fund", amt: "£0", even: true }
      ],
      members: [
        { cls: "maya", ini: "MC", name: "Maya Chen", meta: "You · Admin", bal: "Owe £42" },
        { cls: "jordan", ini: "JH", name: "Jordan Hale", meta: "Bins this week", bal: "Owes you £18", nudge: true },
        { cls: "alex", ini: "AR", name: "Alex Rivera", meta: "Fund still due", bal: "Even", muted: true }
      ],
      activity: [
        { go: "expenses", cls: "maya", ini: "MC", title: "Virgin Media", when: "Maya logged it", time: "Yesterday" },
        { go: "expenses", cls: "jordan", ini: "JH", title: "British Gas", when: "Jordan paid the bill", time: "Tue" },
        { go: "expenses", cls: "alex", ini: "AR", title: "Tesco", when: "Alex settled", time: "Mon" },
        { go: "funds", cls: "maya", ini: "MC", title: "August rent", when: "House fund covered it", time: "1 Aug" }
      ],
      notes: [
        { go: "notes", title: "Wi-Fi", when: "ParkStreet_5G · password in notes" },
        { go: "operations", title: "Bins", when: "Black bags Tuesday · recycling Friday" },
        { go: "notes", title: "Landlord", when: "Priya Sharma · rent via the fund" }
      ],
      jumps: [
        { go: "expenses", kicker: "Expenses", title: "Virgin still open", hint: "This cycle’s ledger" },
        { go: "recurring", kicker: "Recurring", title: "Gas Friday", hint: "Virgin on the 12th too" },
        { go: "funds", kicker: "Funds", title: "Chase Alex £180", hint: "House fund is £420" },
        { go: "settle", kicker: "Settle", title: "Pay Jordan £42", hint: "Or net Tesco and send £24" },
        { go: "notes", kicker: "Notes", title: "Wi-Fi and landlord", hint: "The old chat pin" },
        { go: "operations", kicker: "Operations", title: "Bins overdue", hint: "Still Jordan’s Tuesday" }
      ]
    },
    studio: {
      name: "Studio East",
      type: "Workspace",
      lede: "Desks, the printer, and whoever grabbed the keys.",
      people: "Maya, Priya, and Sam · since 2023",
      photo: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80",
      switchMeta: "Workspace · 3 people",
      status: "August · even · ink Monday · pot £90",
      youMeta: "Standard · Studio East",
      avatars: [["maya", "MC"], ["priya", "PS"], ["sam", "SO"]],
      oweLabel: "You’re even",
      oweAmount: "£0.00",
      oweCopy: "Printer ink is due Monday. Nobody owes anyone this cycle.",
      oweCta: "Log the ink",
      credit: false,
      kpis: [
        { go: "funds", tone: "peach", kicker: "Studio pot", num: "£90", hint: "Ink run not yet logged" },
        { go: "analytics", tone: "lilac", kicker: "This month", num: "£240", hint: "Wifi + paper + coffee" },
        { go: "recurring", tone: "sage", kicker: "Open bills", num: "1", hint: "Printer ink · Monday" },
        { go: "expenses", tone: "ink", kicker: "Next due", num: "Mon", hint: "Ink · Sam’s run" }
      ],
      now: [
        { go: "recurring", pill: "warn", tag: "Monday", title: "Printer ink", when: "Sam’s run · split three ways" },
        { go: "operations", pill: "open", tag: "Keys", title: "Desk keys", when: "Still with Sam from Thursday" },
        { go: "recurring", pill: "open", tag: "Soon", title: "Guest wifi", when: "Renews 4 Sept" }
      ],
      moves: [
        { go: "members", arrow: "↔", names: "Priya ↔ You", why: "Even this cycle", amt: "£0", even: true },
        { go: "members", arrow: "↔", names: "Sam ↔ You", why: "Even · ink not logged yet", amt: "£0", even: true }
      ],
      members: [
        { cls: "maya", ini: "MC", name: "Maya Chen", meta: "You · Admin", bal: "Even", muted: true },
        { cls: "priya", ini: "PS", name: "Priya Shah", meta: "Desk this week", bal: "Even", muted: true },
        { cls: "sam", ini: "SO", name: "Sam Okonkwo", meta: "Ink run Monday", bal: "Even", muted: true }
      ],
      activity: [
        { go: "expenses", cls: "priya", ini: "PS", title: "A4 paper", when: "Priya logged it", time: "Wed" },
        { go: "operations", cls: "sam", ini: "SO", title: "Keys", when: "Sam took the set", time: "Thu" },
        { go: "expenses", cls: "maya", ini: "MC", title: "Wifi", when: "You marked paid", time: "1 Aug" }
      ],
      notes: [
        { go: "notes", title: "Door", when: "Code 4821 · last lockup is Sam" },
        { go: "notes", title: "Printer", when: "Downstairs · ink due Monday" },
        { go: "notes", title: "Guest wifi", when: "StudioEast_Guest · password in notes" }
      ],
      jumps: [
        { go: "expenses", kicker: "Expenses", title: "Paper and wifi", hint: "Studio ledger this month" },
        { go: "recurring", kicker: "Recurring", title: "Ink Monday", hint: "Split three ways" },
        { go: "funds", kicker: "Funds", title: "Studio pot £90", hint: "Ink comes out of here" },
        { go: "settle", kicker: "Settle", title: "Nothing to settle", hint: "You’re even this cycle" },
        { go: "notes", kicker: "Notes", title: "Door code 4821", hint: "Printer and guest wifi" },
        { go: "operations", kicker: "Operations", title: "Keys with Sam", hint: "From Thursday" }
      ]
    },
    lisbon: {
      name: "Lisbon · Sept",
      type: "Trip",
      lede: "Airbnb in Chiado, dinner splits, and the Thursday hold.",
      people: "Maya, Jordan, and Ness · Sept 2026",
      photo: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=1600&q=80",
      switchMeta: "Trip · 3 people",
      status: "Sept · you’re owed £64 · hold Thursday",
      youMeta: "Standard · Lisbon · Sept",
      avatars: [["maya", "MC"], ["jordan", "JH"], ["ness", "NC"]],
      oweLabel: "You’re owed",
      oweAmount: "£64.00",
      oweCopy: "Jordan and Ness still owe you for the Airbnb hold.",
      oweCta: "Collect £64",
      credit: true,
      kpis: [
        { go: "funds", tone: "peach", kicker: "Trip pot", num: "£380", hint: "Hold already paid by you" },
        { go: "analytics", tone: "lilac", kicker: "Spent", num: "£210", hint: "Dinners + metro" },
        { go: "recurring", tone: "sage", kicker: "Open", num: "1", hint: "Airbnb hold Thursday" },
        { go: "expenses", tone: "ink", kicker: "Next", num: "Thu", hint: "Hold expires in 4 days" }
      ],
      now: [
        { go: "expenses", pill: "warn", tag: "Thursday", title: "Airbnb hold", when: "Expires in 4 days · you paid" },
        { go: "settle", pill: "open", tag: "Collect", title: "Jordan · Airbnb", when: "£40 still to pay you" },
        { go: "settle", pill: "open", tag: "Collect", title: "Ness · Airbnb", when: "£24 still to pay you" }
      ],
      moves: [
        { go: "settle", arrow: "→", names: "Jordan → You", why: "Share of the Airbnb hold", amt: "£40" },
        { go: "settle", arrow: "→", names: "Ness → You", why: "Share of the Airbnb hold", amt: "£24" }
      ],
      members: [
        { cls: "maya", ini: "MC", name: "Maya Chen", meta: "You · booked the flat", bal: "Owed £64" },
        { cls: "jordan", ini: "JH", name: "Jordan Hale", meta: "Airbnb share", bal: "Owes £40", nudge: true },
        { cls: "ness", ini: "NC", name: "Ness Cole", meta: "Dinner tonight", bal: "Owes £24" }
      ],
      activity: [
        { go: "expenses", cls: "maya", ini: "MC", title: "Airbnb hold", when: "You paid the deposit", time: "Sat" },
        { go: "expenses", cls: "jordan", ini: "JH", title: "Metro cards", when: "Jordan logged three", time: "Sun" },
        { go: "expenses", cls: "ness", ini: "NC", title: "Cervejaria", when: "Ness paid dinner", time: "Sun" }
      ],
      notes: [
        { go: "notes", title: "Airbnb", when: "Chiado · check-in 15:00 · code in notes" },
        { go: "notes", title: "Dinner", when: "Cervejaria Trindade · Ness has the table" },
        { go: "notes", title: "Airport", when: "Thursday 09:40 · Uber from the flat" }
      ],
      jumps: [
        { go: "expenses", kicker: "Expenses", title: "Airbnb + dinners", hint: "Trip ledger so far" },
        { go: "recurring", kicker: "Recurring", title: "Hold Thursday", hint: "Expires in 4 days" },
        { go: "funds", kicker: "Funds", title: "Trip pot £380", hint: "Hold already left it" },
        { go: "settle", kicker: "Settle", title: "Collect £64", hint: "Jordan £40 · Ness £24" },
        { go: "notes", kicker: "Notes", title: "Chiado check-in", hint: "Dinner and the airport" },
        { go: "operations", kicker: "Operations", title: "Thursday flight", hint: "Uber from the flat" }
      ]
    }
  };

  window.COMMUNE_HUBS = HUBS;
  window.COMMUNE_CURRENT_HUB = HUBS.park;

  var HOME_STATUS = "3 spaces · you owe £42 · you’re owed £64";
  var HOME_NAV = { home: true, "home-inbox": true, "home-focus": true, "home-empty": true };
  var HUB_SCREENS = { hub: true, "hub-snapshot": true, "hub-needs": true, "hub-money": true, "hub-empty": true };
  var GATE_SCREENS = { login: true, signup: true, invite: true, onboard: true };
  var EXPENSE_SCREENS = { expenses: true, "expenses-empty": true };
  var HOME_STATUS_SCREENS = { home: true, communes: true, "home-inbox": true, "home-focus": true, "home-places": true };
  var WINDOW_PAGE = {
    expense: "expenses",
    "expense-paid": "expenses",
    "add-expense": "expenses",
    "commune-new": "communes",
    "member-invite": "members",
    breakdown: "settle",
    pay: "settle"
  };
  var lastPage = "home";

  function pfx() {
    return document.body.classList.contains("d-body") ? "d" : "a";
  }

  function setAll(sel, text) {
    document.querySelectorAll(sel).forEach(function (el) {
      el.textContent = text;
    });
  }

  function fill(sel, html) {
    document.querySelectorAll(sel).forEach(function (el) {
      el.innerHTML = html;
    });
  }

  function htmlAvatars(list) {
    return list
      .map(function (a) {
        return '<span class="avatar ' + a[0] + '">' + a[1] + "</span>";
      })
      .join("");
  }

  function htmlKpis(items) {
    var x = pfx();
    return items
      .map(function (item) {
        return (
          '<button class="' +
          x +
          "-kpi " +
          item.tone +
          '" type="button" data-go="' +
          item.go +
          '"><span>' +
          item.kicker +
          "</span><strong>" +
          item.num +
          "</strong><small>" +
          item.hint +
          "</small></button>"
        );
      })
      .join("");
  }

  function htmlNow(items) {
    var x = pfx();
    return items
      .map(function (item) {
        return (
          '<button class="' +
          x +
          '-now-row" type="button" data-go="' +
          item.go +
          '"><span class="pill ' +
          item.pill +
          '">' +
          item.tag +
          "</span><div><strong>" +
          item.title +
          '</strong><div class="when">' +
          item.when +
          "</div></div></button>"
        );
      })
      .join("");
  }

  function htmlMoves(items) {
    var x = pfx();
    return items
      .map(function (item) {
        var even = item.even ? " is-even" : "";
        var arrowBg = item.even ? ' style="background:#f0ece4"' : "";
        var amtStyle = item.even ? ' style="color:var(--ink-soft)"' : "";
        return (
          '<button class="' +
          x +
          "-move" +
          even +
          '" type="button" data-go="' +
          item.go +
          '"><div class="' +
          x +
          '-arrow"' +
          arrowBg +
          ">" +
          item.arrow +
          '</div><div><div class="names">' +
          item.names +
          '</div><div class="why">' +
          item.why +
          '</div></div><div class="amt"' +
          amtStyle +
          ">" +
          item.amt +
          "</div></button>"
        );
      })
      .join("");
  }

  function htmlMembers(items) {
    var x = pfx();
    return items
      .map(function (item) {
        var balStyle = item.muted ? ' style="color:var(--ink-soft)"' : "";
        var extra = item.nudge
          ? '<button class="' +
            x +
            '-btn nudge" type="button" data-go="notices" style="height:32px;flex-shrink:0">Nudge</button>'
          : "";
        return (
          '<div class="' +
          x +
          '-member-row"><span class="avatar ' +
          item.cls +
          '">' +
          item.ini +
          '</span><div class="who"><strong>' +
          item.name +
          "</strong><span>" +
          item.meta +
          '</span></div><div class="bal"' +
          balStyle +
          ">" +
          item.bal +
          "</div>" +
          extra +
          "</div>"
        );
      })
      .join("");
  }

  function htmlActivity(items) {
    var x = pfx();
    return items
      .map(function (item) {
        return (
          '<button class="' +
          x +
          '-item" type="button" data-go="' +
          item.go +
          '"><span class="avatar ' +
          item.cls +
          '">' +
          item.ini +
          "</span><div><strong>" +
          item.title +
          '</strong><div class="when">' +
          item.when +
          '</div></div><span class="when">' +
          item.time +
          "</span></button>"
        );
      })
      .join("");
  }

  function htmlNotes(items) {
    var x = pfx();
    return items
      .map(function (item) {
        return (
          '<button class="' +
          x +
          "-item " +
          x +
          '-item-plain" type="button" data-go="' +
          item.go +
          '"><div><strong>' +
          item.title +
          '</strong><div class="when">' +
          item.when +
          "</div></div></button>"
        );
      })
      .join("");
  }

  function htmlJumps(items) {
    return items
      .map(function (item) {
        return (
          '<button class="jump-tile" type="button" data-go="' +
          item.go +
          '"><span>' +
          item.kicker +
          "</span><strong>" +
          item.title +
          "</strong><small>" +
          item.hint +
          "</small></button>"
        );
      })
      .join("");
  }

  function applyHub(id) {
    var hub = HUBS[id];
    if (!hub) return;
    window.COMMUNE_CURRENT_HUB = hub;
    document.documentElement.style.setProperty("--hub-photo", "url('" + hub.photo + "')");
    setAll("[data-hub-name]", hub.name);
    setAll("[data-hub-type]", hub.type);
    setAll("[data-hub-lede]", hub.lede);
    setAll("[data-hub-people]", hub.people);
    setAll("[data-hub-switch-name]", hub.name);
    setAll("[data-hub-switch-meta]", hub.switchMeta);
    setAll("[data-hub-you-meta]", hub.youMeta);
    setAll("[data-hub-owe-label]", hub.oweLabel);
    setAll("[data-hub-owe-amount]", hub.oweAmount);
    setAll("[data-hub-owe-copy]", hub.oweCopy);
    setAll("[data-hub-owe-cta]", hub.oweCta);
    fill("[data-hub-avatars]", htmlAvatars(hub.avatars));
    fill("[data-hub-kpis]", htmlKpis(hub.kpis));
    fill("[data-hub-now]", htmlNow(hub.now));
    fill("[data-hub-moves]", htmlMoves(hub.moves));
    fill("[data-hub-members]", htmlMembers(hub.members));
    fill("[data-hub-activity]", htmlActivity(hub.activity));
    fill("[data-hub-notes]", htmlNotes(hub.notes));
    fill("[data-hub-jumps]", htmlJumps(hub.jumps));
    document.querySelectorAll("[data-hub-mast]").forEach(function (el) {
      el.classList.toggle("is-credit", !!hub.credit);
    });
    var map = window.COMMUNE_TITLES;
    if (map) {
      map["hub-snapshot"] = hub.name;
      map["hub-needs"] = hub.name;
      map["hub-money"] = hub.name;
    }
  }

  window.COMMUNE_APPLY_HUB = applyHub;

  function isWindow(id) {
    var el = document.getElementById(id);
    return !!(el && el.classList.contains("a-window"));
  }

  function closeMore() {
    document.body.classList.remove("more-open");
    var more = document.querySelector(".a-more");
    if (more) more.hidden = true;
  }

  function closeWindow() {
    document.body.classList.remove("has-window");
    var layer = document.querySelector(".a-windows");
    if (layer) layer.hidden = true;
    document.querySelectorAll(".a-window").forEach(function (w) {
      w.hidden = true;
    });
  }

  function openWindow(id) {
    var el = document.getElementById(id);
    if (!el || !el.classList.contains("a-window")) return false;
    closeMore();
    document.body.classList.add("has-window");
    var layer = document.querySelector(".a-windows");
    if (layer) layer.hidden = false;
    document.querySelectorAll(".a-window").forEach(function (w) {
      w.hidden = w.id !== id;
    });
    var title = document.querySelector("[data-window-title]");
    var map = window.COMMUNE_TITLES || {};
    if (title) title.textContent = map[id] || "";
    return true;
  }

  function show(id) {
    var aliases = { "home-focus": "home", "home-places": "communes" };
    if (!document.getElementById("communes")) {
      aliases.communes = "home";
      aliases["home-places"] = "home";
    }
    var activeId = aliases[id] || id;
    if (isWindow(activeId)) {
      openWindow(activeId);
      return;
    }
    closeWindow();
    closeMore();
    if (
      activeId === "settle" &&
      document.getElementById("settle-even") &&
      window.COMMUNE_CURRENT_HUB &&
      window.COMMUNE_CURRENT_HUB.oweAmount === "£0.00" &&
      !window.COMMUNE_CURRENT_HUB.credit
    ) {
      activeId = "settle-even";
    }
    lastPage = activeId;
    document.body.classList.toggle("is-gate", !!GATE_SCREENS[activeId]);
    document.querySelectorAll(".screen").forEach(function (s) {
      if (s.classList.contains("a-window")) return;
      s.hidden = s.id !== activeId;
    });
    document
      .querySelectorAll(
        "nav [data-go], .a-link[data-go], .a-hub-switch[data-go], .a-side-foot[data-go], .a-bottom [data-go], .b-link[data-go], .d-link[data-go], .b-tabs button[data-go], .b-communes button[data-go], .layout-tabs [data-go]"
      )
      .forEach(function (el) {
        var go = el.getAttribute("data-go");
        var on = go === activeId || (go === "communes" && activeId === "home" && !document.getElementById("communes"));
        el.classList.toggle("is-active", on);
      });
    if (HUB_SCREENS[activeId]) {
      document.querySelectorAll("nav .a-link[data-go='hub'], nav .d-link[data-go='hub-snapshot'], nav .d-link[data-go='hub'], .a-bottom [data-go='hub']").forEach(function (el) {
        el.classList.add("is-active");
      });
    }
    if (HOME_NAV[activeId]) {
      document.querySelectorAll("nav .a-link[data-go='home'], nav .d-link[data-go='home'], .a-bottom [data-go='home']").forEach(function (el) {
        el.classList.add("is-active");
      });
    }
    if (EXPENSE_SCREENS[activeId]) {
      document.querySelectorAll("nav .a-link[data-go='expenses'], .a-bottom [data-go='expenses']").forEach(function (el) {
        el.classList.add("is-active");
      });
    }
    if (activeId === "settle-even") {
      document.querySelectorAll("nav .a-link[data-go='settle'], .a-bottom [data-go='settle']").forEach(function (el) {
        el.classList.add("is-active");
      });
    }
    var title = document.querySelector("[data-page-title]");
    var map = window.COMMUNE_TITLES || {};
    if (title && map[activeId]) title.textContent = map[activeId];
    var ledeEl = document.querySelector("[data-page-lede], [data-page-status]");
    if (ledeEl) {
      var ledes = window.COMMUNE_LEDES || {};
      var lede;
      if (Object.prototype.hasOwnProperty.call(ledes, activeId)) lede = ledes[activeId];
      else if (HOME_STATUS_SCREENS[activeId]) lede = HOME_STATUS;
      else if (window.COMMUNE_CURRENT_HUB) lede = window.COMMUNE_CURRENT_HUB.status;
      else lede = "";
      ledeEl.textContent = lede || "";
      ledeEl.hidden = !lede;
    }
  }

  document.addEventListener("click", function (e) {
    var closer = e.target.closest("[data-window-close]");
    if (closer) {
      e.preventDefault();
      var after = closer.getAttribute("data-go");
      closeWindow();
      if (after) show(after);
      return;
    }
    var moreBtn = e.target.closest("[data-more]");
    if (moreBtn) {
      e.preventDefault();
      var more = document.querySelector(".a-more");
      var open = document.body.classList.toggle("more-open");
      if (more) more.hidden = !open;
      return;
    }
    var navModeBtn = e.target.closest("[data-nav-mode]");
    if (navModeBtn) {
      e.preventDefault();
      applyNavMode(navModeBtn.getAttribute("data-nav-mode"));
      return;
    }
    var chip = e.target.closest(".a-chip");
    if (chip && chip.closest(".a-filters")) {
      chip.parentElement.querySelectorAll(".a-chip").forEach(function (c) {
        c.classList.toggle("is-on", c === chip);
      });
    }
    var t = e.target.closest("[data-go], [data-hub]");
    if (!t) return;
    if (t.closest(".a-filters")) return;
    e.preventDefault();
    closeMore();
    var hubId = t.getAttribute("data-hub");
    if (hubId) applyHub(hubId);
    var go = t.getAttribute("data-go");
    if (go === "hub-empty") stampEmptyHub(t.closest(".a-window, .screen"));
    if (go) show(go);
    else if (hubId) show(document.body.classList.contains("d-body") ? "hub-snapshot" : "hub");
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeWindow();
  });

  function stampEmptyHub(screen) {
    if (!screen) return;
    var nameInput = screen.querySelector("input[type='text']");
    var typeSelect = screen.querySelector("#a-new-type, #a-ob-type");
    var name = nameInput && nameInput.value.trim();
    var type = typeSelect && typeSelect.value;
    var empty = document.getElementById("hub-empty");
    if (!empty) return;
    if (name) {
      empty.querySelectorAll("[data-hub-name]").forEach(function (el) {
        el.textContent = name;
      });
      setAll("[data-hub-switch-name]", name);
    }
    if (type) {
      empty.querySelectorAll("[data-hub-type]").forEach(function (el) {
        el.textContent = type;
      });
      setAll("[data-hub-switch-meta]", type + " · just created");
    }
  }

  document.documentElement.style.setProperty("--hub-photo", "url('" + HUBS.park.photo + "')");

  var searchInput = document.querySelector(".a-search input");
  if (searchInput) {
    searchInput.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        show("expenses");
      }
    });
  }

  var params = new URLSearchParams(window.location.search);
  var NAV_KEY = "commune-nav";

  function applyNavMode(mode) {
    mode = mode === "advanced" ? "advanced" : "basic";
    document.body.classList.toggle("nav-basic", mode === "basic");
    document.body.classList.toggle("nav-advanced", mode === "advanced");
    try {
      localStorage.setItem(NAV_KEY, mode);
    } catch (err) {}
    document.querySelectorAll("[data-nav-mode]").forEach(function (btn) {
      btn.classList.toggle("is-on", btn.getAttribute("data-nav-mode") === mode);
    });
  }

  function initialNavMode() {
    var q = params.get("nav");
    if (q === "basic" || q === "advanced") return q;
    try {
      var stored = localStorage.getItem(NAV_KEY);
      if (stored === "basic" || stored === "advanced") return stored;
    } catch (err) {}
    return "basic";
  }

  if (document.body.classList.contains("a-body")) applyNavMode(initialNavMode());
  if (params.get("hub")) applyHub(params.get("hub"));
  var boot = params.get("screen");
  if (boot) {
    if (isWindow(boot)) {
      show(WINDOW_PAGE[boot] || "home");
      openWindow(boot);
    } else {
      show(boot);
    }
  }
})();
