"use client"

import { PHONE_COUNTRIES } from "@/lib/phone-country"

/** Country code picker that sits next to a phone input (Colombia first). */
export default function PhoneCountrySelect({
  value, onChange, className, id,
}: { value: string; onChange: (code: string) => void; className?: string; id?: string }) {
  return (
    <select
      id={id}
      aria-label="Código de país"
      value={value}
      onChange={e => onChange(e.target.value)}
      className={className}
    >
      {PHONE_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
    </select>
  )
}
