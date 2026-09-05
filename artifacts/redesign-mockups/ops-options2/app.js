import {
  CATEGORY_LABEL,
  HOURS,
  HOUSE,
  MEMBERS,
  TODAY,
  WEEKDAYS,
  addDays,
  addMonths,
  createStore,
  formatDay,
  formatHour,
  fromIso,
  isEscalated,
  isOverdue,
  memberOf,
  monthCells,
  nextInRotation,
  overdueDays,
  sortItems,
  weekDates,
  weekLabel,
} from "./data.js";

const store = createStore();
const state = {
  product: new URLSearchParams(location.search).get("p") || "gallery",
  selected: TODAY,
  openId: null,
  adding: null,
  filter: "all",
  toast: null,
};

let toastTimer = 0;

const PRODUCTS = {
  gallery: ["Operations", "Three ways to run the house"],
  pulse: ["Operations", "Today, the next 7 days, and who is on what"],
  stretch: ["Operations", "The next 72 hours, with owners"],
  map: ["Operations", "The month, then the day"],
};

const WHY = {
  pulse:
    "Hours for today. A strip for the week. Agenda for the stretch. People for ownership. Rotation on the overdue pin.",
  stretch: "Three days of hours that actually fit. The week strip moves the window. People sits beside the calendar.",
  map: "A month you can read. Click a day and it gets hours, an agenda, and the rotation.",
};

const root = document.getElementById("root");

function items() {
  return store.get();
}

function visible(rows = items()) {
  if (state.filter === "mine") {
    return rows.filter((row) => row.assignee === "maya" || row.kind === "event");
  }
  if (state.filter === "tasks") return rows.filter((row) => row.kind === "task");
  if (state.filter === "events") return rows.filter((row) => row.kind === "event");
  return rows;
}

function go(product, extra = {}) {
  Object.assign(state, extra, { product });
  const url = new URL(location.href);
  if (product === "gallery") url.search = "";
  else url.searchParams.set("p", product);
  history.replaceState({}, "", url);
  render();
}

function flash(text, undo = true) {
  state.toast = { text, undo };
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    state.toast = null;
    render();
  }, 7000);
  render();
}

function avatar(member) {
  return `<span class="avatar ${member.cls}">${member.ini}</span>`;
}

function cardClass(item) {
  if (isOverdue(item) || isEscalated(item)) return "warn";
  if (item.category === "delivery") return "delivery";
  if (item.category === "visit") return "visit";
  if (item.category === "appointment") return "appt";
  return "";
}

