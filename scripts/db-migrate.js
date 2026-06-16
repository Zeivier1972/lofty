// Runs idempotent ALTER TABLE statements using the Prisma client (not CLI).
// Avoids the wasm engine issue where prisma db push can't resolve DATABASE_URL.
const { PrismaClient } = require("@prisma/client")

const STMTS = [
  // configurable bot buttons (PR #64)
  `ALTER TABLE "FacebookBotConfig" ADD COLUMN IF NOT EXISTS "greetingButtons" TEXT NOT NULL DEFAULT 'Sí, me interesa,Quiero más info'`,
  `ALTER TABLE "FacebookBotConfig" ADD COLUMN IF NOT EXISTS "intentButtonA" TEXT NOT NULL DEFAULT 'Comprar para vivir'`,
  `ALTER TABLE "FacebookBotConfig" ADD COLUMN IF NOT EXISTS "intentButtonB" TEXT NOT NULL DEFAULT 'Invertir / Airbnb'`,
  `ALTER TABLE "FacebookBotConfig" ADD COLUMN IF NOT EXISTS "intentButtonC" TEXT NOT NULL DEFAULT 'Solo explorando'`,
  `ALTER TABLE "InstagramBotConfig" ADD COLUMN IF NOT EXISTS "greetingButtons" TEXT NOT NULL DEFAULT 'Sí, me interesa,Quiero más info'`,
  `ALTER TABLE "InstagramBotConfig" ADD COLUMN IF NOT EXISTS "intentButtonA" TEXT NOT NULL DEFAULT 'Comprar para vivir'`,
  `ALTER TABLE "InstagramBotConfig" ADD COLUMN IF NOT EXISTS "intentButtonB" TEXT NOT NULL DEFAULT 'Invertir / Airbnb'`,
  `ALTER TABLE "InstagramBotConfig" ADD COLUMN IF NOT EXISTS "intentButtonC" TEXT NOT NULL DEFAULT 'Solo explorando'`,
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

// ─── Colombia investor smart plan seed ───────────────────────────────────────

async function seedColombiaPlan(db) {
  const exists = await db.smartPlan.findFirst({
    where: { name: "Invierte en Florida desde Colombia" },
  })
  if (exists) {
    console.log("[db-migrate] Colombia plan already exists, skipping")
    return
  }

  await db.smartPlan.create({
    data: {
      name: "Invierte en Florida desde Colombia",
      description: "Secuencia educativa en español para inversionistas colombianos — WhatsApp prioritario + Emails con diseño (28 días, 11 pasos)",
      trigger: "MANUAL",
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
  const config = await db.aIConfig.findFirst()
  if (config && !config.calendlyUrl) {
    await db.aIConfig.update({
      where: { id: config.id },
      data: { calendlyUrl: "https://lofty-production.up.railway.app/book" },
    })
    console.log("[db-migrate] AIConfig calendlyUrl set to booking page")
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const db = new PrismaClient()
  for (const sql of STMTS) {
    await db.$executeRawUnsafe(sql).catch(e => console.warn("[db-migrate] skip:", e.message))
  }
  await seedColombiaPlan(db).catch(e => console.warn("[db-migrate] Colombia plan skip:", e.message))
  await seedBookingUrl(db).catch(e => console.warn("[db-migrate] booking url skip:", e.message))
  await db.$disconnect()
  console.log("[db-migrate] done")
}

main().catch(e => { console.error("[db-migrate] fatal:", e); process.exit(1) })
