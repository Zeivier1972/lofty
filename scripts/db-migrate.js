// Runs idempotent ALTER TABLE statements using the Prisma client (not CLI).
// Avoids the wasm engine issue where prisma db push can't resolve DATABASE_URL.
const { PrismaClient } = require("@prisma/client")

const STMTS = [
  `CREATE TABLE IF NOT EXISTS "SocialAutoPilotConfig" (
    "id"        TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SocialAutoPilotConfig_pkey" PRIMARY KEY ("id")
  )`,
  // configurable bot buttons
  `ALTER TABLE "FacebookBotConfig" ADD COLUMN IF NOT EXISTS "greetingButtons" TEXT NOT NULL DEFAULT 'Sí, me interesa,Quiero más info'`,
  `ALTER TABLE "FacebookBotConfig" ADD COLUMN IF NOT EXISTS "intentButtonA" TEXT NOT NULL DEFAULT 'Comprar para vivir'`,
  `ALTER TABLE "FacebookBotConfig" ADD COLUMN IF NOT EXISTS "intentButtonB" TEXT NOT NULL DEFAULT 'Invertir / Airbnb'`,
  `ALTER TABLE "FacebookBotConfig" ADD COLUMN IF NOT EXISTS "intentButtonC" TEXT NOT NULL DEFAULT 'Solo explorando'`,
  `ALTER TABLE "InstagramBotConfig" ADD COLUMN IF NOT EXISTS "greetingButtons" TEXT NOT NULL DEFAULT 'Sí, me interesa,Quiero más info'`,
  `ALTER TABLE "InstagramBotConfig" ADD COLUMN IF NOT EXISTS "intentButtonA" TEXT NOT NULL DEFAULT 'Comprar para vivir'`,
  `ALTER TABLE "InstagramBotConfig" ADD COLUMN IF NOT EXISTS "intentButtonB" TEXT NOT NULL DEFAULT 'Invertir / Airbnb'`,
  `ALTER TABLE "InstagramBotConfig" ADD COLUMN IF NOT EXISTS "intentButtonC" TEXT NOT NULL DEFAULT 'Solo explorando'`,
  // multi-keyword campaigns
  `ALTER TABLE "FacebookBotCampaign" ADD COLUMN IF NOT EXISTS "keywords" TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE "InstagramBotCampaign" ADD COLUMN IF NOT EXISTS "keywords" TEXT NOT NULL DEFAULT ''`,
  // parallel dialer
  `ALTER TABLE "DialerSession" ADD COLUMN IF NOT EXISTS "activeCallSid" TEXT`,
  `ALTER TABLE "DialerSession" ADD COLUMN IF NOT EXISTS "agentIdentity" TEXT`,
  // YouTube OAuth refresh token
  `ALTER TABLE "SocialAccount" ADD COLUMN IF NOT EXISTS "refreshToken" TEXT`,
  // WhatsApp link, office address, website URL on website config
  `ALTER TABLE "WebsiteConfig" ADD COLUMN IF NOT EXISTS "whatsapp" TEXT`,
  `ALTER TABLE "WebsiteConfig" ADD COLUMN IF NOT EXISTS "agentAddress" TEXT`,
  `ALTER TABLE "WebsiteConfig" ADD COLUMN IF NOT EXISTS "agentWebsite" TEXT`,
  `ALTER TABLE "SocialPost" ADD COLUMN IF NOT EXISTS "errorMessage" TEXT`,
  // buyer match preference fields (migration 20260618000000)
  `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "buyerBathroomsMin" DOUBLE PRECISION`,
  `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "buyerMustHaves" TEXT`,
  `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "buyerTimelineMonths" INTEGER`,
  `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "buyerPurpose" TEXT`,
  `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "matchPrefsCompletedAt" TIMESTAMP(3)`,
  // property alert dedup table (migration 20260618010000)
  `CREATE TABLE IF NOT EXISTS "PropertyAlertSent" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropertyAlertSent_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "PropertyAlertSent_contactId_propertyId_key" ON "PropertyAlertSent"("contactId", "propertyId")`,
  // lead magnet guide system
  `CREATE TABLE IF NOT EXISTS "LeadMagnet" (
    "id"           TEXT NOT NULL,
    "keyword"      TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "description"  TEXT NOT NULL,
    "content"      TEXT NOT NULL,
    "scriptSource" TEXT,
    "pdfUrl"       TEXT,
    "guideUrl"     TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadMagnet_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "LeadMagnet_keyword_key" ON "LeadMagnet"("keyword")`,
  `CREATE TABLE IF NOT EXISTS "LeadMagnetDelivery" (
    "id"          TEXT NOT NULL,
    "keyword"     TEXT NOT NULL,
    "channel"     TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactId"   TEXT,
    CONSTRAINT "LeadMagnetDelivery_pkey" PRIMARY KEY ("id")
  )`,
  `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "instagramIgsid" TEXT`,
  `ALTER TABLE "SocialAutoPilotConfig" ADD COLUMN IF NOT EXISTS "videoEnabled" BOOLEAN NOT NULL DEFAULT TRUE`,
  // Saved IDX searches (new-listing alerts)
  `CREATE TABLE IF NOT EXISTS "SavedSearch" (
    "id"              TEXT NOT NULL,
    "contactId"       TEXT NOT NULL,
    "label"           TEXT NOT NULL,
    "city"            TEXT,
    "zip"             TEXT,
    "minPrice"        DOUBLE PRECISION,
    "maxPrice"        DOUBLE PRECISION,
    "minBeds"         INTEGER,
    "minBaths"        DOUBLE PRECISION,
    "propertySubType" TEXT,
    "isActive"        BOOLEAN NOT NULL DEFAULT true,
    "lastNotifiedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "SavedSearch_contactId_idx" ON "SavedSearch"("contactId")`,
  // Realtor referral partners
  `CREATE TABLE IF NOT EXISTS "ReferralPartner" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "email"     TEXT,
    "phone"     TEXT,
    "brokerage" TEXT,
    "feePct"    DOUBLE PRECISION,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "notes"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralPartner_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "LeadReferral" (
    "id"        TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "status"    TEXT NOT NULL DEFAULT 'SENT',
    "notes"     TEXT,
    "sentAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadReferral_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "LeadReferral_contactId_idx" ON "LeadReferral"("contactId")`,
  `CREATE INDEX IF NOT EXISTS "LeadReferral_partnerId_idx" ON "LeadReferral"("partnerId")`,
  // Partner portal access + activity trail
  `ALTER TABLE "ReferralPartner" ADD COLUMN IF NOT EXISTS "token" TEXT`,
  `ALTER TABLE "ReferralPartner" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ReferralPartner_token_key" ON "ReferralPartner"("token")`,
  `CREATE TABLE IF NOT EXISTS "ReferralUpdate" (
    "id"         TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "author"     TEXT NOT NULL DEFAULT 'PARTNER',
    "kind"       TEXT NOT NULL DEFAULT 'NOTE',
    "body"       TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralUpdate_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "ReferralUpdate_referralId_idx" ON "ReferralUpdate"("referralId")`,
  // Inbox read tracking — existing messages start as read (clean slate), new ones unread
  `ALTER TABLE "SMSMessage" ADD COLUMN IF NOT EXISTS "isRead" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "SMSMessage" ALTER COLUMN "isRead" SET DEFAULT false`,
  `ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "isRead" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "WhatsAppMessage" ALTER COLUMN "isRead" SET DEFAULT false`,
  `ALTER TABLE "FacebookMessage" ADD COLUMN IF NOT EXISTS "isRead" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "FacebookMessage" ALTER COLUMN "isRead" SET DEFAULT false`,
  // PipelineStage.rotPercent lives only in the retro-edited init migration —
  // make sure DBs created before it have the column (stage create/read safety)
  `ALTER TABLE "PipelineStage" ADD COLUMN IF NOT EXISTS "rotPercent" DOUBLE PRECISION`,
]

// ─── Email templates ─────────────────────────────────────────────────────────

const emailPorQueFlорida = `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#fff;">
<div style="background:linear-gradient(135deg,#1E3A5F 0%,#2D5A8E 100%);padding:36px 30px;text-align:center;">
  <h1 style="color:#D4AF37;margin:0;font-size:26px;font-weight:700;letter-spacing:-0.5px;">Catherine Gomez Realtor</h1>
  <p style="color:#fff;margin:6px 0 0;font-size:13px;opacity:0.85;">Miami &bull; Orlando &bull; Florida</p>
</div>
<img src="https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?w=600&q=80" style="width:100%;height:220px;object-fit:cover;display:block;" alt="Miami Skyline"/>
<div style="padding:36px 30px;">
  <h2 style="color:#1E3A5F;font-size:20px;margin:0 0 14px;">¡Hola {first_name}! 👋</h2>
  <p style="color:#555;line-height:1.7;margin:0 0 18px;">Te preguntarás: <strong>¿Por qué tantos colombianos están comprando en Florida?</strong></p>
  <div style="background:#FEF3C7;border-left:4px solid #F59E0B;padding:14px 18px;margin:18px 0;border-radius:4px;">
    <p style="margin:0 0 8px;color:#92400E;font-weight:700;">¿Te identificas con alguno de estos?</p>
    <ul style="margin:0;color:#78350F;padding-left:18px;line-height:2;font-size:14px;">
      <li>Tu dinero pierde valor con la inflación y devaluación del peso</li>
      <li>Buscas una inversión segura fuera de Colombia</li>
      <li>Quieres generar ingresos pasivos en dólares</li>
      <li>No sabes si puedes comprar en USA sin ser ciudadano</li>
    </ul>
  </div>
  <p style="color:#555;line-height:1.7;margin:18px 0 14px;"><strong>Florida es la respuesta. Aquí te cuento por qué:</strong></p>
  <div style="background:#EFF6FF;padding:14px;border-radius:8px;border:1px solid #BFDBFE;margin-bottom:10px;">
    <p style="margin:0 0 4px;font-weight:700;color:#1E3A5F;">🏠 Propiedad + ingreso en USD</p>
    <p style="margin:0;color:#555;font-size:13px;line-height:1.6;">Miami ha valorizado un 60%+ en los últimos 5 años. Tu dinero trabaja para ti.</p>
  </div>
  <div style="background:#F0FFF4;padding:14px;border-radius:8px;border:1px solid #A7F3D0;margin-bottom:10px;">
    <p style="margin:0 0 4px;font-weight:700;color:#065F46;">🛡️ Protege tus ahorros del peso</p>
    <p style="margin:0;color:#555;font-size:13px;line-height:1.6;">Una propiedad en dólares es el mejor escudo contra la devaluación. Tu patrimonio en la moneda más fuerte del mundo.</p>
  </div>
  <div style="background:#FFF7F0;padding:14px;border-radius:8px;border:1px solid #FED7AA;margin-bottom:10px;">
    <p style="margin:0 0 4px;font-weight:700;color:#9A3412;">✈️ Sin green card, sin complicaciones</p>
    <p style="margin:0;color:#555;font-size:13px;line-height:1.6;">Solo necesitas tu pasaporte colombiano. Colombianos compran en Florida todos los días. Yo te guío paso a paso.</p>
  </div>
  <div style="text-align:center;margin:30px 0;">
    <a href="{calendly_url}" style="background:linear-gradient(135deg,#1E3A5F,#2D5A8E);color:#D4AF37;padding:15px 34px;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">📅 Agenda tu consulta gratuita</a>
    <p style="color:#888;font-size:11px;margin:10px 0 0;">Sin costo &bull; Sin compromiso &bull; En español</p>
  </div>
</div>
<div style="background:#1E3A5F;padding:22px 30px;text-align:center;">
  <p style="color:#D4AF37;margin:0 0 6px;font-weight:700;font-size:15px;">Catherine Gomez, Realtor</p>
  <p style="color:#fff;margin:0;font-size:12px;opacity:0.85;">📞 305.283.0872 &bull; 🌐 catherinegomezrealtor.com</p>
</div>
</div>`

