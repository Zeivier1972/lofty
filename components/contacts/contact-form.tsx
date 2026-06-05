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

const schema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  source: z.string().optional(),
  status: z.string().default("LEAD"),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  spouse: z.string().optional(),
  buyerBudgetMin: z.coerce.number().optional(),
  buyerBudgetMax: z.coerce.number().optional(),
  buyerBedroomsMin: z.coerce.number().optional(),
  buyerLocation: z.string().optional(),
  sellerAddress: z.string().optional(),
  sellerEstimatedValue: z.coerce.number().optional(),
})

type FormData = z.infer<typeof schema>

interface ContactFormProps {
  contact?: any
}

export default function ContactForm({ contact }: ContactFormProps) {
  const router = useRouter()
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: contact || { status: "LEAD" },
  })

  const onSubmit = async (data: FormData) => {
    try {
      const url = contact ? `/api/contacts/${contact.id}` : "/api/contacts"
      const method = contact ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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
            <Label>Last Name *</Label>
            <Input {...register("lastName")} className="mt-1" />
            {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName.message}</p>}
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

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting} className="bg-lofty-600 hover:bg-lofty-700">
          {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : contact ? "Update Contact" : "Create Contact"}
        </Button>
      </div>
    </form>
  )
}