function itemButton(item, extra = "") {
  const who = item.kind === "task" ? memberOf(item.assignee).short : CATEGORY_LABEL[item.category];
  const when = item.allDay ? "All day" : formatHour(item.time);
  return `<button class="card ${cardClass(item)} ${extra}" type="button" data-open="${item.id}">
    <strong>${escapeHtml(item.title)}</strong>
    <em>${when} · ${who}${isOverdue(item) ? ` · ${overdueDays(item)}d overdue` : ""}</em>
    ${item.notes ? `<small>${escapeHtml(item.notes)}</small>` : ""}
  </button>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function bar() {
  return `
    <nav class="o2-bar" aria-label="Operations products">
      <a class="o2-back" href="../index.html">Gallery</a>
      <button class="o2-chip ${state.product === "gallery" ? "is-on" : ""}" type="button" data-p="gallery">All products</button>
      <div class="o2-chooser-group">
        <span>Products</span>
        <button class="o2-chip ${state.product === "pulse" ? "is-on" : ""}" type="button" data-p="pulse">Pulse</button>
        <button class="o2-chip ${state.product === "stretch" ? "is-on" : ""}" type="button" data-p="stretch">Stretch</button>
        <button class="o2-chip ${state.product === "map" ? "is-on" : ""}" type="button" data-p="map">Map</button>
      </div>
      <small class="o2-clock">14 Park Street · Tue 1 Sep 2026 · live store</small>
      ${state.product !== "gallery" ? `<button class="o2-chip" type="button" data-today>Today</button>` : ""}
      <button class="o2-chip" type="button" data-reset>Reset week</button>
    </nav>
  `;
}

function toast() {
  if (!state.toast) return "";
  return `<div class="toast" role="status">
    <span>${escapeHtml(state.toast.text)}</span>
    ${state.toast.undo ? `<button type="button" data-undo>Undo</button>` : ""}
  </div>`;
}

function chrome(inner) {
  const [title, lede] = PRODUCTS[state.product];
  return `
    ${bar()}
    <div class="o2-app">
      <aside class="o2-side">
        <div class="o2-brand"><img src="../logo-mark.svg" alt="">Commune</div>
        <nav class="o2-nav">
          <span>Home</span><span>This Hub</span><span>Expenses</span><span>Settle</span>
          <span>Recurring</span><span>Funds</span><span>Notes</span>
          <span class="is-on">Operations</span>
        </nav>
        <div class="o2-foot">${avatar(MEMBERS[0])}<div><strong>Maya Chen</strong><small>14 Park Street</small></div></div>
      </aside>
      <div class="o2-main">
        <div class="o2-head">
          <div>
            <h1>${title}</h1>
            <p>${lede}</p>
          </div>
          <div class="o2-head-tools">
            <div class="seg" role="group">
              <button type="button" data-filter="all" class="${state.filter === "all" ? "is-on" : ""}">All</button>
              <button type="button" data-filter="mine" class="${state.filter === "mine" ? "is-on" : ""}">Yours</button>
              <button type="button" data-filter="tasks" class="${state.filter === "tasks" ? "is-on" : ""}">Tasks</button>
              <button type="button" data-filter="events" class="${state.filter === "events" ? "is-on" : ""}">Events</button>
            </div>
            <button class="o2-btn sage" type="button" data-add>Add</button>
          </div>
        </div>
        ${WHY[state.product] ? `<p class="why-note">${WHY[state.product]}</p>` : ""}
        ${inner}
      </div>
    </div>
    ${drawer()}
    ${toast()}
  `;
}

function weekItemsFor(date, rows) {
  if (date === TODAY) {
    return sortItems([
      ...rows.filter((item) => item.date === date),
      ...rows.filter((item) => isOverdue(item) && item.date !== date),
    ]);
  }
  return sortItems(rows.filter((item) => item.date === date));
}

function weekStrip(selected, { chips = true, windowDays = null } = {}) {
  const days = weekDates(selected);
  const rows = visible();
  return `<div class="week-strip" aria-label="This week">
    ${days
      .map((date, i) => {
        const unique = weekItemsFor(date, rows);
        const inWindow = windowDays ? windowDays.includes(date) : date === selected;
        return `<button class="ws-day ${inWindow ? "is-on" : ""} ${date === TODAY ? "is-today" : ""}" type="button" data-day="${date}">
          <span class="wd">${WEEKDAYS[i]}</span>
          <span class="num">${Number(date.slice(-2))}</span>
          ${
            chips
              ? unique
                  .slice(0, 2)
                  .map(
                    (item) =>
                      `<span class="ws-chip ${isOverdue(item) ? "warn" : item.kind === "event" ? "event" : ""}">${escapeHtml(item.title)}</span>`,
                  )
                  .join("")
              : unique.length
                ? `<span class="ws-chip ${unique.some(isOverdue) ? "warn" : ""}">${unique.length}</span>`
                : ""
          }
        </button>`;
      })
      .join("")}
  </div>`;
}

function overduePin() {
  const overdue = sortItems(items().filter(isOverdue));
  if (!overdue.length) return "";
  const item = overdue[0];
  const who = memberOf(item.assignee);
  const next = memberOf(nextInRotation(item.rotation || [item.assignee], item.assignee));
  return `<div class="pin">
    <div>
      <small>Overdue · ${overdue.length}${isEscalated(item) ? " · escalated" : ""}</small>
      <strong>${escapeHtml(item.title)}</strong>
      <small>${who.name} · ${overdueDays(item)} days · next is ${next.short}</small>
    </div>
    <div class="pin-actions">
      <button class="o2-btn" type="button" data-open="${item.id}">Open</button>
      <button class="o2-btn" type="button" data-skip="${item.id}">Skip a week</button>
      <button class="o2-btn sage" type="button" data-done="${item.id}">Done · ${next.short}</button>
    </div>
  </div>`;
}

function metrics() {
  const rows = items();
  const overdue = rows.filter(isOverdue).length;
  const yours = rows.filter((item) => item.kind === "task" && item.assignee === "maya" && (isOverdue(item) || item.date === TODAY)).length;
  const house = rows.filter((item) => item.kind === "event" && item.date >= TODAY && item.date <= addDays(TODAY, 7)).length;
  return `<div class="metrics">
    <div class="metric ${overdue ? "is-warn" : ""}"><span>Overdue</span><strong>${overdue}</strong><small>${overdue ? "Bins still waiting" : "Nothing waiting"}</small></div>
    <div class="metric"><span>Yours today</span><strong>${yours}</strong><small>Maya · tasks on this clock</small></div>
    <div class="metric"><span>House this week</span><strong>${house}</strong><small>Parcel, visit, plumber</small></div>
  </div>`;
}

function dayHours(date) {
  const dayItems = sortItems(
    visible().filter((item) => item.date === date || (date === TODAY && isOverdue(item))),
  );
  const allDay = dayItems.filter((item) => item.allDay || !item.time);
  const timed = dayItems.filter((item) => !item.allDay && item.time);
  const slots = HOURS.map((hour) => {
    const stamp = `${String(hour).padStart(2, "0")}:00`;
    const here = timed.filter((item) => Number(item.time.slice(0, 2)) === hour);
    return `<div class="h">${formatHour(stamp)}</div>
      <div class="slot ${here.length ? "" : "is-empty"}" data-add-at="${date}|${stamp}">
        ${here.map((item) => itemButton(item)).join("")}
      </div>`;
  }).join("");
  return `
    <div class="panel">
      <div class="panel-h">
        <div>
          <h3>${formatDay(date)}</h3>
          <small>${date === TODAY ? "Today · hours have room · click a line to add" : "Selected day · click a line to add"}</small>
        </div>
      </div>
      ${allDay.length ? `<div class="all-day">${allDay.map((item) => itemButton(item)).join("")}</div>` : ""}
      <div class="hours">${slots}</div>
    </div>`;
}

function agendaList(rows, empty = "Nothing in the next 7 days.") {
  const overdue = rows.filter(isOverdue);
  const rest = rows.filter((item) => !isOverdue(item));
  const groups = [];
  if (overdue.length) groups.push({ key: "overdue", label: "Overdue", items: overdue });
  for (const item of rest) {
    const last = groups.at(-1);
    if (last && last.key === item.date) last.items.push(item);
    else groups.push({ key: item.date, label: formatDay(item.date, "short"), items: [item] });
  }
  if (!groups.length) return `<div class="empty">${empty}</div>`;
  return groups
    .map(
      (group) => `
      <div class="agenda-group">
        <div class="people-list"><div class="who">${group.label}</div></div>
        ${group.items
          .map((item) => {
            const who = item.kind === "task" ? memberOf(item.assignee) : HOUSE;
            const next = item.rotation ? memberOf(nextInRotation(item.rotation, item.assignee)) : null;
            return `<button class="row" type="button" data-open="${item.id}">
              ${avatar(who)}
              <span class="grow">
                <strong>${escapeHtml(item.title)}</strong>
                <small>${item.allDay ? "All day" : formatHour(item.time)} · ${item.kind === "task" ? who.short : CATEGORY_LABEL[item.category]}${next ? ` · then ${next.short}` : ""}</small>
              </span>
              ${item.kind === "task" ? `<span class="pill ${isOverdue(item) ? "warn" : ""}">${isOverdue(item) ? "Overdue" : "Task"}</span>` : `<span class="pill">${CATEGORY_LABEL[item.category]}</span>`}
            </button>`;
          })
          .join("")}
      </div>`,
    )
    .join("");
}

function peoplePanel(rows, caption = "This week + overdue") {
  const buckets = [
    ...MEMBERS.map((member) => ({
      member,
      items: rows.filter((item) => item.kind === "task" && item.assignee === member.id),
    })),
    { member: HOUSE, items: rows.filter((item) => item.kind === "event") },
  ];
  return `<div class="panel">
    <div class="panel-h"><h3>Who’s on it</h3><small>${caption}</small></div>
    ${buckets
      .map((bucket) => {
        const list = sortItems(bucket.items);
        return `<div class="person">
          <div class="person-hd">${avatar(bucket.member)}<div><strong>${bucket.member.short}${bucket.member.you ? " · you" : ""}</strong><small>${list.length ? `${list.length} open` : "Clear"}</small></div></div>
          ${
            list.length
              ? list
                  .map(
                    (item) => `<button class="row" type="button" data-open="${item.id}">
                      <span class="grow"><strong>${escapeHtml(item.title)}</strong><small>${isOverdue(item) ? "Overdue" : formatDay(item.date, "short")} · ${item.allDay ? "All day" : formatHour(item.time)}${item.rotation ? ` · then ${memberOf(nextInRotation(item.rotation, item.assignee)).short}` : ""}</small></span>
                    </button>`,
                  )
                  .join("")
              : `<div class="empty tight">Nothing on this person.</div>`
          }
        </div>`;
      })
      .join("")}
  </div>`;
}

function pulse() {
  const horizon = items().filter(
    (item) => isOverdue(item) || (item.date >= TODAY && item.date <= addDays(TODAY, 7)),
  );
  return chrome(`
    ${overduePin()}
    ${weekStrip(state.selected)}
    ${metrics()}
    <div class="pulse">
      ${dayHours(state.selected)}
      <div class="pulse-side">
        <div class="panel" style="margin-bottom:14px">
          <div class="panel-h"><h3>Next 7 days</h3><small>Agenda · ${weekLabel(TODAY)}</small></div>
          ${agendaList(sortItems(visible(horizon)))}
        </div>
        ${peoplePanel(visible(horizon))}
      </div>
    </div>
  `);
}

function stretch() {
  const start = state.selected;
  const days = [start, addDays(start, 1), addDays(start, 2)];
  const windowRows = items().filter(
    (item) => isOverdue(item) || (item.date >= days[0] && item.date <= days[2]),
  );
  return chrome(`
    ${overduePin()}
    ${weekStrip(start, { chips: true, windowDays: days })}
    <div class="stretch">
      <div class="panel">
        <div class="panel-h"><h3>72 hours</h3><small>${formatDay(days[0], "short")} – ${formatDay(days[2], "short")} · click a day column to add</small></div>
        <div class="three">
          <div class="three-gutter">${HOURS.map((hour) => `<span>${formatHour(`${String(hour).padStart(2, "0")}:00`)}</span>`).join("")}</div>
          ${days
            .map((date) => {
              const dayItems = visible().filter(
                (item) => item.date === date || (date === TODAY && isOverdue(item)),
              );
              return `<div>
                <button class="three-hd ${date === TODAY ? "is-today" : ""}" type="button" data-day="${date}">
                  <span>${WEEKDAYS[(fromIso(date).getDay() + 6) % 7]}</span>
                  <strong>${Number(date.slice(-2))}</strong>
                </button>
                <div class="three-col ${date === TODAY ? "is-today" : ""}" data-col="${date}">
                  ${dayItems
                    .map((item) => {
                      const hour = item.allDay || !item.time ? 8 : Number(item.time.slice(0, 2));
                      const top = Math.max(0, hour - 8) * 40 + (item.time && item.time.endsWith("30") ? 20 : 6);
                      return itemButton(item).replace('class="card', `style="top:${top}px" class="card`);
                    })
                    .join("")}
                </div>
              </div>`;
            })
            .join("")}
        </div>
      </div>
      ${peoplePanel(visible(windowRows), "These 72 hours + overdue")}
    </div>
  `);
}