const emailAirbnbOrlando = `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#fff;">
<div style="background:linear-gradient(135deg,#1E3A5F 0%,#2D5A8E 100%);padding:36px 30px;text-align:center;">
  <h1 style="color:#D4AF37;margin:0;font-size:26px;font-weight:700;">Catherine Gomez Realtor</h1>
  <p style="color:#fff;margin:6px 0 0;font-size:13px;opacity:0.85;">Miami &bull; Orlando &bull; Florida</p>
</div>
<img src="https://images.unsplash.com/photo-1574267432553-4b4628081c31?w=600&q=80" style="width:100%;height:220px;object-fit:cover;display:block;" alt="Orlando Florida"/>
<div style="padding:36px 30px;">
  <h2 style="color:#1E3A5F;font-size:20px;margin:0 0 14px;">{first_name}, ¿cuánto genera un Airbnb en Orlando? 🏡</h2>
  <p style="color:#555;line-height:1.7;margin:0 0 18px;">Orlando es el destino turístico #1 de USA con <strong>75 millones de visitantes al año</strong>. Eso se traduce en demanda constante — e ingresos para ti en dólares.</p>
  <div style="background:#F8FAFC;border-radius:10px;overflow:hidden;margin:20px 0;">
    <div style="background:#1E3A5F;padding:11px 18px;">
      <p style="color:#D4AF37;margin:0;font-weight:700;font-size:13px;">📊 INGRESOS ESTIMADOS AIRBNB — ORLANDO</p>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr style="background:#EFF6FF;">
        <td style="padding:12px 18px;color:#555;border-bottom:1px solid #E2E8F0;">Casa 3 habitaciones (cerca Disney)</td>
        <td style="padding:12px 18px;color:#1E3A5F;font-weight:700;text-align:right;border-bottom:1px solid #E2E8F0;">$2,500 – $4,000/mes</td>
      </tr>
      <tr>
        <td style="padding:12px 18px;color:#555;border-bottom:1px solid #E2E8F0;">Condo 2 habitaciones (zona turística)</td>
        <td style="padding:12px 18px;color:#1E3A5F;font-weight:700;text-align:right;border-bottom:1px solid #E2E8F0;">$1,500 – $2,500/mes</td>
      </tr>
      <tr style="background:#EFF6FF;">
        <td style="padding:12px 18px;color:#555;">Villa con piscina (zona premium)</td>
        <td style="padding:12px 18px;color:#1E3A5F;font-weight:700;text-align:right;">$4,000 – $7,000/mes</td>
      </tr>
    </table>
  </div>
  <p style="color:#555;line-height:1.7;margin:0 0 18px;">Y lo mejor: <strong>puedes manejarlo todo desde Colombia</strong>. Contratas una empresa local de administración y cobras en dólares sin mover un dedo.</p>
  <div style="margin:18px 0;">
    <p style="margin:0 0 10px;color:#555;font-size:13px;line-height:1.7;">🎢 <strong>75M+ turistas/año</strong> — demanda garantizada gracias a Disney, Universal y SeaWorld</p>
    <p style="margin:0 0 10px;color:#555;font-size:13px;line-height:1.7;">📈 <strong>Valorización constante</strong> — Orlando creció 45%+ en valor de propiedades en los últimos 4 años</p>
    <p style="margin:0;color:#555;font-size:13px;line-height:1.7;">🌍 <strong>Gestión remota</strong> — empresas locales manejan todo, tú recibes el dinero</p>
  </div>
  <div style="text-align:center;margin:30px 0;">
    <a href="{calendly_url}" style="background:linear-gradient(135deg,#1E3A5F,#2D5A8E);color:#D4AF37;padding:15px 34px;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">🎯 Ver propiedades en Orlando</a>
    <p style="color:#888;font-size:11px;margin:10px 0 0;">Llamada de 15 min &bull; Sin costo &bull; En español</p>
  </div>
</div>
<div style="background:#1E3A5F;padding:22px 30px;text-align:center;">
  <p style="color:#D4AF37;margin:0 0 6px;font-weight:700;font-size:15px;">Catherine Gomez, Realtor</p>
  <p style="color:#fff;margin:0;font-size:12px;opacity:0.85;">📞 305.283.0872 &bull; 🌐 catherinegomezrealtor.com</p>
</div>
</div>`

const emailPasoAPaso = `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#fff;">
<div style="background:linear-gradient(135deg,#1E3A5F 0%,#2D5A8E 100%);padding:36px 30px;text-align:center;">
  <h1 style="color:#D4AF37;margin:0;font-size:26px;font-weight:700;">Catherine Gomez Realtor</h1>
  <p style="color:#fff;margin:6px 0 0;font-size:13px;opacity:0.85;">Miami &bull; Orlando &bull; Florida</p>
</div>
<img src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&q=80" style="width:100%;height:200px;object-fit:cover;display:block;" alt="Keys to your new home"/>
<div style="padding:36px 30px;">
  <h2 style="color:#1E3A5F;font-size:20px;margin:0 0 6px;">Guía completa: cómo un colombiano compra en USA 🏡</h2>
  <p style="color:#777;font-size:13px;margin:0 0 22px;">Es más simple de lo que imaginas, {first_name}.</p>
  <div style="counter-reset:step;">
    <div style="display:flex;gap:14px;margin-bottom:16px;align-items:flex-start;">
      <div style="min-width:32px;height:32px;background:#1E3A5F;color:#D4AF37;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;">1</div>
      <div>
        <p style="margin:0 0 4px;font-weight:700;color:#1E3A5F;font-size:14px;">Consulta inicial gratuita con Catherine</p>
        <p style="margin:0;color:#666;font-size:13px;line-height:1.6;">Definimos tu presupuesto, zona (Miami u Orlando) y tipo de inversión. Todo en español, sin costo.</p>
      </div>
    </div>
    <div style="display:flex;gap:14px;margin-bottom:16px;align-items:flex-start;">
      <div style="min-width:32px;height:32px;background:#1E3A5F;color:#D4AF37;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;">2</div>
      <div>
        <p style="margin:0 0 4px;font-weight:700;color:#1E3A5F;font-size:14px;">Pre-aprobación hipotecaria (si aplica)</p>
        <p style="margin:0;color:#666;font-size:13px;line-height:1.6;">Colombianos SÍ pueden obtener hipoteca en USA con pasaporte y extractos bancarios. Te conecto con prestamistas de confianza que hablan español.</p>
      </div>
    </div>
    <div style="display:flex;gap:14px;margin-bottom:16px;align-items:flex-start;">
      <div style="min-width:32px;height:32px;background:#1E3A5F;color:#D4AF37;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;">3</div>
      <div>
        <p style="margin:0 0 4px;font-weight:700;color:#1E3A5F;font-size:14px;">Selección y oferta de la propiedad</p>
        <p style="margin:0;color:#666;font-size:13px;line-height:1.6;">Te presento opciones que van con tu meta. Puedes verlas en video tour desde Colombia. Hacemos la oferta juntos.</p>
      </div>
    </div>
    <div style="display:flex;gap:14px;margin-bottom:16px;align-items:flex-start;">
      <div style="min-width:32px;height:32px;background:#1E3A5F;color:#D4AF37;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;">4</div>
      <div>
        <p style="margin:0 0 4px;font-weight:700;color:#1E3A5F;font-size:14px;">Inspección y cierre</p>
        <p style="margin:0;color:#666;font-size:13px;line-height:1.6;">Inspeccionamos la propiedad. El cierre puede hacerse firmando documentos online o con poder notarial desde Colombia.</p>
      </div>
    </div>
    <div style="display:flex;gap:14px;align-items:flex-start;">
      <div style="min-width:32px;height:32px;background:#D4AF37;color:#1E3A5F;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;">✓</div>
      <div>
        <p style="margin:0 0 4px;font-weight:700;color:#D4AF37;font-size:14px;">¡Eres propietario en USA! 🎉</p>
        <p style="margin:0;color:#666;font-size:13px;line-height:1.6;">En promedio el proceso toma 45-60 días. Puedes empezar a generar ingresos inmediatamente.</p>
      </div>
    </div>
  </div>
  <div style="background:#F0FFF4;border:1px solid #A7F3D0;border-radius:8px;padding:16px;margin:22px 0;">
    <p style="margin:0 0 8px;font-weight:700;color:#065F46;font-size:13px;">📄 Documentos que necesitas (desde Colombia)</p>
    <p style="margin:0;color:#555;font-size:13px;line-height:1.9;">✅ Pasaporte colombiano vigente &nbsp; ✅ Extractos bancarios (últimos 6 meses)<br>✅ Declaración de renta &nbsp; ✅ Carta laboral o prueba de ingresos</p>
  </div>
  <div style="text-align:center;margin:28px 0;">
    <a href="{calendly_url}" style="background:linear-gradient(135deg,#1E3A5F,#2D5A8E);color:#D4AF37;padding:15px 34px;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">🚀 Empecemos juntos — Es gratis</a>
    <p style="color:#888;font-size:11px;margin:10px 0 0;">catherinegomezrealtor.com &bull; 305.283.0872</p>
  </div>
</div>
<div style="background:#1E3A5F;padding:22px 30px;text-align:center;">
  <p style="color:#D4AF37;margin:0 0 6px;font-weight:700;font-size:15px;">Catherine Gomez, Realtor</p>
  <p style="color:#fff;margin:0;font-size:12px;opacity:0.85;">📞 305.283.0872 &bull; 🌐 catherinegomezrealtor.com</p>
</div>
</div>`

