import nodemailer from "nodemailer"

let transporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (!transporter) {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })
    }
  }
  return transporter
}

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
}

export async function sendEmail(opts: EmailOptions): Promise<boolean> {
  const t = getTransporter()
  if (!t) {
    console.log("[EMAIL MOCK] To:", opts.to, "Subject:", opts.subject)
    return true
  }
  await t.sendMail({
    from: opts.from || process.env.SMTP_FROM || "CRM <noreply@loftycrm.com>",
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    replyTo: opts.replyTo,
  })
  return true
}

export function buildPropertyEmail(contact: { firstName: string }, property: any, agentName: string, agentPhone: string): string {
  return `
<!DOCTYPE html>
<html>
<head><style>
  body { font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; }
  .header { background: linear-gradient(135deg, #0e8fe9, #0359a1); color: white; padding: 24px; border-radius: 8px 8px 0 0; }
  .property-card { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin: 16px 0; }
  .property-img { width: 100%; height: 200px; object-fit: cover; }
  .property-info { padding: 16px; }
  .price { font-size: 24px; font-weight: bold; color: #059669; }
  .specs { display: flex; gap: 16px; color: #6b7280; font-size: 14px; margin: 8px 0; }
  .cta { background: #0e8fe9; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 16px 0; }
  .footer { color: #9ca3af; font-size: 12px; padding: 16px; text-align: center; }
</style></head>
<body>
  <div class="header">
    <h2 style="margin:0">Hi ${contact.firstName}! I found a property you'll love 🏡</h2>
  </div>
  <div style="padding: 24px;">
    <p>Based on your search activity, I think this property is a great match for what you're looking for:</p>

    <div class="property-card">
      ${property.images && JSON.parse(property.images)[0] ? `<img class="property-img" src="${JSON.parse(property.images)[0]}" alt="Property" />` : ""}
      <div class="property-info">
        <div class="price">$${property.price.toLocaleString()}</div>
        <h3 style="margin: 4px 0">${property.address}</h3>
        <p style="color: #6b7280; margin: 4px 0">${property.city}, ${property.state} ${property.zip}</p>
        <div class="specs">
          ${property.bedrooms ? `<span>🛏 ${property.bedrooms} beds</span>` : ""}
          ${property.bathrooms ? `<span>🚿 ${property.bathrooms} baths</span>` : ""}
          ${property.sqft ? `<span>📐 ${property.sqft.toLocaleString()} sqft</span>` : ""}
          ${property.yearBuilt ? `<span>🏗 Built ${property.yearBuilt}</span>` : ""}
        </div>
        ${property.description ? `<p style="color: #4b5563; font-size: 14px">${property.description.slice(0, 200)}...</p>` : ""}
      </div>
    </div>

    <p>Would you like to schedule a showing? I'd love to walk you through it personally.</p>
    <a href="mailto:${process.env.SMTP_USER || ""}" class="cta">Schedule a Showing</a>

    <p style="color: #6b7280; font-size: 14px;">Or give me a call anytime: <strong>${agentPhone}</strong></p>
  </div>
  <div class="footer">
    <p>${agentName} | Real Estate Agent<br/>
    Sent by your personal AI assistant</p>
  </div>
</body>
</html>`
}

export function buildWelcomeEmail(contact: { firstName: string }, agentName: string, agentPhone: string): string {
  return `
<!DOCTYPE html>
<html>
<head><style>
  body { font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; }
  .header { background: linear-gradient(135deg, #0e8fe9, #0359a1); color: white; padding: 32px; border-radius: 8px 8px 0 0; text-align: center; }
  .btn { background: #0e8fe9; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 12px 0; font-weight: bold; }
  .step { display: flex; align-items: flex-start; gap: 12px; margin: 16px 0; }
  .step-num { width: 32px; height: 32px; background: #0e8fe9; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: bold; }
</style></head>
<body>
  <div class="header">
    <h1 style="margin:0">Welcome, ${contact.firstName}! 🏡</h1>
    <p style="opacity:0.9;margin:8px 0 0">Your personal real estate search starts now</p>
  </div>
  <div style="padding: 24px;">
    <p>Hi ${contact.firstName},</p>
    <p>I'm ${agentName}, and I'm thrilled to help you find your perfect home! Here's what happens next:</p>

    <div class="step"><div class="step-num">1</div><div><strong>Browse properties</strong> — Search our live MLS listings, save your favorites, and I'll reach out with more matches.</div></div>
    <div class="step"><div class="step-num">2</div><div><strong>Get AI-curated matches</strong> — Our system learns your preferences and automatically surfaces the best properties.</div></div>
    <div class="step"><div class="step-num">3</div><div><strong>Schedule showings</strong> — When you find something you love, I'll arrange a private tour.</div></div>
    <div class="step"><div class="step-num">4</div><div><strong>Get expert guidance</strong> — From offer to close, I'm here every step of the way.</div></div>

    <div style="text-align:center;margin:24px 0">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/search" class="btn">Start Searching Properties →</a>
    </div>

    <p>Feel free to reach me anytime:</p>
    <p>📞 ${agentPhone}<br/>✉️ Just reply to this email</p>

    <p>Looking forward to helping you find your dream home!</p>
    <p>Warm regards,<br/><strong>${agentName}</strong></p>
  </div>
</body>
</html>`
}