function mapView() {
  const month = state.selected.slice(0, 7);
  const cells = monthCells(month);
  const monthName = fromIso(`${month}-01`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
  return chrome(`
    ${overduePin()}
    <div class="map">
      <div class="panel">
        <div class="panel-h">
          <div>
            <h3>${monthName}</h3>
            <small>Names in the cells</small>
          </div>
          <div class="month-nav">
            <button class="o2-btn" type="button" data-month="-1">‹</button>
            <button class="o2-btn" type="button" data-today>Today</button>
            <button class="o2-btn" type="button" data-month="1">›</button>
          </div>
        </div>
        <div class="month">
          ${WEEKDAYS.map((day) => `<b>${day}</b>`).join("")}
          ${cells
            .map((cell) => {
              const dayItems = visible().filter((item) => item.date === cell.date);
              const showOverdue = cell.date === TODAY ? visible().filter(isOverdue) : [];
              const all = sortItems([...showOverdue.filter((item) => item.date !== cell.date), ...dayItems]);
              return `<button class="m-cell ${cell.inMonth ? "" : "out"} ${cell.date === state.selected ? "is-on" : ""} ${cell.date === TODAY ? "is-today" : ""}" type="button" data-day="${cell.date}">
                <span class="n">${Number(cell.date.slice(-2))}</span>
                ${all
                  .slice(0, 3)
                  .map((item) => {
                    const who = item.kind === "task" ? memberOf(item.assignee).short : "";
                    return `<span class="ws-chip ${isOverdue(item) ? "warn" : item.kind === "event" ? "event" : ""}">${item.time && !item.allDay ? `${item.time} ` : ""}${escapeHtml(item.title)}${who ? ` · ${who}` : ""}</span>`;
                  })
                  .join("")}
              </button>`;
            })
            .join("")}
        </div>
      </div>
      <div>
        ${dayHours(state.selected)}
        <div class="panel" style="margin-top:14px">
          <div class="panel-h"><h3>This day</h3><small>Agenda + rotation</small></div>
          ${agendaList(
            sortItems(
              visible().filter(
                (item) => item.date === state.selected || (state.selected === TODAY && isOverdue(item)),
              ),
            ),
            "Nothing on this day. Click an hour to add.",
          )}
        </div>
      </div>
    </div>
  `);
}

function gallery() {
  return `
    ${bar()}
    <div class="o2-gallery">
      <p class="o2-label">Operations · combined products</p>
      <h1>Three ways to run the house. Same work underneath.</h1>
      <p class="lede">
        People is how you see the day. Agenda is how you see the stretch.
        Rotation is what makes chores fair. Today-first, 3-day, and month
        are the calendars that actually fit. Each product below is a full
        Operations — not a fragment. Same Park Street week. Mark bins done
        and Alex gets next Tuesday in every view.
      </p>
      <div class="o2-picks">
        <button class="o2-pick" type="button" data-p="pulse">
          <div class="o2-pick-preview is-pulse" aria-hidden="true">
            <i class="mini-strip"></i>
            <i class="mini-hours"></i>
            <i class="mini-list"></i>
          </div>
          <div class="o2-pick-body">
            <p class="why">Default · the one I’d ship</p>
            <h3>Pulse</h3>
            <p>Today-first hours, a compact week strip, next-7 agenda, and who’s on it.</p>
          </div>
        </button>
        <button class="o2-pick" type="button" data-p="stretch">
          <div class="o2-pick-preview is-stretch" aria-hidden="true">
            <i class="mini-three"></i>
            <i class="mini-people"></i>
          </div>
          <div class="o2-pick-body">
            <p class="why">When the week is dense</p>
            <h3>Stretch</h3>
            <p>A 3-day hour calendar plus people. Hours that fit, owners you can scan.</p>
          </div>
        </button>
        <button class="o2-pick" type="button" data-p="map">
          <div class="o2-pick-preview is-map" aria-hidden="true">
            <i class="mini-month"></i>
            <i class="mini-day"></i>
          </div>
          <div class="o2-pick-body">
            <p class="why">When you need the month</p>
            <h3>Map</h3>
            <p>Readable month, then the selected day with hours. Landlord and plumber live here.</p>
          </div>
        </button>
      </div>
    </div>
    ${toast()}
  `;
}

function drawer() {
  if (state.adding) return addDrawer();
  if (!state.openId) return "";
  const item = items().find((row) => row.id === state.openId);
  if (!item) return "";
  const who = item.kind === "task" ? memberOf(item.assignee) : HOUSE;
  const next = item.rotation ? memberOf(nextInRotation(item.rotation, item.assignee)) : null;
  return `
    <button class="drawer-back" type="button" data-close aria-label="Close"></button>
    <section class="drawer">
      <p class="o2-label">${item.kind === "task" ? "Task" : CATEGORY_LABEL[item.category]} · ${isOverdue(item) ? "Overdue" : "Scheduled"}</p>
      <h2>${escapeHtml(item.title)}</h2>
      <p class="meta">${formatDay(item.date)} · ${item.allDay ? "All day" : formatHour(item.time)} · ${who.name}</p>
      ${item.notes ? `<p class="meta" style="margin-top:10px">${escapeHtml(item.notes)}</p>` : ""}
      ${
        item.checklist
          ? item.checklist
              .map(
                (step) => `<label class="check"><input type="checkbox" data-check="${item.id}:${step.id}" ${step.done ? "checked" : ""}>${escapeHtml(step.title)}</label>`,
              )
              .join("")
          : ""
      }
      ${
        item.rotation
          ? `<div class="chain">${item.rotation
              .map((id) => `<i class="${id === item.assignee ? "on" : ""}">${memberOf(id).short}</i>`)
              .join("")}</div>`
          : ""
      }
      ${item.lastDone ? `<p class="meta">Last done by ${memberOf(item.lastDone.by).short} · ${formatDay(item.lastDone.date, "short")}</p>` : ""}
      ${
        item.kind === "task"
          ? `<div class="field"><label>Hand to</label>
              <select data-reassign="${item.id}">${MEMBERS.map((m) => `<option value="${m.id}" ${m.id === item.assignee ? "selected" : ""}>${m.name}</option>`).join("")}</select>
            </div>`
          : ""
      }
      <div class="actions">
        ${item.kind === "task" ? `<button class="o2-btn sage" type="button" data-done="${item.id}">${next ? `Done · hand to ${next.short}` : "Mark done"}</button>` : ""}
        ${item.kind === "task" ? `<button class="o2-btn" type="button" data-skip="${item.id}">Skip a week</button>` : ""}
        <button class="o2-btn danger" type="button" data-remove="${item.id}">Remove</button>
        <button class="o2-btn ghost" type="button" data-close>Close</button>
      </div>
    </section>
  `;
}

function addDrawer() {
  const draft = typeof state.adding === "object" && state.adding ? state.adding : {};
  const date = draft.date || state.selected;
  const time = draft.time || "09:00";
  return `
    <button class="drawer-back" type="button" data-close aria-label="Close"></button>
    <section class="drawer">
      <p class="o2-label">Add to the house</p>
      <h2>New item</h2>
      <form id="add-form">
        <div class="field"><label>Type</label>
          <select name="kind"><option value="task">Task</option><option value="event">Event</option></select>
        </div>
        <div class="field"><label>Title</label><input name="title" required placeholder="e.g. Boiler parts delivery" autofocus></div>
        <div class="field"><label>Date</label><input name="date" type="date" value="${date}" required></div>
        <div class="field"><label>Time</label><input name="time" type="time" value="${time}"></div>
        <label class="check"><input type="checkbox" name="allDay"> All day</label>
        <div class="field"><label>Assigned to</label>
          <select name="assignee">${MEMBERS.map((m) => `<option value="${m.id}">${m.name}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Repeats</label>
          <select name="repeat"><option value="none">Doesn’t</option><option value="weekly" selected>Every week</option><option value="monthly">Every month</option></select>
        </div>
        <label class="check"><input type="checkbox" name="rotate" checked> Rotate Maya → Jordan → Alex</label>
        <div class="field"><label>Event kind</label>
          <select name="category">
            <option value="chore">Task / chore</option>
            <option value="delivery">Delivery</option>
            <option value="visit">Visit</option>
            <option value="appointment">Appointment</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="field"><label>Details</label><textarea name="notes" rows="3"></textarea></div>
        <div class="actions">
          <button class="o2-btn sage" type="submit">Add to calendar</button>
          <button class="o2-btn ghost" type="button" data-close>Cancel</button>
        </div>
      </form>
    </section>
  `;
}

function render() {
  if (!["gallery", "pulse", "stretch", "map"].includes(state.product)) {
    state.product = "gallery";
  }
  if (state.product === "gallery") root.innerHTML = gallery();
  else if (state.product === "pulse") root.innerHTML = pulse();
  else if (state.product === "stretch") root.innerHTML = stretch();
  else if (state.product === "map") root.innerHTML = mapView();
  bind();
}

function bind() {
  root.querySelectorAll("[data-p]").forEach((el) => {
    el.addEventListener("click", () => go(el.dataset.p));
  });
  root.querySelectorAll("[data-day]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      state.selected = el.dataset.day;
      render();
    });
  });
  root.querySelectorAll("[data-today]").forEach((el) => {
    el.addEventListener("click", () => {
      state.selected = TODAY;
      render();
    });
  });
  root.querySelectorAll("[data-month]").forEach((el) => {
    el.addEventListener("click", () => {
      state.selected = addMonths(state.selected, Number(el.dataset.month));
      render();
    });
  });
  root.querySelectorAll("[data-open]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      state.openId = el.dataset.open;
      state.adding = null;
      render();
    });
  });
  root.querySelectorAll("[data-done]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      const result = store.complete(el.dataset.done);
      if (result) {
        const who = memberOf(result.to).short;
        const when = formatDay(result.date, "short");
        flash(
          result.repeating
            ? `${result.title} · handed to ${who} · ${when}`
            : `${result.title} marked done`,
        );
      }
      render();
    });
  });
  root.querySelectorAll("[data-skip]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      const result = store.skip(el.dataset.skip);
      if (result) flash(`${result.title} moved to ${formatDay(result.date, "short")}`);
      render();
    });
  });
  root.querySelectorAll("[data-remove]").forEach((el) => {
    el.addEventListener("click", () => {
      store.remove(el.dataset.remove);
      state.openId = null;
      flash("Removed from the house");
      render();
    });
  });
  root.querySelectorAll("[data-close]").forEach((el) => {
    el.addEventListener("click", () => {
      state.openId = null;
      state.adding = null;
      render();
    });
  });
  root.querySelectorAll("[data-add]").forEach((el) => {
    el.addEventListener("click", () => {
      state.adding = { date: state.selected, time: "09:00" };
      state.openId = null;
      render();
    });
  });
  root.querySelectorAll("[data-add-at]").forEach((el) => {
    el.addEventListener("click", (event) => {
      if (event.target.closest("[data-open]")) return;
      const [date, time] = el.dataset.addAt.split("|");
      state.adding = { date, time };
      state.openId = null;
      render();
    });
  });
  root.querySelectorAll("[data-col]").forEach((el) => {
    el.addEventListener("click", (event) => {
      if (event.target.closest("[data-open]")) return;
      const y = event.offsetY;
      const hour = Math.min(20, Math.max(8, 8 + Math.floor(y / 40)));
      state.adding = { date: el.dataset.col, time: `${String(hour).padStart(2, "0")}:00` };
      state.openId = null;
      render();
    });
  });
  root.querySelectorAll("[data-filter]").forEach((el) => {
    el.addEventListener("click", () => {
      state.filter = el.dataset.filter;
      render();
    });
  });
  root.querySelectorAll("[data-check]").forEach((el) => {
    el.addEventListener("change", () => {
      const [id, checkId] = el.dataset.check.split(":");
      store.toggleCheck(id, checkId);
    });
  });
  root.querySelectorAll("[data-reassign]").forEach((el) => {
    el.addEventListener("change", () => {
      store.reassign(el.dataset.reassign, el.value);
      flash(`Handed to ${memberOf(el.value).short}`);
      render();
    });
  });
  root.querySelectorAll("[data-undo]").forEach((el) => {
    el.addEventListener("click", () => {
      if (store.undo()) {
        state.toast = { text: "Undone", undo: false };
        render();
      }
    });
  });
  root.querySelectorAll("[data-reset]").forEach((el) => {
    el.addEventListener("click", () => {
      store.reset();
      state.selected = TODAY;
      state.openId = null;
      state.adding = null;
      flash("Park Street week reset", false);
      render();
    });
  });
  const form = root.querySelector("#add-form");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const kind = String(data.get("kind") || "task");
      const title = String(data.get("title") || "").trim();
      if (!title) return;
      const rotate = data.get("rotate") === "on";
      const id = store.add({
        kind,
        title,
        date: String(data.get("date")),
        time: String(data.get("time") || "09:00"),
        allDay: data.get("allDay") === "on",
        assignee: String(data.get("assignee") || "maya"),
        rotation: kind === "task" && rotate ? ["maya", "jordan", "alex"] : undefined,
        repeat: String(data.get("repeat") || "none"),
        category: String(data.get("category") || (kind === "task" ? "chore" : "other")),
        notes: String(data.get("notes") || ""),
      });
      state.adding = null;
      state.openId = id;
      state.selected = String(data.get("date"));
      flash(`${title} added`);
      render();
    });
  }
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && (state.openId || state.adding)) {
    state.openId = null;
    state.adding = null;
    render();
  }
});

store.subscribe(() => {});
render();