const emailConsultaGratuita = `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#fff;">
<div style="background:linear-gradient(135deg,#1E3A5F 0%,#2D5A8E 100%);padding:36px 30px;text-align:center;">
  <h1 style="color:#D4AF37;margin:0;font-size:26px;font-weight:700;">Catherine Gomez Realtor</h1>
  <p style="color:#fff;margin:6px 0 0;font-size:13px;opacity:0.85;">Miami &bull; Orlando &bull; Florida</p>
</div>
<div style="background:#D4AF37;padding:14px 30px;text-align:center;">
  <p style="margin:0;color:#1E3A5F;font-weight:700;font-size:14px;">🎁 OFERTA EXCLUSIVA PARA INVERSIONISTAS COLOMBIANOS</p>
</div>
<img src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&q=80" style="width:100%;height:200px;object-fit:cover;display:block;" alt="Miami Investment"/>
<div style="padding:36px 30px;">
  <h2 style="color:#1E3A5F;font-size:20px;margin:0 0 10px;">{first_name}, tu consulta gratuita con Catherine te espera 🏆</h2>
  <p style="color:#555;line-height:1.7;margin:0 0 22px;">Hemos compartido mucha información contigo estas semanas. Ahora llega el momento de convertir ese conocimiento en acción real.</p>
  <div style="background:#1E3A5F;border-radius:10px;padding:20px 22px;margin:20px 0;">
    <p style="color:#D4AF37;font-weight:700;margin:0 0 12px;font-size:14px;">En tu consulta de 30 min vas a:</p>
    <p style="color:#fff;font-size:13px;line-height:2;margin:0;">✅ Definir tu presupuesto real en dólares<br>✅ Elegir entre Miami u Orlando según tus metas<br>✅ Conocer propiedades disponibles HOY<br>✅ Entender el proceso de compra paso a paso<br>✅ Resolver TODAS tus dudas sobre comprar desde Colombia</p>
  </div>
  <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:14px 18px;margin:20px 0;">
    <p style="margin:0;color:#92400E;font-size:13px;line-height:1.7;"><strong>⚠️ El mercado de Florida sigue subiendo.</strong> Las propiedades que hoy cuestan $250,000 pueden valer $300,000 en 18 meses. Cada mes que esperas es dinero que dejas sobre la mesa.</p>
  </div>
  <div style="text-align:center;margin:30px 0;">
    <a href="{calendly_url}" style="background:#D4AF37;color:#1E3A5F;padding:18px 40px;border-radius:50px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block;letter-spacing:0.3px;">📅 AGENDA TU CONSULTA GRATUITA</a>
    <p style="color:#888;font-size:11px;margin:10px 0 0;">30 minutos &bull; En español &bull; Sin compromiso</p>
    <p style="color:#555;font-size:13px;margin:14px 0 0;">O llámame directamente: <strong style="color:#1E3A5F;">305.283.0872</strong></p>
  </div>
  <p style="color:#888;font-size:12px;text-align:center;line-height:1.6;">Catherine Gomez Realtor &bull; <a href="https://catherinegomezrealtor.com" style="color:#1E3A5F;">catherinegomezrealtor.com</a></p>
</div>
<div style="background:#1E3A5F;padding:22px 30px;text-align:center;">
  <p style="color:#D4AF37;margin:0 0 6px;font-weight:700;font-size:15px;">Catherine Gomez, Realtor</p>
  <p style="color:#fff;margin:0;font-size:12px;opacity:0.85;">📞 305.283.0872 &bull; 🌐 catherinegomezrealtor.com</p>
</div>
</div>`

// ─── First-Time Buyers smart plan seed ───────────────────────────────────────

