const TITLES = {
  gallery: ["Operations options", "Pick a page shape"],
  now: ["Operations", "What shipped — the squashed week"],
  wideweek: ["Operations", "Wide week · hours, titles wrap"],
  threeday: ["Operations", "Three-day calendar"],
  month: ["Operations", "Month you can read"],
  lanes: ["Operations", "Day lanes · week without empty hours"],
  today: ["Operations", "One day gets the hours"],
  agenda: ["Operations", "The list is the page"],
  people: ["Operations", "Cut by who, not by date"],
  board: ["Operations", "Old app board, this look"],
  starter: ["Operations", "Starter board + checklists"],
  rotate: ["Operations", "Done hands it to the next person"],
  escalate: ["Operations", "Overdue vs escalated"],
};

const TODAY = {
  mon: {
    title: "Monday 31 August",
    note: "Clear. Click a day with work.",
    body: "",
  },
  tue: {
    title: "Tuesday 1 September",
    note: "Overdue sits on today until someone does it.",
    body: `<div class="today-hours">
      <div class="h">9am</div><div class="slot"></div>
      <div class="h">12pm</div><div class="slot"></div>
      <div class="h">8pm</div>
      <div class="slot">
        <button class="lane-card" type="button">
          <strong>Put the bins out</strong>
          <em>Still due from Tue 25 Aug · Jordan Hale</em>
          <small>Black bags. Alley behind the kitchen.</small>
        </button>
      </div>
    </div>`,
  },
  wed: {
    title: "Wednesday 2 September",
    note: "One day. Hours have room.",
    body: `<div class="today-hours">
      <div class="h">9am</div><div class="slot"></div>
      <div class="h">12pm</div><div class="slot"></div>
      <div class="h">3pm</div><div class="slot"></div>
      <div class="h">6pm</div><div class="slot"></div>
      <div class="h">7pm</div>
      <div class="slot">
        <button class="lane-card" type="button">
          <strong>Kitchen reset</strong>
          <em>19:00 · Alex Rivera</em>
          <small>Clear the counters, run the dishwasher, take the food caddy out.</small>
        </button>
      </div>
      <div class="h">8pm</div><div class="slot"></div>
      <div class="h">9pm</div><div class="slot"></div>
    </div>`,
  },
  thu: {
    title: "Thursday 3 September",
    note: "All-day sits at the top, not in an hour.",
    body: `<div style="padding:16px">
      <button class="lane-card delivery" type="button">
        <strong>Package delivery</strong>
        <em>All day</em>
        <small>Leave with number 12 if nobody is home.</small>
      </button>
    </div>`,
  },
  fri: {
    title: "Friday 4 September",
    note: "A visit is a time, so the hour line earns its keep.",
    body: `<div class="today-hours">
      <div class="h">9am</div><div class="slot"></div>
      <div class="h">10am</div>
      <div class="slot">
        <button class="lane-card visit" type="button">
          <strong>Landlord visit</strong>
          <em>10:30 · Priya</em>
          <small>Damp patch by the kitchen window.</small>
        </button>
      </div>
      <div class="h">12pm</div><div class="slot"></div>
      <div class="h">3pm</div><div class="slot"></div>
    </div>`,
  },
  sat: {
    title: "Saturday 5 September",
    note: "Clear.",
    body: "",
  },
  sun: {
    title: "Sunday 6 September",
    note: "Clear.",
    body: "",
  },
};

function viewFromUrl() {
  const view = new URLSearchParams(location.search).get("view") || "gallery";
  return TITLES[view] ? view : "gallery";
}

function show(view) {
  const gallery = document.getElementById("gallery");
  const app = document.getElementById("app");
  const isGallery = view === "gallery";
  gallery.classList.toggle("is-on", isGallery);
  app.hidden = isGallery;
  document.querySelectorAll(".oo-page").forEach((page) => {
    page.classList.toggle("is-on", page.id === view);
  });
  document.querySelectorAll(".oo-chip").forEach((chip) => {
    chip.classList.toggle("is-on", chip.dataset.view === view);
  });
  const title = document.getElementById("page-title");
  const lede = document.getElementById("page-lede");
  if (title && TITLES[view]) {
    title.textContent = TITLES[view][0];
    lede.textContent = TITLES[view][1];
  }
  document.title =
    view === "gallery"
      ? "Operations options — Commune"
      : `${TITLES[view][1]} — Commune`;
}

function bindTodayStrip() {
  document.querySelectorAll(".strip-day").forEach((button) => {
    button.addEventListener("click", () => {
      const day = button.dataset.day;
      const data = TODAY[day];
      if (!data) return;
      document.querySelectorAll(".strip-day").forEach((row) => {
        row.classList.toggle("is-on", row === button);
      });
      const panel = document.getElementById("today-panel");
      panel.innerHTML = `
        <div class="panel-head">
          <div>
            <h3>${data.title}</h3>
            <small>${data.note}</small>
          </div>
        </div>
        ${data.body || `<div class="agenda-item"><div><strong>Nothing scheduled.</strong><small>Leave the day open.</small></div></div>`}
      `;
    });
  });
}

function bindRotate() {
  const button = document.getElementById("rotate-btn");
  const next = document.getElementById("rotate-next");
  if (!button || !next) return;
  let done = false;
  button.addEventListener("click", () => {
    done = !done;
    button.textContent = done
      ? "Undo · Jordan still has it"
      : "Mark done · hand to Alex";
    next.textContent = done
      ? "Alex has next Tuesday. Jordan is clear until it comes back around."
      : "After this: Alex Rivera · Tuesday 8 Sep.";
  });
}

show(viewFromUrl());
bindTodayStrip();
bindRotate();
