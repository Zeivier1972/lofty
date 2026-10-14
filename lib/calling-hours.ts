/**
 * When it is legal and reasonable to place an outbound call.
 *
 * The TCPA measures its 8am–9pm window in the *called party's* local time, not
 * the caller's. The previous check used America/New_York for everyone, so a
 * California lead could be dialled at 8:00 ET — 5:00am for them.
 *
 * Rather than carry a full NANP area-code table (hundreds of rows, each one a
 * chance to be quietly wrong), this takes two tiers:
 *
 *   • Area codes known to be Eastern get the full 8am–9pm ET window. This is
 *     where virtually all of Catherine's business is, so precision matters most
 *     here and the list is worth maintaining by hand.
 *
 *   • Everything else — other US zones, unrecognised codes, international
 *     numbers — gets 11am–9pm ET. At 11am ET it is 8am Pacific, so that window
 *     is inside 8am–9pm local for every continental US zone without needing to
 *     know which one applies.
 *
 * A missing or mistyped Eastern code therefore costs a few morning calling
 * hours, never a call placed at 6am in someone's bedroom. That is the correct
 * direction to fail in.
 */

/** Area codes in the US Eastern zone. Partial-state codes are omitted on
 *  purpose: Florida's 850 panhandle is Central, so it is not here. */
const EASTERN_AREA_CODES = new Set<string>([
  // Florida (850 excluded — panhandle is Central)
  "239", "305", "321", "352", "386", "407", "561", "656", "689", "727",
  "754", "772", "786", "813", "863", "904", "941", "954",
  // New York
  "212", "315", "329", "332", "347", "363", "516", "518", "585", "607",
  "631", "646", "680", "716", "718", "838", "845", "914", "917", "929", "934",
  // New Jersey
  "201", "551", "609", "640", "732", "848", "856", "862", "908", "973",
  // Pennsylvania
  "215", "223", "267", "272", "412", "445", "484", "570", "582", "610",
  "717", "724", "814", "835", "878",
  // New England
  "339", "351", "413", "508", "617", "774", "781", "857", "978",          // MA
  "203", "475", "860", "959",                                             // CT
  "401", "603", "802", "207",                                             // RI NH VT ME
  // Mid-Atlantic
  "227", "240", "301", "410", "443", "667",                               // MD
  "202", "302", "304", "681",                                             // DC DE WV
  "276", "434", "540", "571", "686", "703", "757", "804", "826",          // VA
  // Southeast
  "252", "336", "472", "704", "743", "828", "910", "919", "980", "984",   // NC
  "803", "839", "843", "854", "864",                                      // SC
  "229", "404", "470", "478", "678", "706", "762", "770", "912", "943",   // GA
  // Midwest Eastern
  "216", "220", "234", "283", "326", "330", "380", "419", "436", "440",
  "513", "567", "614", "740", "937",                                      // OH
  "231", "248", "269", "313", "517", "586", "616", "679", "734", "810",
  "906", "947", "989",                                                    // MI
  "219", "260", "317", "463", "574", "765", "812", "930",                 // IN
])

/** NANP area code from a phone number, or null if it does not look like one. */
export function areaCodeOf(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = String(phone).replace(/\D/g, "")
  // 10 digits, or 11 starting with the US country code.
  if (digits.length === 10) return digits.slice(0, 3)
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1, 4)
  return null
}

export function isEasternAreaCode(phone: string | null | undefined): boolean {
  const ac = areaCodeOf(phone)
  return ac ? EASTERN_AREA_CODES.has(ac) : false
}

/** Current hour and weekday in Eastern time. `now` is injectable for tests. */
function easternParts(now: Date): { hour: number; day: number } {
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
  return { hour: et.getHours(), day: et.getDay() }
}

/**
 * May we place an outbound call to this number right now?
 *
 * Sundays are excluded regardless — that is Catherine's own rule, not the TCPA's.
 */
export function isWithinCallingWindow(phone: string | null | undefined, now: Date = new Date()): boolean {
  const { hour, day } = easternParts(now)
  if (day === 0) return false
  const earliest = isEasternAreaCode(phone) ? 8 : 11
  return hour >= earliest && hour < 21
}