async function seedFirstTimeBuyersPlan(db) {
  const exists = await db.smartPlan.findFirst({
    where: { name: "Compradores de Primera Vez — Guía Educativa" },
  })
  if (exists) {
    console.log("[db-migrate] First-Time Buyers plan already exists, skipping")
    return
  }

  await db.smartPlan.create({
    data: {
      name: "Compradores de Primera Vez — Guía Educativa",
      description: "Plan educativo de 30 días en español para compradores de primera vez. Guía paso a paso: crédito, pago inicial, pre-aprobación, búsqueda y cierre.",
      trigger: "NEW_LEAD",
      isActive: true,
      steps: {
        create: [
          {
            order: 0,
            type: "EMAIL",
            delay: 0,
            subject: "¡Bienvenido(a) a tu viaje hacia tu primera casa!",
            content: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
<div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);padding:36px 30px;text-align:center;">
  <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">Catherine Gomez Realtor</h1>
  <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:13px;">Tu asesora de bienes raíces en Miami</p>
</div>
<img src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&q=80" style="width:100%;height:200px;object-fit:cover;display:block;" alt="New Home"/>
<div style="padding:36px 30px;">
  <h2 style="color:#4F46E5;font-size:20px;margin:0 0 14px;">¡Hola {first_name}! 🏠</h2>
  <p style="color:#555;line-height:1.7;margin:0 0 14px;">¡Felicidades por dar el primer paso hacia tu hogar propio! Vamos a guiarte paso a paso en este emocionante proceso.</p>
  <div style="background:#EEF2FF;border-radius:8px;padding:18px;margin:18px 0;">
    <p style="margin:0 0 10px;font-weight:700;color:#4F46E5;">¿Qué aprenderás en las próximas semanas?</p>
    <p style="margin:0;color:#555;font-size:13px;line-height:2;">✅ Cómo mejorar tu crédito<br>✅ El proceso de pre-aprobación<br>✅ Cómo ahorrar para el pago inicial<br>✅ Qué buscar en una propiedad<br>✅ El proceso de cierre</p>
  </div>
  <div style="text-align:center;margin:28px 0;">
    <a href="{calendly_url}" style="background:#4F46E5;color:#fff;padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">📅 Agenda tu consulta gratuita</a>
    <p style="color:#888;font-size:11px;margin:8px 0 0;">Sin costo · Sin compromiso · En español</p>
  </div>
</div>
<div style="background:#4F46E5;padding:20px 30px;text-align:center;">
  <p style="color:#fff;margin:0 0 4px;font-weight:700;">Catherine Gomez, Realtor</p>
  <p style="color:rgba(255,255,255,0.8);margin:0;font-size:12px;">📞 {agent_phone} · catherinegomezrealtor.com</p>
</div>
</div>`,
          },
          {
            order: 1,
            type: "SMS",
            delay: 2,
            content: "Hola {first_name}! Soy Sofía, asistente de Catherine Gomez Realtor 🏠 ¿Sabías que puedes calificar para hasta $15,000 en asistencia para comprador de primera vez? Catherine te explica todo: {calendly_url}",
          },
          {
            order: 2,
            type: "EMAIL",
            delay: 5,
            subject: "Paso 1: Conoce tu puntaje de crédito 💳",
            content: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
<div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);padding:36px 30px;text-align:center;">
  <h1 style="color:#fff;margin:0;font-size:24px;">Catherine Gomez Realtor</h1>
</div>
<div style="padding:36px 30px;">
  <h2 style="color:#4F46E5;font-size:20px;margin:0 0 14px;">Tu Crédito es tu Poder 💳</h2>
  <p style="color:#555;line-height:1.7;margin:0 0 14px;">Hola {first_name}, el primer paso para comprar una casa es conocer tu puntaje de crédito.</p>
  <div style="background:#F8FAFC;border-radius:8px;padding:18px;margin:18px 0;border:1px solid #E2E8F0;">
    <p style="margin:0 0 8px;font-weight:700;color:#1E3A5F;">¿Qué necesitas saber?</p>
    <p style="margin:0;color:#555;font-size:13px;line-height:2;">📊 Puntaje de 620+ → préstamos convencionales<br>📊 Puntaje de 580+ → préstamos FHA (ideal para primera vez)<br>💡 Ve tu crédito gratis en AnnualCreditReport.com</p>
  </div>
  <p style="color:#555;line-height:1.7;">¿Tienes preguntas sobre tu crédito? Catherine puede conectarte con prestamistas de confianza que hablan español.</p>
  <div style="text-align:center;margin:24px 0;">
    <a href="{calendly_url}" style="background:#4F46E5;color:#fff;padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:700;display:inline-block;">Hablar con Catherine →</a>
  </div>
</div>
<div style="background:#4F46E5;padding:20px 30px;text-align:center;">
  <p style="color:#fff;margin:0 0 4px;font-weight:700;">Catherine Gomez, Realtor</p>
  <p style="color:rgba(255,255,255,0.8);margin:0;font-size:12px;">📞 {agent_phone} · catherinegomezrealtor.com</p>
</div>
</div>`,
          },
          {
            order: 3,
            type: "EMAIL",
            delay: 10,
            subject: "Paso 2: ¿Cuánto necesitas para el pago inicial? 💰",
            content: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
<div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);padding:36px 30px;text-align:center;">
  <h1 style="color:#fff;margin:0;font-size:24px;">Catherine Gomez Realtor</h1>
</div>
<div style="padding:36px 30px;">
  <h2 style="color:#4F46E5;font-size:20px;margin:0 0 14px;">El Pago Inicial — Más Fácil de lo que Crees 💰</h2>
  <p style="color:#555;line-height:1.7;margin:0 0 14px;">Hola {first_name}, uno de los mitos más comunes es que necesitas el 20% de pago inicial. ¡Hay opciones mucho más accesibles!</p>
  <div style="background:#F0FFF4;border:1px solid #A7F3D0;border-radius:8px;padding:18px;margin:18px 0;">
    <p style="margin:0;color:#555;font-size:13px;line-height:2;">🏦 <strong>FHA:</strong> Solo 3.5% de pago inicial<br>🏦 <strong>Convencional:</strong> Desde 3% para primera vez<br>🏦 <strong>VA:</strong> 0% si eres veterano o militar<br>🎁 <strong>Asistencia:</strong> Hasta $25,000 en algunos programas</p>
  </div>
  <p style="color:#555;line-height:1.7;">Catherine trabaja con prestamistas especializados en compradores de primera vez.</p>
  <div style="text-align:center;margin:24px 0;">
    <a href="{calendly_url}" style="background:#4F46E5;color:#fff;padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:700;display:inline-block;">📅 Agenda tu consulta gratuita</a>
  </div>
</div>
<div style="background:#4F46E5;padding:20px 30px;text-align:center;">
  <p style="color:#fff;margin:0 0 4px;font-weight:700;">Catherine Gomez, Realtor</p>
  <p style="color:rgba(255,255,255,0.8);margin:0;font-size:12px;">📞 {agent_phone} · catherinegomezrealtor.com</p>
</div>
</div>`,
          },
          {
            order: 4,
            type: "SMS",
            delay: 14,
            content: "Hola {first_name}! Ya tienes pre-aprobación? 🔑 Es el paso más importante. Catherine puede conectarte con prestamistas de confianza hoy — llámala: {agent_phone} o agenda: {calendly_url}",
          },
          {
            order: 5,
            type: "EMAIL",
            delay: 18,
            subject: "Paso 3: Pre-aprobación — Tu llave maestra 🔑",
            content: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
<div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);padding:36px 30px;text-align:center;">
  <h1 style="color:#fff;margin:0;font-size:24px;">Catherine Gomez Realtor</h1>
</div>
<div style="padding:36px 30px;">
  <h2 style="color:#4F46E5;font-size:20px;margin:0 0 14px;">La Pre-aprobación te da Poder de Negociación 🔑</h2>
  <p style="color:#555;line-height:1.7;margin:0 0 14px;">Hola {first_name}, tener una carta de pre-aprobación es como tener una llave maestra — los vendedores te toman más en serio y puedes negociar mejor.</p>
  <div style="background:#F8FAFC;border-radius:8px;padding:18px;margin:18px 0;border:1px solid #E2E8F0;">
    <p style="margin:0 0 8px;font-weight:700;color:#1E3A5F;">Documentos típicamente necesarios:</p>
    <p style="margin:0;color:#555;font-size:13px;line-height:2;">📄 Últimas 2 declaraciones de impuestos<br>📄 Últimos 2 meses de estados de cuenta<br>📄 Comprobantes de ingreso (últimas 2 quincenas)<br>📄 Identificación oficial</p>
  </div>
  <div style="text-align:center;margin:24px 0;">
    <a href="{calendly_url}" style="background:#4F46E5;color:#fff;padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:700;display:inline-block;">🚀 Agenda tu cita hoy — Es gratis</a>
  </div>
</div>
<div style="background:#4F46E5;padding:20px 30px;text-align:center;">
  <p style="color:#fff;margin:0 0 4px;font-weight:700;">Catherine Gomez, Realtor</p>
  <p style="color:rgba(255,255,255,0.8);margin:0;font-size:12px;">📞 {agent_phone} · catherinegomezrealtor.com</p>
</div>
</div>`,
          },
          {
            order: 6,
            type: "TASK",
            delay: 21,
            taskType: "CALL",
            taskTitle: "Llamar a {first_name} — Revisión de Pre-calificación",
            content: "Verificar si el cliente ha revisado su crédito y tiene preguntas sobre el pago inicial. Ofrecer conectar con prestamistas de confianza.",
          },
          {
            order: 7,
            type: "EMAIL",
            delay: 25,
            subject: "Paso 4: Encontrando tu hogar ideal en Miami 🏡",
            content: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
<div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);padding:36px 30px;text-align:center;">
  <h1 style="color:#fff;margin:0;font-size:24px;">Catherine Gomez Realtor</h1>
</div>
<img src="https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?w=600&q=80" style="width:100%;height:200px;object-fit:cover;display:block;" alt="Miami"/>
<div style="padding:36px 30px;">
  <h2 style="color:#4F46E5;font-size:20px;margin:0 0 14px;">¿Qué buscar en tu primera casa? 🏡</h2>
  <p style="color:#555;line-height:1.7;margin:0 0 14px;">Hola {first_name}, ahora viene la parte emocionante — ¡buscar tu hogar! Aquí lo que Catherine recomienda considerar:</p>
  <div style="background:#F8FAFC;border-radius:8px;padding:18px;margin:18px 0;border:1px solid #E2E8F0;">
    <p style="margin:0;color:#555;font-size:13px;line-height:2.2;">📍 <strong>Ubicación:</strong> Escuelas, transporte, seguridad<br>🏠 <strong>Estado:</strong> ¿Qué tan nuevo es el techo y los sistemas?<br>💹 <strong>Valor de reventa:</strong> ¿El vecindario está en crecimiento?<br>📐 <strong>Espacio:</strong> ¿Tiene cuartos suficientes para tu familia?</p>
  </div>
  <div style="text-align:center;margin:24px 0;">
    <a href="{calendly_url}" style="background:#4F46E5;color:#fff;padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:700;display:inline-block;">🔍 Iniciar búsqueda con Catherine</a>
  </div>
</div>
<div style="background:#4F46E5;padding:20px 30px;text-align:center;">
  <p style="color:#fff;margin:0 0 4px;font-weight:700;">Catherine Gomez, Realtor</p>
  <p style="color:rgba(255,255,255,0.8);margin:0;font-size:12px;">📞 {agent_phone} · catherinegomezrealtor.com</p>
</div>
</div>`,
          },
          {
            order: 8,
            type: "SMS",
            delay: 28,
            content: "Hola {first_name}! ¿Listo para ver propiedades? 🏠 Catherine tiene acceso a listings exclusivos en Miami que no están en Zillow. Agenda aquí: {calendly_url} · {agent_phone}",
          },
          {
            order: 9,
            type: "EMAIL",
            delay: 30,
            subject: "¡El paso final — hacer una oferta! 🎉",
            content: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
<div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);padding:36px 30px;text-align:center;">
  <h1 style="color:#fff;margin:0;font-size:24px;">Catherine Gomez Realtor</h1>
</div>
<div style="padding:36px 30px;">
  <h2 style="color:#4F46E5;font-size:20px;margin:0 0 14px;">¡El Paso Final — Hacer una Oferta! 🎉</h2>
  <p style="color:#555;line-height:1.7;margin:0 0 14px;">Hola {first_name}, cuando encuentres la propiedad perfecta, Catherine te guiará para hacer una oferta competitiva.</p>
  <div style="background:#F8FAFC;border-radius:8px;padding:18px;margin:18px 0;border:1px solid #E2E8F0;">
    <p style="margin:0;color:#555;font-size:13px;line-height:2.2;">✍️ <strong>La oferta:</strong> Catherine negocia en tu nombre<br>🔍 <strong>Inspección:</strong> Un inspector revisa la propiedad<br>🏦 <strong>Tasación:</strong> El banco confirma el valor<br>📝 <strong>Cierre:</strong> ¡Firmas y recibes las llaves!</p>
  </div>
  <p style="color:#555;line-height:1.7;">Los costos de cierre típicamente son del 2-5% del precio. Catherine te explicará cada detalle.</p>
  <div style="text-align:center;margin:28px 0;">
    <a href="{calendly_url}" style="background:#4F46E5;color:#fff;padding:15px 36px;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">📅 Agenda tu cita con Catherine — Es gratis</a>
  </div>
</div>
<div style="background:#4F46E5;padding:20px 30px;text-align:center;">
  <p style="color:#fff;margin:0 0 4px;font-weight:700;">Catherine Gomez, Realtor</p>
  <p style="color:rgba(255,255,255,0.8);margin:0;font-size:12px;">📞 {agent_phone} · catherinegomezrealtor.com</p>
</div>
</div>`,
          },
        ],
      },
    },
  })
  console.log("[db-migrate] First-Time Buyers smart plan created (10 steps, 30 days)")
}

// ─── Colombia investor smart plan seed ───────────────────────────────────────

async function seedColombiaPlan(db) {
  // Upsert the primary UTM campaign tag (matches Facebook tracking parameter utm_campaign)
  const tag = await db.tag.upsert({
    where: { name: "Inversionista Bogota" },
    update: {},
    create: { name: "Inversionista Bogota", color: "#10B981" },
  })
  // Keep legacy tag for backwards compatibility
  await db.tag.upsert({
    where: { name: "Investor_colombia" },
    update: {},
    create: { name: "Investor_colombia", color: "#10B981" },
  })

  const exists = await db.smartPlan.findFirst({
    where: { name: "Invierte en Florida desde Colombia" },
  })
  if (exists) {
    // Update trigger to use the UTM-based tag if it's still pointing to the old tag or MANUAL
    const expectedTrigger = `CONTACT_TAGGED:${tag.id}`
    if (exists.trigger === "MANUAL" || !exists.trigger.includes(tag.id)) {
      await db.smartPlan.update({
        where: { id: exists.id },
        data: { trigger: expectedTrigger },
      })
      console.log("[db-migrate] Colombia plan trigger updated to Inversionista Bogota tag")
    }
    return
  }

  await db.smartPlan.create({
    data: {
      name: "Invierte en Florida desde Colombia",
      description: "Secuencia educativa en español para inversionistas colombianos — WhatsApp prioritario + Emails con diseño (28 días, 11 pasos)",
      trigger: `CONTACT_TAGGED:${tag.id}`,
      isActive: true,
      steps: {
        create: [
          {
            order: 0,
            type: "WHATSAPP",
            delay: 0,
            content: "¡Hola {first_name}! 🌴 Soy Catherine Gomez, Realtor en Miami, FL.\n\nVi tu interés en invertir en Florida — ¡estás tomando una decisión inteligente! Esta semana te voy a compartir información clave que muchos colombianos no conocen. 🏠💰",
          },
          {
            order: 1,
            type: "EMAIL",
            delay: 1,
            subject: "{first_name}, ¿por qué los colombianos más inteligentes invierten en Florida? 🌴",
            content: emailPorQueFlорida,
          },
          {
            order: 2,
            type: "WHATSAPP",
            delay: 2,
            content: "💸 {first_name}, el peso colombiano ha perdido más del 40% de su valor frente al dólar en los últimos años.\n\nUna propiedad en Florida = tus ahorros protegidos en USD, ganando valor cada año. 📈\n\ncatherinegomezrealtor.com",
          },
          {
            order: 3,
            type: "WHATSAPP",
            delay: 2,
            content: "🌴 Miami: más de 100,000 colombianos ya viven, trabajan e invierten aquí.\n\nCiudad segura, bilingüe y con el mercado inmobiliario más fuerte de USA. Compra, alquila y gana en dólares.\n\n¿Te cuento más? 305.283.0872",
          },
          {
            order: 4,
            type: "EMAIL",
            delay: 2,
            subject: "💰 {first_name}: ¿cuánto genera un Airbnb en Orlando?",
            content: emailAirbnbOrlando,
          },
          {
            order: 5,
            type: "WHATSAPP",
            delay: 2,
            content: "🤔 \"Pero yo no soy ciudadano americano...\"\n\n✅ No se necesita green card\n✅ Solo tu pasaporte colombiano\n✅ Puedes obtener hipoteca en USA\n\nColombianos compran en Florida todos los días. Yo te guío paso a paso. 👇\n\n{calendly_url}",
          },
          {
            order: 6,
            type: "WHATSAPP",
            delay: 2,
            content: "💰 Florida NO tiene impuesto estatal sobre la renta.\n\nMás rentabilidad para tu inversión vs. Nueva York, California u otros estados. 🌟\n\nPropiedades desde $180K en Orlando. catherinegomezrealtor.com",
          },
          {
            order: 7,
            type: "EMAIL",
            delay: 3,
            subject: "🏡 {first_name}: guía completa para comprar en USA desde Colombia",
            content: emailPasoAPaso,
          },
          {
            order: 8,
            type: "WHATSAPP",
            delay: 3,
            content: "🏙️ ¿Miami o Orlando?\n\nMiami → Valorización alta, lujo, Brickell, vida cosmopolita\nOrlando → Airbnb rentable, $2,500-$4,000/mes, turismo todo el año\n\nLas dos son ganadoras. ¿Cuál va con tus metas?\n\n{calendly_url}",
          },
          {
            order: 9,
            type: "EMAIL",
            delay: 4,
            subject: "🎁 {first_name}, tu consulta gratuita con Catherine te espera",
            content: emailConsultaGratuita,
          },
          {
            order: 10,
            type: "WHATSAPP",
            delay: 6,
            content: "⏰ {first_name}, este es mi último mensaje.\n\nEl mercado de Florida sigue subiendo y las mejores propiedades se van rápido. Una llamada de 15 min puede cambiar tu futuro financiero.\n\n¿La hacemos?\n\n{calendly_url}\n📞 305.283.0872",
          },
        ],
      },
    },
  })
  console.log("[db-migrate] Colombia investor smart plan created (11 steps, 28 days)")
}

