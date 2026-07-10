"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { CONTACT_STATUSES, LEAD_SOURCES } from "@/lib/utils"

// Only firstName is truly required. Everything else must tolerate empty AND
// null — imported leads routinely have no last name and null fields, and a
// strict schema silently blocked saving when the agent only edited a phone.
const optionalStr = z.string().optional().nullable()
const optionalNum = z.preprocess(
  v => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z.number().optional()
)

const schema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: optionalStr,
  email: z.string().email("Invalid email").optional().or(z.literal("")).nullable(),
  phone: optionalStr,
  phone2: optionalStr,
  address: optionalStr,
  city: optionalStr,
  state: optionalStr,
  zip: optionalStr,
  source: optionalStr,
  status: z.string().default("LEAD"),
  company: optionalStr,
  jobTitle: optionalStr,
  spouse: optionalStr,
  buyerBudgetMin: optionalNum,
  buyerBudgetMax: optionalNum,
  buyerBedroomsMin: optionalNum,
  buyerLocation: optionalStr,
  sellerAddress: optionalStr,
  sellerEstimatedValue: optionalNum,
  doNotText: z.boolean().optional(),
  doNotCall: z.boolean().optional(),
  doNotEmail: z.boolean().optional(),
})

type FormData = z.infer<typeof schema>

interface ContactFormProps {
  contact?: any
}

export default function ContactForm({ contact }: ContactFormProps) {
  const router = useRouter()
  const { toast } = useToast()

  // DB nulls fail zod's .optional() (it only accepts undefined) — sanitize so
  // untouched empty fields can never block saving the field you DID edit.
  const cleanDefaults = contact
    ? Object.fromEntries(Object.entries(contact).map(([k, v]) => [k, v === null ? undefined : v]))
    : { status: "LEAD" }

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: cleanDefaults as any,
  })

  const onSubmit = async (data: FormData) => {
    try {
      const url = contact ? `/api/contacts/${contact.id}` : "/api/contacts"
      const method = contact ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        // lastName is a required column in the DB — store empty string, not null
        body: JSON.stringify({ ...data, lastName: data.lastName || "" }),
      })
      if (!res.ok) throw new Error()
      const result = await res.json()
      toast({ title: contact ? "Contact updated" : "Contact created" })
      router.push(`/contacts/${result.id}`)
      router.refresh()
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" })
    }
  }

  // Surface the FIRST validation problem next to the Save button — a blocked
  // save must never be silent (it looked like "the form just doesn't save").
  const firstError = Object.values(errors)[0]?.message as string | undefined

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Basic Info */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>First Name *</Label>
            <Input {...register("firstName")} className="mt-1" />
            {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName.message}</p>}
          </div>
          <div>
            <Label>Last Name</Label>
            <Input {...register("lastName")} className="mt-1" />
          </div>
          <div>
            <Label>Email</Label>
            <Input {...register("email")} type="email" className="mt-1" />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <Label>Primary Phone</Label>
            <Input {...register("phone")} type="tel" className="mt-1" placeholder="(555) 123-4567" />
          </div>
          <div>
            <Label>Secondary Phone</Label>
            <Input {...register("phone2")} type="tel" className="mt-1" />
          </div>
          <div>
            <Label>Company</Label>
            <Input {...register("company")} className="mt-1" />
          </div>
          <div>
            <Label>Job Title</Label>
            <Input {...register("jobTitle")} className="mt-1" />
          </div>
          <div>
            <Label>Spouse/Partner</Label>
            <Input {...register("spouse")} className="mt-1" />
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Address</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Street Address</Label>
            <Input {...register("address")} className="mt-1" />
          </div>
          <div>
            <Label>City</Label>
            <Input {...register("city")} className="mt-1" />
          </div>
          <div>
            <Label>State</Label>
            <Input {...register("state")} className="mt-1" maxLength={2} />
          </div>
          <div>
            <Label>ZIP Code</Label>
            <Input {...register("zip")} className="mt-1" />
          </div>
        </CardContent>
      </Card>

      {/* CRM Settings */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">CRM Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>Lead Status</Label>
            <Select defaultValue={contact?.status || "LEAD"} onValueChange={(v) => setValue("status", v)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Lead Source</Label>
            <Select defaultValue={contact?.source || ""} onValueChange={(v) => setValue("source", v)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                {LEAD_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Buyer Profile */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Buyer Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>Min Budget</Label>
            <Input {...register("buyerBudgetMin")} type="number" className="mt-1" placeholder="300000" />
          </div>
          <div>
            <Label>Max Budget</Label>
            <Input {...register("buyerBudgetMax")} type="number" className="mt-1" placeholder="500000" />
          </div>
          <div>
            <Label>Min Bedrooms</Label>
            <Input {...register("buyerBedroomsMin")} type="number" className="mt-1" />
          </div>
          <div>
            <Label>Preferred Area</Label>
            <Input {...register("buyerLocation")} className="mt-1" placeholder="Austin, TX" />
          </div>
        </CardContent>
      </Card>

      {/* Seller Profile */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Seller Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Property Address</Label>
            <Input {...register("sellerAddress")} className="mt-1" placeholder="123 Main St, Austin TX 78701" />
          </div>
          <div>
            <Label>Estimated Value</Label>
            <Input {...register("sellerEstimatedValue")} type="number" className="mt-1" placeholder="500000" />
          </div>
        </CardContent>
      </Card>

      {/* Communication Preferences — these flags are enforced system-wide:
          Do Not Text blocks EVERY outbound SMS to this contact at the source */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Communication Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" {...register("doNotText")} className="mt-0.5 w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
            <span>
              <span className="text-sm font-medium text-gray-800 block">🚫 Do Not Text</span>
              <span className="text-xs text-gray-400">Blocks all SMS — Sofía, smart plans, and manual texts. Set automatically if they reply STOP/PARAR or their number can't receive messages.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" {...register("doNotCall")} className="mt-0.5 w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
            <span>
              <span className="text-sm font-medium text-gray-800 block">📵 Do Not Call</span>
              <span className="text-xs text-gray-400">Excluded from Sofía's auto-calls and the Power Dialer.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" {...register("doNotEmail")} className="mt-0.5 w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
            <span>
              <span className="text-sm font-medium text-gray-800 block">📪 Do Not Email</span>
              <span className="text-xs text-gray-400">Excluded from property alerts and email drips.</span>
            </span>
          </label>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end items-center">
        {firstError && (
          <p className="text-red-600 text-sm mr-auto">⚠️ {firstError}</p>
        )}
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting} className="bg-lofty-600 hover:bg-lofty-700">
          {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : contact ? "Update Contact" : "Create Contact"}
        </Button>
      </div>
    </form>
  )
}
