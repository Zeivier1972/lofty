// Shared September event config — used by the date-anchored reminder cron and
// the RSVP confirmation endpoint so they never drift.

export interface EventInfo {
  tag: string        // the utm_content tag the Facebook form applies
  city: string
  dateLabel: string
  isoDate: string    // event start day (for the countdown), Colombia time
  link: string       // Eventbrite ticket link
  venue?: string
  sheetTab: string   // exact Google Sheet tab name event leads sync into
}

export const EVENTS: EventInfo[] = [
  {
    tag: "Evento Septiembre 2026 Bogota",
    city: "Bogotá",
    dateLabel: "25 y 26 de septiembre",
    isoDate: "2026-09-25",
    link: "https://www.eventbrite.com/e/1998107399018?aff=oddtdtcreator",
    sheetTab: "Bogota Septiembre 24 y 25",
  },
  {
    tag: "Evento Medellin Septiembre 2026",
    city: "Medellín",
    dateLabel: "23 de septiembre",
    isoDate: "2026-09-23",
    link: "https://www.eventbrite.com/e/1998110626672?aff=oddtdtcreator",
    venue: "Hotel Dann Carlton, El Poblado",
    sheetTab: "Medellin Septiembre 23",
  },
]

export function findEventByTag(tag: string): EventInfo | undefined {
  const t = (tag || "").toLowerCase()
  return EVENTS.find(e => e.tag.toLowerCase() === t)
}