// ─── Booking URL seed ─────────────────────────────────────────────────────────

async function seedBookingUrl(db) {
  // Clear the self-referencing URL that caused an infinite redirect loop
  const config = await db.aIConfig.findFirst()
  if (config && config.calendlyUrl && config.calendlyUrl.includes("/book")) {
    await db.aIConfig.update({
      where: { id: config.id },
      data: { calendlyUrl: null },
    })
    console.log("[db-migrate] Cleared bad self-referencing calendlyUrl")
  }
}

// ─── AIConfig fix: remove stale "Alex" prompt ────────────────────────────────

async function seedAIConfig(db) {
  const config = await db.aIConfig.findFirst()
  if (!config) return

  const needsFix = (config.systemPrompt && config.systemPrompt.includes("Alex")) ||
                   !config.agentName || config.agentName === "Alex"

  if (needsFix) {
    await db.aIConfig.update({
      where: { id: config.id },
      data: {
        systemPrompt: null,
        agentName: config.agentName === "Alex" || !config.agentName ? "Sofia" : config.agentName,
        realtorName: !config.realtorName || config.realtorName === "Alex" ? "Catherine" : config.realtorName,
      },
    })
    console.log("[db-migrate] AIConfig prompt fixed (removed Alex reference)")
  }
}

// ─── Re-ignite Drip: South Florida Pre-Construction (unresponsive local leads) ─

const BOOK_URL = "https://lofty-production.up.railway.app/book"
const AGENT_PHONE = "305-283-0872"
const AGENT_NAME = "Catherine Gomez"

const emailReIgniteDay3 = `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#fff;">
<div style="background:linear-gradient(135deg,#0F2744 0%,#1a3a5c 100%);padding:36px 30px;text-align:center;">
  <p style="color:#C9A84C;font-size:13px;font-weight:700;letter-spacing:2px;margin:0 0 8px;">ALERTA DE MERCADO — SUR DE FLORIDA</p>
  <h1 style="color:#fff;font-size:26px;font-weight:800;margin:0;line-height:1.3;">Los precios de casas en Miami<br>acaban de romper otro récord.</h1>
</div>
<div style="padding:32px 30px;">
  <p style="color:#333;line-height:1.8;font-size:15px;">Hola {first_name},</p>
  <p style="color:#333;line-height:1.8;font-size:15px;">Sé que la vida se pone ocupada. Pero quería compartir algo que afecta directamente tu bolsillo.</p>
  <div style="background:#FFF8E7;border-left:4px solid #C9A84C;padding:16px 20px;margin:20px 0;border-radius:0 8px 8px 0;">
    <p style="color:#0F2744;font-weight:700;margin:0 0 8px;font-size:16px;">📈 Lo que pasó en el Sur de Florida en 2026:</p>
    <p style="color:#555;margin:0;line-height:1.8;">• Precio mediano subió <strong>11% año tras año</strong><br>
    • Alquileres en Miami-Dade subieron <strong>8%</strong> desde enero<br>
    • Inventario de preconstrucción bajó <strong>34%</strong> vs. el año pasado<br>
    • Incentivos de constructores disponibles — pero desapareciendo silenciosamente</p>
  </div>
  <p style="color:#333;line-height:1.8;font-size:15px;">¿La casa en la que pensabas hace 3 meses? Hoy cuesta más. Y en 3 meses costará aún más.</p>
  <p style="color:#333;line-height:1.8;font-size:15px;">La preconstrucción sigue siendo la <strong>mejor protección contra el aumento de precios</strong> en el Sur de Florida — aseguras el precio de hoy y pagas mientras el edificio se construye.</p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${BOOK_URL}" style="background:#C9A84C;color:#fff;padding:15px 36px;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">📅 Hablemos — Llamada gratis de 15 min</a>
  </div>
  <p style="color:#555;line-height:1.8;font-size:14px;">Sin presión, sin compromiso. Solo una conversación sobre lo que hay disponible en tu presupuesto ahora.</p>
</div>
<div style="background:#0F2744;padding:20px 30px;text-align:center;">
  <p style="color:#fff;margin:0 0 4px;font-weight:700;">${AGENT_NAME}, Realtor</p>
  <p style="color:rgba(255,255,255,0.7);margin:0;font-size:12px;">📞 ${AGENT_PHONE} · catherinegomezrealtor.com</p>
</div>
</div>`

const emailReIgniteDay10 = `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#fff;">
<div style="background:linear-gradient(135deg,#0F2744 0%,#1a3a5c 100%);padding:36px 30px;text-align:center;">
  <p style="color:#C9A84C;font-size:13px;font-weight:700;letter-spacing:2px;margin:0 0 8px;">PRECONSTRUCCIÓN VS. REVENTA</p>
  <h1 style="color:#fff;font-size:26px;font-weight:800;margin:0;line-height:1.3;">Qué compras con $500K en<br>el Sur de Florida ahora mismo</h1>
</div>
<div style="padding:32px 30px;">
  <p style="color:#333;line-height:1.8;font-size:15px;">Hola {first_name},</p>
  <p style="color:#333;line-height:1.8;font-size:15px;">Déjame mostrarte algo de lo que nadie habla cuando dicen "compra reventa."</p>
  <div style="display:grid;gap:16px;margin:24px 0;">
    <div style="background:#FFF8E7;border-radius:12px;padding:20px;">
      <p style="color:#C9A84C;font-weight:800;font-size:14px;margin:0 0 12px;text-transform:uppercase;">🏚️ $500K Reventa en el Sur de Florida</p>
      <p style="color:#555;margin:0;line-height:2;">• Construida en 1998 — sistemas envejecidos<br>• HOA: $800–$1,200/mes<br>• Sorpresas de inspección garantizadas<br>• Sin garantía del constructor<br>• Compitiendo con 12 otras ofertas<br>• Lo que ves es lo que obtienes</p>
    </div>
    <div style="background:#E8F5E9;border-radius:12px;padding:20px;">
      <p style="color:#2E7D32;font-weight:800;font-size:14px;margin:0 0 12px;text-transform:uppercase;">✅ $500K Preconstrucción en el Sur de Florida</p>
      <p style="color:#555;margin:0;line-height:2;">• Completamente nueva — garantía del constructor 10 años<br>• Acabados modernos, tecnología smart home<br>• Asegura precios de 2026, cierra en 2027-28<br>• Incentivos: costos de cierre cubiertos, mejoras gratis<br>• Sin guerras de ofertas — tú eliges tu unidad<br>• Apreciación incorporada antes de que cierres</p>
    </div>
  </div>
  <p style="color:#333;line-height:1.8;font-size:15px;">La matemática es simple. La ventana no estará abierta para siempre.</p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${BOOK_URL}" style="background:#C9A84C;color:#fff;padding:15px 36px;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">Ver unidades de preconstrucción disponibles →</a>
  </div>
</div>
<div style="background:#0F2744;padding:20px 30px;text-align:center;">
  <p style="color:#fff;margin:0 0 4px;font-weight:700;">${AGENT_NAME}, Realtor</p>
  <p style="color:rgba(255,255,255,0.7);margin:0;font-size:12px;">📞 ${AGENT_PHONE} · catherinegomezrealtor.com</p>
</div>
</div>`

const emailReIgniteDay20 = `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#fff;">
<div style="background:linear-gradient(135deg,#0F2744 0%,#1a3a5c 100%);padding:36px 30px;text-align:center;">
  <p style="color:#C9A84C;font-size:13px;font-weight:700;letter-spacing:2px;margin:0 0 8px;">REPORTE DE MERCADO — SUR DE FLORIDA</p>
  <h1 style="color:#fff;font-size:26px;font-weight:800;margin:0;line-height:1.3;">Tu panorama mensual:<br>lo que realmente está pasando</h1>
</div>
<div style="padding:32px 30px;">
  <p style="color:#333;line-height:1.8;font-size:15px;">Hola {first_name},</p>
  <p style="color:#333;line-height:1.8;font-size:15px;">Aquí tu actualización del mercado del Sur de Florida — directo al grano, sin adornos.</p>
  <div style="background:#F8FAFC;border-radius:12px;padding:24px;margin:20px 0;">
    <p style="color:#0F2744;font-weight:800;font-size:16px;margin:0 0 16px;">📊 En Números — Q2 2026</p>
    <div style="display:grid;gap:12px;">
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #E2E8F0;">
        <span style="color:#555;">Precio mediano de venta (Miami-Dade)</span><span style="color:#0F2744;font-weight:700;">$645,000</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #E2E8F0;">
        <span style="color:#555;">Días en mercado (reventa)</span><span style="color:#0F2744;font-weight:700;">28 días</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #E2E8F0;">
        <span style="color:#555;">Unidades de preconstrucción disponibles</span><span style="color:#C9A84C;font-weight:700;">↓ 34% vs. año pasado</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0;">
        <span style="color:#555;">Aumento promedio de alquiler (Miami)</span><span style="color:#E53E3E;font-weight:700;">+8.2% anual</span>
      </div>
    </div>
  </div>
  <p style="color:#333;line-height:1.8;font-size:15px;"><strong>Conclusión:</strong> Los inquilinos pagan más. Los compradores de reventa compiten por menos casas. Los compradores de preconstrucción que se movieron temprano ven crecer su plusvalía antes de cerrar.</p>
  <p style="color:#333;line-height:1.8;font-size:15px;">¿De qué lado de esa ecuación quieres estar?</p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${BOOK_URL}" style="background:#C9A84C;color:#fff;padding:15px 36px;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">📅 Obtén mi análisis de mercado gratis</a>
  </div>
</div>
<div style="background:#0F2744;padding:20px 30px;text-align:center;">
  <p style="color:#fff;margin:0 0 4px;font-weight:700;">${AGENT_NAME}, Realtor</p>
  <p style="color:rgba(255,255,255,0.7);margin:0;font-size:12px;">📞 ${AGENT_PHONE} · catherinegomezrealtor.com</p>
</div>
</div>`

