
// local-calendars-pro.js
// A Lovelace custom card that renders Home Assistant calendars (calendar.*) using
// the EventCalendar standalone bundle (vkurko/calendar). It supports day/week/month
// views and per-calendar colors.

class LocalCalendarsProCard extends HTMLElement {
  static getStubConfig() {
    return { title: "Calendar", default_view: "timeGridWeek", locale: "en" };
  }

  setConfig(config) {
    this._config = {
      title: config.title ?? "Calendar",
      default_view: config.default_view ?? "timeGridWeek", // timeGridDay | timeGridWeek | dayGridMonth
      entities: Array.isArray(config.entities) ? config.entities : null,
      locale: config.locale ?? "en",
      theme: config.theme ?? "auto",
      colors: config.colors || {}
    };
    this._ec = null;
    this._container = this._container || document.createElement("div");
    this._container.id = "ec-root";
    this._container.style.minHeight = "480px";
    this._legend = this._legend || document.createElement("div");
    this._legend.id = "ec-legend";
    this._legend.style.marginTop = "8px";
    this._lastRange = null;
    this._eventsCache = new Map();
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    // Auto-discover calendar entities if none are specified
    if (!this._config?.entities) {
      this._entities = Object.keys(hass.states).filter((e) => e.startsWith("calendar."));
    } else {
      this._entities = this._config.entities;
    }
    if (!this._initStarted) {
      this._initStarted = true;
      this._ensureLoaded().then(() => this._initCalendar());
    }
    this._renderLegend();
  }

  connectedCallback() { if (!this.shadowRoot) this.attachShadow({ mode: "open" }); this._render(); }
  disconnectedCallback() { if (this._ec && window.EventCalendar) window.EventCalendar.destroy(this._ec); }
  getCardSize() { return 6; }

  async _ensureLoaded() {
    // Load EventCalendar (standalone bundle) if not already available
    if (!window.EventCalendar) {
      await new Promise((resolve, reject) => {
        const cssHref = "https://cdn.jsdelivr.net/npm/@event-calendar/build@4.5.1/dist/event-calendar.min.css";
        if (!document.querySelector(`link[href="${cssHref}"]`)) {
          const link = document.createElement("link");
          link.rel = "stylesheet"; link.href = cssHref; document.head.appendChild(link);
        }
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/@event-calendar/build@4.5.1/dist/event-calendar.min.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load EventCalendar."));
        document.head.appendChild(script);
      });
    }
  }

  _render() {
    if (!this.shadowRoot) return;
    const styles = `
      #wrap { padding: 12px 16px; }
      #ec-legend { display: flex; flex-wrap: wrap; gap: 10px; }
      .legend-item { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; opacity: .9; }
      .swatch { width: 12px; height: 12px; border-radius: 2px; border: 1px solid rgba(0,0,0,.2); }
    `;
    this.shadowRoot.innerHTML = `
      <ha-card>
        <style>${styles}</style>
        <div class="header" style="padding:16px;border-bottom:1px solid var(--divider-color);font-weight:600;">
          ${this._config?.title ?? "Calendar"}
        </div>
        <div id="wrap">
          <div id="container"></div>
          <div id="legend"></div>
        </div>
      </ha-card>
    `;
    const container = this.shadowRoot.getElementById("container");
    const legend = this.shadowRoot.getElementById("legend");
    container.appendChild(this._container);
    legend.appendChild(this._legend);
  }

  _toolbar() { return { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }; }

  _initCalendar() {
    if (!window.EventCalendar || !this._container) return;
    const opts = {
      view: this._config.default_view,
      headerToolbar: this._toolbar(),
      locale: this._config.locale || "en",
      height: "auto",
      events: [],
      datesSet: (info) => this._onDatesSet(info),
      eventClick: (info) => this._onEventClick(info),
      editable: false,
      nowIndicator: true
    };
    this._ec = window.EventCalendar.create(this._container, opts);
    const initial = this._ec.getView?.();
    if (initial?.currentStart && initial?.currentEnd) this._onDatesSet({ start: initial.currentStart, end: initial.currentEnd });
  }

  async _onDatesSet(info) {
    if (!this._hass || !this._entities?.length) return;
    const startIso = (info.start instanceof Date ? info.start : new Date(info.start)).toISOString();
    const endIso   = (info.end   instanceof Date ? info.end   : new Date(info.end)).toISOString();
    const cacheKey = `${startIso}__${endIso}`;
    if (this._eventsCache.has(cacheKey)) { this._ec.setOption("events", this._eventsCache.get(cacheKey)); return; }

    const lists = await Promise.all(
      this._entities.map((eid) => this._hass.callApi("get", `calendars/${encodeURIComponent(eid)}?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`)
        .then((arr) => arr.map((e, idx) => this._toEvent(e, eid, idx))))
    );
    const merged = lists.flat();
    this._eventsCache.set(cacheKey, merged);
    this._ec.setOption("events", merged);
  }

  _toEvent(ev, entityId, idx) {
    // Home Assistant calendar API returns {start: {dateTime|date}, end: {dateTime|date}}
    const isAllDay = !!ev.start?.date && !!ev.end?.date;
    const start = ev.start?.dateTime || (ev.start?.date ? `${ev.start.date}T00:00:00` : null);
    const end   = ev.end?.dateTime   || (ev.end?.date   ? `${ev.end.date}T00:00:00`   : null);
    const colors = this._colorForEntity(entityId);
    return {
      id: `${entityId}:${ev.uid || ev.id || idx}:${start}`,
      title: ev.summary || ev.title || "(untitled)",
      start, end, allDay: !!isAllDay,
      backgroundColor: colors.bg,
      color: colors.bg,      // border/accents
      textColor: colors.text,
      extendedProps: { entity_id: entityId }
    };
  }

  _hashColor(str) {
    // Deterministic HSL color from a string (entity_id)
    let h = 0; for (let i=0;i<str.length;i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    const hue = Math.abs(h) % 360; const sat = 65; const light = 48;
    return `hsl(${hue} ${sat}% ${light}%)`;
  }

  _colorForEntity(entityId) {
    const entry = this._config.colors?.[entityId];
    if (!entry) return { bg: this._hashColor(entityId), text: "#fff" };
    if (typeof entry === "string") return { bg: entry, text: "#fff" };
    return { bg: entry.bg || this._hashColor(entityId), text: entry.text || "#fff" };
  }

  _renderLegend() {
    if (!this._legend || !this._entities) return;
    this._legend.innerHTML = "";
    for (const eid of this._entities) {
      const colors = this._colorForEntity(eid);
      const item = document.createElement("div");
      item.className = "legend-item";
      item.innerHTML = `<span class="swatch" style="background:${colors.bg};border-color:${colors.bg}"></span><span>${eid}</span>`;
      this._legend.appendChild(item);
    }
  }

  _onEventClick(info) {
    const entity = info?.event?.extendedProps?.entity_id;
    if (entity) this._fire("hass-more-info", { entityId: entity });
  }

  _fire(type, detail, options = {}) {
    const ev = new CustomEvent(type, { detail, bubbles: options.bubbles !== false, cancelable: options.cancelable !== false, composed: options.composed !== false });
    this.dispatchEvent(ev); return ev;
  }
}

customElements.define("local-calendars-pro", LocalCalendarsProCard);
