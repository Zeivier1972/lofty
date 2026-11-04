/**
 * The DM bots used to open with "¿Cuál es tu nombre?" even when the person's
 * profile already says who they are. When we know a real name, greet them by
 * it and skip straight to the email question.
 */

/** A usable personal name from a profile, or null (handles, emojis, brands). */
export function usableName(raw: string | null | undefined): string | null {
  const name = (raw || "").replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s'.-]/g, " ").replace(/\s+/g, " ").trim()
  if (name.length < 2 || name.length > 50) return null
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ\s'.-]*$/.test(name)) return null
  return name.split(" ").slice(0, 3).join(" ")
}

export function greetingFor(
  greeting: string,
  name: string | null,
): { greeting: string; firstName: string | null; state: "ASKED_NAME" | "ASKED_EMAIL" } {
  if (!name) return { greeting, firstName: null, state: "ASKED_NAME" }
  const first = name.split(" ")[0]
  let g = greeting.replace(/¡Hola!/, `¡Hola ${first}!`)
  if (!g.includes(first)) g = `¡Hola ${first}! ${g.replace(/^¡?Hola[^!]*!\s*/i, "")}`
  g = /¿\s*(Cuál es tu nombre|Cómo te llamas)[^?]*\?/i.test(g)
    ? g.replace(/¿\s*(Cuál es tu nombre|Cómo te llamas)[^?]*\?/i, "¿A qué correo electrónico te envío la información?")
    : `${g} ¿A qué correo electrónico te envío la información?`
  return { greeting: g, firstName: name, state: "ASKED_EMAIL" }
}