const emailReIgniteDay42 = `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#fff;">
<div style="background:linear-gradient(135deg,#0F2744 0%,#1a3a5c 100%);padding:36px 30px;text-align:center;">
  <p style="color:#C9A84C;font-size:13px;font-weight:700;letter-spacing:2px;margin:0 0 8px;">UNA HISTORIA QUE VALE LA PENA LEER</p>
  <h1 style="color:#fff;font-size:26px;font-weight:800;margin:0;line-height:1.3;">"Esperé 6 meses.<br>Me costó $60,000."</h1>
</div>
<div style="padding:32px 30px;">
  <p style="color:#333;line-height:1.8;font-size:15px;">Hola {first_name},</p>
  <p style="color:#333;line-height:1.8;font-size:15px;">Quiero contarte la historia de una pareja con la que trabajé en Doral. Estaban listos para comprar preconstrucción a principios de 2025. Pensaron: <em>"Esperemos unos meses, a ver qué pasa con las tasas."</em></p>
  <p style="color:#333;line-height:1.8;font-size:15px;">Seis meses después regresaron. ¿La unidad que querían? <strong>Vendida.</strong> ¿La siguiente unidad disponible en el mismo edificio? <strong>$60,000 más cara.</strong></p>
  <div style="background:#FEF2F2;border-left:4px solid #E53E3E;padding:16px 20px;margin:20px 0;border-radius:0 8px 8px 0;">
    <p style="color:#C53030;font-weight:700;margin:0 0 8px;">Lo que les costó esperar:</p>
    <p style="color:#555;margin:0;line-height:1.8;">• $60,000 más por una unidad comparable<br>
    • 6 meses más de alquiler pagado ($12,000+)<br>
    • El piso y la vista que querían — desaparecidos<br>
    • Costo total de esperar: <strong>$72,000+</strong></p>
  </div>
  <p style="color:#333;line-height:1.8;font-size:15px;">Al final compraron — y aman su casa. Pero desearían haber actuado cuando estaban listos.</p>
  <p style="color:#333;line-height:1.8;font-size:15px;">No te cuento esto para presionarte. Te lo cuento porque lo he visto pasar demasiadas veces y genuinamente no quiero que te pase a ti.</p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${BOOK_URL}" style="background:#C9A84C;color:#fff;padding:15px 36px;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">Hablemos antes de que sea tarde →</a>
  </div>
</div>
<div style="background:#0F2744;padding:20px 30px;text-align:center;">
  <p style="color:#fff;margin:0 0 4px;font-weight:700;">${AGENT_NAME}, Realtor</p>
  <p style="color:rgba(255,255,255,0.7);margin:0;font-size:12px;">📞 ${AGENT_PHONE} · catherinegomezrealtor.com</p>
</div>
</div>`

const emailReIgniteDay60 = `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#fff;">
<div style="background:linear-gradient(135deg,#0F2744 0%,#1a3a5c 100%);padding:36px 30px;text-align:center;">
  <p style="color:#C9A84C;font-size:13px;font-weight:700;letter-spacing:2px;margin:0 0 8px;">ACTUALIZACIÓN MITAD DE AÑO — SUR DE FLORIDA</p>
  <h1 style="color:#fff;font-size:26px;font-weight:800;margin:0;line-height:1.3;">5 proyectos de preconstrucción<br>que se venden rápido en 2026</h1>
</div>
<div style="padding:32px 30px;">
  <p style="color:#333;line-height:1.8;font-size:15px;">Hola {first_name},</p>
  <p style="color:#333;line-height:1.8;font-size:15px;">Aquí las mejores oportunidades de preconstrucción en el Sur de Florida ahora mismo — antes de que todo esté reservado:</p>
  <div style="background:#F8FAFC;border-radius:12px;padding:20px;margin:20px 0;">
    <p style="color:#0F2744;font-weight:700;margin:0 0 12px;">🔥 Mercados de preconstrucción calientes en 2026:</p>
    <p style="color:#555;line-height:2;margin:0;">
      🏙️ <strong>Brickell</strong> — Condos de lujo, amigables para alquiler, depósito del 10%<br>
      🌴 <strong>Doral</strong> — Mejor valor para familias, escuelas A, apreciación rápida<br>
      🌊 <strong>Pompano Beach</strong> — Frente al mar a precios que Brickell no puede igualar<br>
      🏡 <strong>Miramar / Pembroke Pines</strong> — Unifamiliar, sin restricciones de HOA<br>
      ✈️ <strong>Hialeah Gardens</strong> — El mercado de crecimiento más rápido, menor precio de entrada
    </p>
  </div>
  <p style="color:#333;line-height:1.8;font-size:15px;">Cada uno tiene unidades disponibles <strong>ahora mismo</strong> — pero el inventario se mueve. Los incentivos del constructor (costos de cierre pagados, mejoras gratis) todavía disponibles pero no por mucho tiempo.</p>
  <p style="color:#333;line-height:1.8;font-size:15px;">Dime cuál área te interesa más y te mando las unidades exactas, planos y precios — sin obligación.</p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${BOOK_URL}" style="background:#C9A84C;color:#fff;padding:15px 36px;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">📍 Muéstrame qué hay disponible</a>
  </div>
</div>
<div style="background:#0F2744;padding:20px 30px;text-align:center;">
  <p style="color:#fff;margin:0 0 4px;font-weight:700;">${AGENT_NAME}, Realtor</p>
  <p style="color:rgba(255,255,255,0.7);margin:0;font-size:12px;">📞 ${AGENT_PHONE} · catherinegomezrealtor.com</p>
</div>
</div>`

const emailReIgniteDay80 = `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#fff;">
<div style="background:linear-gradient(135deg,#0F2744 0%,#1a3a5c 100%);padding:36px 30px;text-align:center;">
  <p style="color:#C9A84C;font-size:13px;font-weight:700;letter-spacing:2px;margin:0 0 8px;">OFERTA GRATUITA — SIN COMPROMISO</p>
  <h1 style="color:#fff;font-size:26px;font-weight:800;margin:0;line-height:1.3;">Conoce exactamente cuál es<br>tu poder de compra hoy.</h1>
</div>
<div style="padding:32px 30px;">
  <p style="color:#333;line-height:1.8;font-size:15px;">Hola {first_name},</p>
  <p style="color:#333;line-height:1.8;font-size:15px;">Quiero ofrecerte algo completamente gratis, sin ningún compromiso:</p>
  <div style="background:#E8F5E9;border-radius:12px;padding:24px;margin:20px 0;text-align:center;">
    <p style="color:#2E7D32;font-weight:800;font-size:18px;margin:0 0 8px;">🎁 Análisis de Mercado Personalizado Gratis</p>
    <p style="color:#555;margin:0;line-height:1.8;">Te mostraré exactamente:<br>
    • Qué puedes pagar en preconstrucción hoy<br>
    • Qué proyectos del Sur de Florida encajan con tu presupuesto<br>
    • Cómo se ve tu plusvalía proyectada al cierre<br>
    • Para qué incentivos del constructor calificas ahora mismo</p>
  </div>
  <p style="color:#333;line-height:1.8;font-size:15px;">Sin presión. Sin compromiso. Solo números reales para que puedas tomar una decisión real.</p>
  <p style="color:#333;line-height:1.8;font-size:15px;">Toma 15 minutos. Puede ahorrarte años de espera.</p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${BOOK_URL}" style="background:#C9A84C;color:#fff;padding:15px 36px;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">📅 Reclamar mi análisis gratis</a>
  </div>
</div>
<div style="background:#0F2744;padding:20px 30px;text-align:center;">
  <p style="color:#fff;margin:0 0 4px;font-weight:700;">${AGENT_NAME}, Realtor</p>
  <p style="color:rgba(255,255,255,0.7);margin:0;font-size:12px;">📞 ${AGENT_PHONE} · catherinegomezrealtor.com</p>
</div>
</div>`

