(function () {
  function setChrome(mode) {
    document.body.setAttribute("data-chrome", mode);
    document.querySelectorAll("[data-chrome]").forEach(function (el) {
      el.classList.toggle("is-active", el.getAttribute("data-chrome") === mode);
    });
  }

  function show(id) {
    document.querySelectorAll(".screen").forEach(function (s) {
      s.hidden = s.id !== id;
    });
    document.querySelectorAll("nav [data-go], .a-link[data-go], .b-link[data-go], .d-link[data-go], .b-tabs button[data-go], .b-communes button[data-go], .layout-tabs [data-go]").forEach(function (el) {
      el.classList.toggle("is-active", el.getAttribute("data-go") === id);
    });
    var homeIds = { hub: true, "hub-snapshot": true, "hub-needs": true, "hub-money": true };
    if (homeIds[id]) {
      document.querySelectorAll("nav .d-link[data-go='hub-snapshot'], nav .d-link[data-go='hub']").forEach(function (el) {
        el.classList.add("is-active");
      });
    }
    var title = document.querySelector("[data-page-title]");
    var map = window.COMMUNE_TITLES || {};
    if (title && map[id]) title.textContent = map[id];
  }

  document.addEventListener("click", function (e) {
    var chrome = e.target.closest("[data-chrome]");
    if (chrome) {
      e.preventDefault();
      setChrome(chrome.getAttribute("data-chrome"));
      return;
    }
    var t = e.target.closest("[data-go]");
    if (!t) return;
    e.preventDefault();
    show(t.getAttribute("data-go"));
  });

  var params = new URLSearchParams(window.location.search);
  setChrome(params.get("chrome") || "space");
  if (params.get("screen")) show(params.get("screen"));
})();
