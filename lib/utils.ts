import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow, isToday, isTomorrow, isYesterday } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "N/A"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "N/A"
  const d = new Date(date)
  if (isToday(d)) return "Today"
  if (isTomorrow(d)) return "Tomorrow"
  if (isYesterday(d)) return "Yesterday"
  return format(d, "MMM d, yyyy")
}

export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return "N/A"
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ""
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function getLeadScoreColor(score: number): string {
  if (score >= 80) return "text-green-600 bg-green-50"
  if (score >= 60) return "text-yellow-600 bg-yellow-50"
  if (score >= 40) return "text-orange-600 bg-orange-50"
  return "text-red-600 bg-red-50"
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    LEAD: "bg-gray-100 text-gray-700",
    PROSPECT: "bg-blue-100 text-blue-700",
    ACTIVE_CLIENT: "bg-green-100 text-green-700",
    PAST_CLIENT: "bg-purple-100 text-purple-700",
    SPHERE_OF_INFLUENCE: "bg-yellow-100 text-yellow-700",
    ARCHIVED: "bg-gray-100 text-gray-500",
    ACTIVE: "bg-green-100 text-green-700",
    PENDING: "bg-yellow-100 text-yellow-700",
    SOLD: "bg-blue-100 text-blue-700",
    EXPIRED: "bg-red-100 text-red-700",
    UNDER_CONTRACT: "bg-orange-100 text-orange-700",
    CLOSED: "bg-purple-100 text-purple-700",
    CANCELLED: "bg-red-100 text-red-700",
    ACTIVE_LISTING: "bg-green-100 text-green-700",
    SCHEDULED: "bg-blue-100 text-blue-700",
    CONFIRMED: "bg-green-100 text-green-700",
    COMPLETED: "bg-gray-100 text-gray-700",
    NO_SHOW: "bg-red-100 text-red-700",
  }
  return colors[status] || "bg-gray-100 text-gray-700"
}

export function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    LOW: "bg-gray-100 text-gray-600",
    MEDIUM: "bg-blue-100 text-blue-600",
    HIGH: "bg-orange-100 text-orange-600",
    URGENT: "bg-red-100 text-red-600",
  }
  return colors[priority] || "bg-gray-100 text-gray-600"
}

export const LEAD_SOURCES = [
  "WEBSITE", "REFERRAL", "ZILLOW", "REALTOR", "FACEBOOK",
  "INSTAGRAM", "GOOGLE", "OPEN_HOUSE", "COLD_CALL", "EMAIL_CAMPAIGN", "OTHER",
]

export const CONTACT_STATUSES = [
  { value: "LEAD", label: "Lead" },
  { value: "PROSPECT", label: "Prospect" },
  { value: "ACTIVE_CLIENT", label: "Active Client" },
  { value: "PAST_CLIENT", label: "Past Client" },
  { value: "SPHERE_OF_INFLUENCE", label: "Sphere of Influence" },
  { value: "ARCHIVED", label: "Archived" },
]

export const TASK_TYPES = [
  { value: "FOLLOW_UP", label: "Follow Up" },
  { value: "CALL", label: "Phone Call" },
  { value: "EMAIL", label: "Email" },
  { value: "MEETING", label: "Meeting" },
  { value: "SHOWING", label: "Showing" },
  { value: "OFFER", label: "Make Offer" },
  { value: "CONTRACT", label: "Contract" },
  { value: "OTHER", label: "Other" },
]

export const APPOINTMENT_TYPES = [
  { value: "SHOWING", label: "Property Showing" },
  { value: "LISTING_APPOINTMENT", label: "Listing Appointment" },
  { value: "BUYER_CONSULTATION", label: "Buyer Consultation" },
  { value: "CLOSING", label: "Closing" },
  { value: "OPEN_HOUSE", label: "Open House" },
  { value: "OTHER", label: "Other" },
]

export const PROPERTY_TYPES = [
  { value: "SINGLE_FAMILY", label: "Single Family" },
  { value: "CONDO", label: "Condo" },
  { value: "TOWNHOUSE", label: "Townhouse" },
  { value: "MULTI_FAMILY", label: "Multi-Family" },
  { value: "LAND", label: "Land" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "OTHER", label: "Other" },
]

export const TRANSACTION_STATUSES = [
  { value: "ACTIVE_LISTING", label: "Active Listing" },
  { value: "UNDER_CONTRACT", label: "Under Contract" },
  { value: "CLOSED", label: "Closed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "EXPIRED", label: "Expired" },
]