const DRIP_STEPS_ES = [
  // DÍA 1 — SMS — El alquiler subió
  {
    order: 0, type: "SMS", delay: 0,
    content: "Hola {first_name} — Catherine Gomez aquí 🌴 Pregunta rápida: ¿tu renta subió otra vez este año? La mayoría de los inquilinos del Sur de Florida pagan 8–12% más que el año pasado. He ayudado a compradores locales a asegurar precios de preconstrucción antes de que suban más. ¿Quieres que te muestre qué hay disponible en tu presupuesto? Solo responde SÍ y te envío los detalles.",
  },
  // DÍA 3 — EMAIL — Récord de precios
  {
    order: 1, type: "EMAIL", delay: 3,
    subject: "{first_name}, los precios de casas en Miami acaban de romper otro récord — esto es lo que significa para ti",
    content: emailReIgniteDay3,
  },
  // DÍA 7 — WHATSAPP — El precio subió
  {
    order: 2, type: "WHATSAPP", delay: 7,
    content: "Hola {first_name} 👋 Te habla Catherine. Solo para avisarte — el precio de la unidad de preconstrucción que te comenté ha subido desde la última vez. Esto pasa cada trimestre a medida que avanza la obra. La buena noticia: todavía hay unidades al precio actual. ¿Quieres que te mande la lista actualizada? Responde SÍ y te la envío hoy. 🏠",
  },
  // DÍA 10 — EMAIL — Preconstrucción vs. reventa
  {
    order: 3, type: "EMAIL", delay: 10,
    subject: "Preconstrucción vs. reventa: qué compras con $500K en el Sur de Florida ahora mismo",
    content: emailReIgniteDay10,
  },
  // DÍA 14 — SMS — Alerta de incentivo
  {
    order: 4, type: "SMS", delay: 14,
    content: "🚨 Alerta de constructor, {first_name}: Varios proyectos de preconstrucción en el Sur de Florida siguen cubriendo los costos de cierre (hasta $15K) — pero por tiempo limitado. Una vez que se vendan las unidades, los incentivos desaparecen. Responde INFO y te mando la lista completa. — Catherine ${AGENT_PHONE}",
  },
  // DÍA 20 — EMAIL — Reporte mensual
  {
    order: 5, type: "EMAIL", delay: 20,
    subject: "Tu reporte del mercado del Sur de Florida — Q2 2026",
    content: emailReIgniteDay20,
  },
  // DÍA 25 — WHATSAPP — 5 proyectos
  {
    order: 6, type: "WHATSAPP", delay: 25,
    content: "¡Buenos días {first_name}! ☀️ Te habla Catherine. Los 5 proyectos de preconstrucción con mejor valor en el Sur de Florida ahora mismo:\n\n🏙️ Brickell — lujo, amigable para alquiler\n🌴 Doral — lo mejor para familias\n🌊 Pompano Beach — frente al mar a buen precio\n🏡 Miramar — unifamiliar, sin restricciones\n✈️ Hialeah Gardens — la apreciación más rápida\n\nTodos tienen unidades disponibles. ¿Cuál área encaja mejor con tu vida? Responde con el nombre y te mando planos + precios hoy.",
  },
  // DÍA 30 — EMAIL — Tasas y preconstrucción
  {
    order: 7, type: "EMAIL", delay: 30,
    subject: "Tasas, poder de compra y por qué la preconstrucción lo cambia todo",
    content: `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#fff;"><div style="background:linear-gradient(135deg,#0F2744 0%,#1a3a5c 100%);padding:36px 30px;text-align:center;"><p style="color:#C9A84C;font-size:13px;font-weight:700;letter-spacing:2px;margin:0 0 8px;">TASAS E INVERSIÓN — 2026</p><h1 style="color:#fff;font-size:26px;font-weight:800;margin:0;line-height:1.3;">Por qué los compradores de<br>preconstrucción no se estresan por las tasas</h1></div><div style="padding:32px 30px;"><p style="color:#333;line-height:1.8;font-size:15px;">Hola {first_name},</p><p style="color:#333;line-height:1.8;font-size:15px;">Todos están mirando las tasas hipotecarias. Pero lo que la mayoría no sabe: <strong>los compradores de preconstrucción no aseguran su tasa hoy.</strong></p><div style="background:#FFF8E7;border-left:4px solid #C9A84C;padding:16px 20px;margin:20px 0;border-radius:0 8px 8px 0;"><p style="color:#0F2744;font-weight:700;margin:0 0 8px;">Cómo la preconstrucción te protege de las tasas:</p><p style="color:#555;margin:0;line-height:1.8;">✅ Pagas el 10% de depósito hoy — eso es todo<br>✅ La construcción toma 18–36 meses<br>✅ Obtienes tu hipoteca al cierre — no ahora<br>✅ Si las tasas bajan, te beneficias<br>✅ Si los precios suben, tu plusvalía ya creció<br>✅ El constructor puede ofrecer reducción de tasas al cierre</p></div><p style="color:#333;line-height:1.8;font-size:15px;">Estás comprando tiempo — y bienes raíces del Sur de Florida — a los precios de hoy.</p><div style="text-align:center;margin:28px 0;"><a href="${BOOK_URL}" style="background:#C9A84C;color:#fff;padding:15px 36px;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">Calculemos tus números →</a></div></div><div style="background:#0F2744;padding:20px 30px;text-align:center;"><p style="color:#fff;margin:0 0 4px;font-weight:700;">${AGENT_NAME}, Realtor</p><p style="color:rgba(255,255,255,0.7);margin:0;font-size:12px;">📞 ${AGENT_PHONE} · catherinegomezrealtor.com</p></div></div>`,
  },
  // DÍA 35 — SMS — Pregunta sencilla
  {
    order: 8, type: "SMS", delay: 35,
    content: "Hola {first_name}, Catherine aquí 👋 ¿Todavía sueñas con tener tu propiedad en el Sur de Florida? Sin presión — solo responde SÍ y te mando algo que en verdad vas a querer ver. Son 2 segundos. ${AGENT_PHONE}",
  },
  // DÍA 42 — EMAIL — La historia del que esperó
  {
    order: 9, type: "EMAIL", delay: 42,
    subject: "\"Esperé 6 meses. Me costó $60,000.\" — Una historia real.",
    content: emailReIgniteDay42,
  },
  // DÍA 50 — WHATSAPP — "Encontré algo para ti"
  {
    order: 10, type: "WHATSAPP", delay: 50,
    content: "Hola {first_name} 👋 Catherine aquí. Estuve revisando nuevos listados esta mañana y encontré algo que de inmediato me hizo pensar en ti — una unidad de preconstrucción en el Sur de Florida que cumple muchos criterios a un precio que todavía tiene sentido.\n\n¿Quieres que te mande los detalles? Solo responde SÍ y te envío todo — plano, precio, ROI proyectado. Sin compromiso. 🏠",
  },
  // DÍA 60 — EMAIL — 5 proyectos de mitad de año
  {
    order: 11, type: "EMAIL", delay: 60,
    subject: "5 proyectos de preconstrucción que se venden rápido en el Sur de Florida — actualización mediados de 2026",
    content: emailReIgniteDay60,
  },
  // DÍA 70 — SMS — ¿Todavía piensas en comprar?
  {
    order: 12, type: "SMS", delay: 70,
    content: "Hola {first_name} — Catherine Gomez 🌴 ¿Todavía piensas en comprar en el Sur de Florida? El mercado no ha bajado. Pero puedo ayudarte a encontrar un punto de entrada que funcione con tu situación actual. Sin mínimos, sin presión. Solo responde y hablamos. ${AGENT_PHONE}",
  },
  // DÍA 80 — EMAIL — Análisis gratuito
  {
    order: 13, type: "EMAIL", delay: 80,
    subject: "Gratis: te muestro exactamente lo que puedes pagar en preconstrucción hoy",
    content: emailReIgniteDay80,
  },
  // DÍA 90 — WHATSAPP — Despedida cordial
  {
    order: 14, type: "WHATSAPP", delay: 90,
    content: "Hola {first_name}, Catherine aquí — último mensaje, te lo prometo. 🙏\n\nHe compartido mucho contigo estos meses porque de verdad creo que la preconstrucción en el Sur de Florida es una de las mejores decisiones que puedes tomar ahora mismo.\n\nSi ahora no es el momento — totalmente válido. La vida pasa.\n\nPero si algo cambia — las tasas, tu situación, tu ánimo — aquí estaré. Mi número está guardado: ${AGENT_PHONE}.\n\nTe deseo lo mejor. Y cuando estés listo, yo también lo estaré. 🌴🏠",
  },
]

async function seedReIgniteDrip(db) {
  const exists = await db.smartPlan.findFirst({
    where: { name: "Re-Ignite: South Florida Pre-Construction (Unresponsive)" },
  })

  if (exists) {
    // Update trigger to PIPELINE_STAGE and recreate steps in Spanish
    const needsUpdate = exists.trigger !== "PIPELINE_STAGE:Drip Campaign"
    if (!needsUpdate) {
      console.log("[db-migrate] Re-Ignite drip already up to date — skip")
      return
    }
    await db.smartPlanStep.deleteMany({ where: { planId: exists.id } })
    await db.smartPlan.update({
      where: { id: exists.id },
      data: {
        trigger: "PIPELINE_STAGE:Drip Campaign",
        description: "Secuencia de 90 días en español para compradores locales del Sur de Florida que no respondieron después de 4+ intentos. Mezcla de SMS, WhatsApp y email. Si responden → pipeline Warm + notificación a Catherine.",
        steps: { create: DRIP_STEPS_ES },
      },
    })
    console.log("[db-migrate] Re-Ignite drip updated: trigger=PIPELINE_STAGE:Drip Campaign + contenido en español")
    return
  }

  await db.smartPlan.create({
    data: {
      name: "Re-Ignite: South Florida Pre-Construction (Unresponsive)",
      description: "Secuencia de 90 días en español para compradores locales del Sur de Florida que no respondieron después de 4+ intentos. Mezcla de SMS, WhatsApp y email. Si responden → pipeline Warm + notificación a Catherine.",
      trigger: "PIPELINE_STAGE:Drip Campaign",
      isActive: true,
      steps: { create: DRIP_STEPS_ES },
    },
  })
  console.log("[db-migrate] Re-Ignite drip seeded (15 pasos, 90 días, español)")
}

// ─── Dedup PipelineLeads — keep only the most recently updated per contact ────

async function dedupPipelineLeads(db) {
  // Find contacts with more than one PipelineLead record
  const groups = await db.$queryRaw`
    SELECT "contactId", COUNT(*) as cnt
    FROM "PipelineLead"
    GROUP BY "contactId"
    HAVING COUNT(*) > 1
  `
  if (!groups.length) {
    console.log("[db-migrate] No duplicate PipelineLeads found")
    return
  }

  let removed = 0
  for (const { contactId } of groups) {
    // Get all records for this contact ordered by most recent first
    const records = await db.pipelineLead.findMany({
      where: { contactId },
      orderBy: { updatedAt: "desc" },
    })
    // Keep the first (most recent), delete the rest
    const toDelete = records.slice(1).map(r => r.id)
    await db.pipelineLead.deleteMany({ where: { id: { in: toDelete } } })
    removed += toDelete.length
  }
  console.log(`[db-migrate] Removed ${removed} duplicate PipelineLead record(s)`)
}

// ─── Seed keywords for One Twenty Brickell campaign ──────────────────────────

async function seedBrickellKeywords(db) {
  const campaign = await db.facebookBotCampaign.findFirst({
    where: { keyword: "BRICKELL" },
  })
  if (!campaign) return
  const current = new Set(
    (campaign.keywords || campaign.keyword)
      .split(",")
      .map(k => k.trim().toUpperCase())
      .filter(Boolean)
  )
  const toAdd = ["BRICKELL", "FAMILIA", "DOLARES"]
  let changed = false
  for (const kw of toAdd) {
    if (!current.has(kw)) { current.add(kw); changed = true }
  }
  if (!changed) {
    console.log("[db-migrate] BRICKELL campaign keywords already up to date")
    return
  }
  await db.facebookBotCampaign.update({
    where: { id: campaign.id },
    data: { keywords: Array.from(current).join(",") },
  })
  console.log("[db-migrate] BRICKELL campaign keywords updated:", Array.from(current).join(", "))
}



// ─── Backfill portal tokens for referral partners ────────────────────────────

