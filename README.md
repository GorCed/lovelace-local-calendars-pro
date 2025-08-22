
# Local Calendars Pro Card

A Lovelace card that shows your `calendar.*` entities in **day / week / month** views with **per-calendar colors**.
It is built on top of EventCalendar (vkurko/calendar) and fetches events via Home Assistant's Calendar REST API.

## Installation (HACS)
1. Open **HACS → Frontend → Custom repositories → Add** and add:
   - **URL:** `https://github.com/<YOUR-ACCOUNT>/lovelace-local-calendars-pro`
   - **Category:** `Plugin`
2. Install **Local Calendars Pro Card**. HACS will add the resource automatically.
   - If you add it manually: **URL:** `/hacsfiles/lovelace-local-calendars-pro/local-calendars-pro.js`, **Type:** `module`

## Configuration (examples)
```yaml
# A) Two local calendars, week view, explicit colors
type: custom:local-calendars-pro
title: Family calendar
default_view: timeGridWeek   # timeGridDay | timeGridWeek | dayGridMonth
entities:
  - calendar.local_family
  - calendar.local_projects
locale: en
colors:
  calendar.local_family: "#1976d2"           # blue bg, white text by default
  calendar.local_projects:
    bg: "#43a047"                             # green background
    text: "#ffffff"                           # white text
```
```yaml
# B) Auto-discover all calendar.* entities, month view, auto colors
type: custom:local-calendars-pro
title: All calendars
default_view: dayGridMonth
locale: en
```

### Options
- `title` (string): Card title
- `default_view` (string): `timeGridDay` | `timeGridWeek` | `dayGridMonth`
- `entities` (list): calendar entities; if omitted, all `calendar.*` are shown
- `locale` (string): locale code, e.g. `en`, `sv`, `de`
- `colors` (object): per-entity color mapping. Value can be a string (bg) or an object `{bg, text}`.

## Features
- Day/Week/Month views with toolbar switching
- Per-calendar color coding (includes a legend)
- Automatic loading of events when the date range changes

## Requirements
- At least one calendar entity in Home Assistant (e.g., **Local Calendar**)

## License
MIT