async function backfillPartnerTokens(db) {
  const crypto = require("crypto")
  const partners = await db.referralPartner.findMany({ where: { token: null }, select: { id: true } })
  for (const p of partners) {
    await db.referralPartner.update({
      where: { id: p.id },
      data: { token: crypto.randomBytes(24).toString("hex") },
    })
  }
  if (partners.length) console.log(`[db-migrate] backfilled ${partners.length} partner tokens`)
}

// ─── Warm → Hot smart plan ────────────────────────────────────────────────────
// Auto-enrolls when a lead moves to the Warm stage (they replied/engaged).
// Goal: convert engagement into a phone call / appointment (Hot). Design:
//  - Automation starts on day 1 as the SAFETY NET — day 0 belongs to Catherine
//    (handleLeadEngaged already creates her urgent call task).
//  - MLS matches keep flowing via Sofia's hourly alerts; this plan uses
//    pre-construction EXCLUSIVITY (details only by phone — commission-safe)
//    plus financing help and social proof as the reasons to get on a call.
//  - Any new reply from the lead auto-pauses the plan (live conversation wins).

async function seedWarmToHotPlan(db) {
  const exists = await db.smartPlan.findFirst({
    where: { name: "Warm → Hot: Camino a la Llamada" },
  })
  if (exists) {
    console.log("[db-migrate] Warm → Hot plan already exists, skipping")
    return
  }

  const emailShell = (title, inner) => `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
<div style="background:linear-gradient(135deg,#1E3A5F 0%,#2D5A8E 100%);padding:32px 30px;text-align:center;">
  <h1 style="color:#D4AF37;margin:0;font-size:24px;font-weight:700;">Catherine Gomez Realtor</h1>
  <p style="color:#fff;margin:6px 0 0;font-size:13px;opacity:0.85;">Miami &bull; Homestead &bull; South Florida</p>
</div>
<div style="padding:34px 30px;">
  <h2 style="color:#1E3A5F;font-size:20px;margin:0 0 14px;">${title}</h2>
  ${inner}
</div>
<div style="background:#1E3A5F;padding:20px 30px;text-align:center;">
  <p style="color:#D4AF37;margin:0 0 4px;font-weight:700;">Catherine Gomez, Realtor</p>
  <p style="color:#fff;margin:0;font-size:12px;opacity:0.85;">📞 {agent_phone} &bull; catherinegomezrealtor.com</p>
</div>
</div>`

  const cta = (label) => `<div style="text-align:center;margin:26px 0;">
    <a href="{calendly_url}" style="background:linear-gradient(135deg,#1E3A5F,#2D5A8E);color:#D4AF37;padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">${label}</a>
    <p style="color:#888;font-size:11px;margin:8px 0 0;">15 minutos &bull; Sin compromiso &bull; En español</p>
  </div>`

  await db.smartPlan.create({
    data: {
      name: "Warm → Hot: Camino a la Llamada",
      description: "Para leads Warm (respondieron un mensaje) que aún no agendan: 14 días de toques diseñados para convertir la respuesta en una llamada/cita con Catherine. Se pausa solo si el lead vuelve a responder.",
      trigger: "PIPELINE_STAGE:Warm",
      isActive: true,
      steps: {
        create: [
          {
            order: 0,
            type: "SMS",
            delay: 1,
            content: "Hola {first_name}! Soy Sofía 😊 Catherine apartó 2 espacios esta semana para hablar contigo 15 minutitos sobre lo que buscas. ¿Te viene mejor hoy en la tarde o mañana? También puedes elegir tu hora aquí: {calendly_url}",
          },
          {
            order: 1,
            type: "TASK",
            delay: 2,
            taskType: "CALL",
            taskTitle: "☎️ Llamar a {first_name} — Warm sin cita (día 2)",
            content: "Este lead respondió pero aún no agenda. Revisa la última conversación y llámalo personalmente. Ángulo sugerido: pregunta abierta sobre qué busca + ofrece pre-aprobación gratis con lender en español.",
          },
          {
            order: 2,
            type: "EMAIL",
            delay: 3,
            subject: "{first_name}, 15 minutos que te pueden ahorrar meses 🏠",
            content: emailShell(
              "3 cosas que resolvemos en una llamada de 15 minutos",
              `<p style="color:#555;line-height:1.7;margin:0 0 14px;">Hola {first_name}, soy Catherine. Vi que estás explorando opciones — excelente. Una llamada corta nos ahorra semanas de mensajes:</p>
              <div style="background:#F8FAFC;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #E2E8F0;">
                <p style="margin:0;color:#555;font-size:14px;line-height:2.1;">1️⃣ <strong>Tu número real:</strong> cuánto te alcanza HOY (con pre-aprobación gratis, en español)<br>2️⃣ <strong>Tu zona ideal:</strong> dónde rinde más tu presupuesto — Miami, Homestead o alrededores<br>3️⃣ <strong>Tu plan:</strong> los pasos exactos y cuánto tiempo toma</p>
              </div>
              <p style="color:#555;line-height:1.7;margin:0 0 6px;">Sin presión y sin compromiso — sales de la llamada con un plan claro, decidas lo que decidas.</p>
              ${cta("📅 Elegir mi horario de 15 min")}`
            ),
          },
          {
            order: 3,
            type: "SMS",
            delay: 5,
            content: "{first_name}, dato importante 💡 La pre-aprobación es GRATIS, no te compromete a nada, y te dice exactamente cuánto te presta el banco. Catherine te conecta con un lender en español en 1 día. ¿Te lo coordino? Responde SÍ o llámanos: {agent_phone}",
          },
          {
            order: 4,
            type: "EMAIL",
            delay: 7,
            subject: "🏗️ Proyectos nuevos con precio de lanzamiento — detalles solo por teléfono",
            content: emailShell(
              "Lo que no puedo poner por escrito 🤫",
              `<p style="color:#555;line-height:1.7;margin:0 0 14px;">Hola {first_name}, además de las propiedades que Sofía te envía, tengo acceso a <strong>proyectos de pre-construcción</strong> en el área de Miami y Homestead con:</p>
              <div style="background:#FEF3C7;border-left:4px solid #F59E0B;padding:14px 18px;margin:16px 0;border-radius:4px;">
                <p style="margin:0;color:#78350F;font-size:14px;line-height:2;">✅ Precios de lanzamiento (suben con cada fase)<br>✅ Planes de pago durante la construcción<br>✅ Entrega 2026–2027 — ideal para vivir o invertir</p>
              </div>
              <p style="color:#555;line-height:1.7;margin:0 0 6px;">Los desarrolladores no me dejan publicar nombres ni precios por escrito — pero <strong>en una llamada te cuento todo</strong>: cuáles son, dónde están y los números reales.</p>
              ${cta("🏗️ Quiero los detalles — agendar llamada")}`
            ),
          },
          {
            order: 5,
            type: "TASK",
            delay: 9,
            taskType: "CALL",
            taskTitle: "☎️ Llamar a {first_name} — Warm sin cita (día 9, segundo intento)",
            content: "Segundo intento personal. Ángulo sugerido: menciona los proyectos de pre-construcción con precio de lanzamiento (el email del día 7) — pregúntale si lo vio y ofrécele los detalles por teléfono.",
          },
          {
            order: 6,
            type: "SMS",
            delay: 10,
            content: "Hola {first_name}! Catherine está armando las visitas del fin de semana 🏠🔑 ¿Te aparto un espacio el sábado o el domingo para ver opciones en tu zona? Responde SÁBADO o DOMINGO y quedas dentro. — Sofía",
          },
          {
            order: 7,
            type: "EMAIL",
            delay: 12,
            subject: "De \"solo estoy mirando\" a las llaves en la mano 🔑",
            content: emailShell(
              "La familia que casi no llama",
              `<p style="color:#555;line-height:1.7;margin:0 0 14px;">{first_name}, te cuento una historia real. Una familia me escribió igual que tú — "solo estamos mirando". Casi no agendan la llamada.</p>
              <p style="color:#555;line-height:1.7;margin:0 0 14px;">En esa llamada descubrimos que calificaban para <strong>asistencia de pago inicial</strong> que no sabían que existía. Tres meses después recibieron las llaves de su casa en Homestead — pagando de hipoteca casi lo mismo que pagaban de renta.</p>
              <div style="background:#F0FFF4;border:1px solid #A7F3D0;border-radius:8px;padding:14px 18px;margin:16px 0;">
                <p style="margin:0;color:#065F46;font-size:14px;line-height:1.8;"><strong>La diferencia no fue el dinero.</strong> Fue una llamada de 15 minutos donde vieron sus opciones reales con alguien que habla su idioma.</p>
              </div>
              ${cta("🔑 Quiero ver mis opciones reales")}`
            ),
          },
          {
            order: 8,
            type: "SMS",
            delay: 14,
            content: "{first_name}, no quiero llenarte de mensajes 🙏 Dime tú: ¿sigues buscando casa y quieres que Catherine te llame, o prefieres que pausemos por ahora? Un \"LLÁMAME\" o un \"PAUSA\" me basta. — Sofía 😊",
          },
        ],
      },
    },
  })
  console.log("[db-migrate] Warm → Hot smart plan created (9 steps, 14 days)")
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const db = new PrismaClient()
  for (const sql of STMTS) {
    await db.$executeRawUnsafe(sql).catch(e => console.warn("[db-migrate] skip:", e.message))
  }
  await seedAIConfig(db).catch(e => console.warn("[db-migrate] AIConfig fix skip:", e.message))
  await seedFirstTimeBuyersPlan(db).catch(e => console.warn("[db-migrate] First-time buyers plan skip:", e.message))
  await seedColombiaPlan(db).catch(e => console.warn("[db-migrate] Colombia plan skip:", e.message))
  await seedBookingUrl(db).catch(e => console.warn("[db-migrate] booking url skip:", e.message))
  await seedReIgniteDrip(db).catch(e => console.warn("[db-migrate] Re-Ignite drip skip:", e.message))
  await seedWarmToHotPlan(db).catch(e => console.warn("[db-migrate] Warm→Hot plan skip:", e.message))
  await dedupPipelineLeads(db).catch(e => console.warn("[db-migrate] dedup pipeline leads skip:", e.message))
  await seedBrickellKeywords(db).catch(e => console.warn("[db-migrate] Brickell keywords skip:", e.message))
  await backfillPartnerTokens(db).catch(e => console.warn("[db-migrate] partner tokens skip:", e.message))
  await db.$disconnect()
  console.log("[db-migrate] done")
  process.exit(0)
}

main().catch(e => { console.error("[db-migrate] fatal:", e); process.exit(1) })
