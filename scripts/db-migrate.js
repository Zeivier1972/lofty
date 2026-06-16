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
  // multi-keyword campaigns
  `ALTER TABLE "FacebookBotCampaign" ADD COLUMN IF NOT EXISTS "keywords" TEXT NOT NULL DEFAULT ''`,
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
  <p style="color:#C9A84C;font-size:13px;font-weight:700;letter-spacing:2px;margin:0 0 8px;">SOUTH FLORIDA MARKET ALERT</p>
  <h1 style="color:#fff;font-size:26px;font-weight:800;margin:0;line-height:1.3;">Miami home prices just hit<br>another record high.</h1>
</div>
<div style="padding:32px 30px;">
  <p style="color:#333;line-height:1.8;font-size:15px;">Hi {first_name},</p>
  <p style="color:#333;line-height:1.8;font-size:15px;">I know life gets busy. But I wanted to share something that affects your wallet directly.</p>
  <div style="background:#FFF8E7;border-left:4px solid #C9A84C;padding:16px 20px;margin:20px 0;border-radius:0 8px 8px 0;">
    <p style="color:#0F2744;font-weight:700;margin:0 0 8px;font-size:16px;">📈 What happened in South Florida in 2026:</p>
    <p style="color:#555;margin:0;line-height:1.8;">• Median home prices up <strong>11% year-over-year</strong><br>
    • Rental rates in Miami-Dade up <strong>8%</strong> since January<br>
    • Pre-construction inventory down <strong>34%</strong> from last year<br>
    • Builder incentives still available — but quietly disappearing</p>
  </div>
  <p style="color:#333;line-height:1.8;font-size:15px;">The home you were thinking about 3 months ago? It costs more today. And it will cost more 3 months from now.</p>
  <p style="color:#333;line-height:1.8;font-size:15px;">Pre-construction is still the <strong>best hedge against rising prices</strong> in South Florida right now — you lock in today's price, and pay as the building goes up.</p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${BOOK_URL}" style="background:#C9A84C;color:#fff;padding:15px 36px;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">📅 Let's talk — Free 15-min call</a>
  </div>
  <p style="color:#555;line-height:1.8;font-size:14px;">No pressure, no commitment. Just a quick conversation about what's available in your budget right now.</p>
</div>
<div style="background:#0F2744;padding:20px 30px;text-align:center;">
  <p style="color:#fff;margin:0 0 4px;font-weight:700;">${AGENT_NAME}, Realtor</p>
  <p style="color:rgba(255,255,255,0.7);margin:0;font-size:12px;">📞 ${AGENT_PHONE} · catherinegomezrealtor.com</p>
</div>
</div>`

const emailReIgniteDay10 = `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#fff;">
<div style="background:linear-gradient(135deg,#0F2744 0%,#1a3a5c 100%);padding:36px 30px;text-align:center;">
  <p style="color:#C9A84C;font-size:13px;font-weight:700;letter-spacing:2px;margin:0 0 8px;">PRE-CONSTRUCTION vs. RESALE</p>
  <h1 style="color:#fff;font-size:26px;font-weight:800;margin:0;line-height:1.3;">What $500K buys you in<br>South Florida right now</h1>
</div>
<div style="padding:32px 30px;">
  <p style="color:#333;line-height:1.8;font-size:15px;">Hi {first_name},</p>
  <p style="color:#333;line-height:1.8;font-size:15px;">Let me show you something nobody talks about when they say "buy resale."</p>
  <div style="display:grid;gap:16px;margin:24px 0;">
    <div style="background:#FFF8E7;border-radius:12px;padding:20px;">
      <p style="color:#C9A84C;font-weight:800;font-size:14px;margin:0 0 12px;text-transform:uppercase;">🏚️ $500K Resale in South Florida</p>
      <p style="color:#555;margin:0;line-height:2;">• Built in 1998 — aging systems<br>• HOA: $800–$1,200/month<br>• Inspection surprises guaranteed<br>• No builder warranty<br>• Competing with 12 other offers<br>• What you see is what you get</p>
    </div>
    <div style="background:#E8F5E9;border-radius:12px;padding:20px;">
      <p style="color:#2E7D32;font-weight:800;font-size:14px;margin:0 0 12px;text-transform:uppercase;">✅ $500K Pre-Construction in South Florida</p>
      <p style="color:#555;margin:0;line-height:2;">• Brand new — 10-year builder warranty<br>• Modern finishes, smart home tech<br>• Lock in 2026 prices, close in 2027-28<br>• Builder incentives: closing costs, upgrades<br>• No bidding wars — you pick your unit<br>• Appreciation built in before you close</p>
    </div>
  </div>
  <p style="color:#333;line-height:1.8;font-size:15px;">The math is simple. The window isn't open forever.</p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${BOOK_URL}" style="background:#C9A84C;color:#fff;padding:15px 36px;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">See Available Pre-Construction Units →</a>
  </div>
</div>
<div style="background:#0F2744;padding:20px 30px;text-align:center;">
  <p style="color:#fff;margin:0 0 4px;font-weight:700;">${AGENT_NAME}, Realtor</p>
  <p style="color:rgba(255,255,255,0.7);margin:0;font-size:12px;">📞 ${AGENT_PHONE} · catherinegomezrealtor.com</p>
</div>
</div>`

const emailReIgniteDay20 = `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#fff;">
<div style="background:linear-gradient(135deg,#0F2744 0%,#1a3a5c 100%);padding:36px 30px;text-align:center;">
  <p style="color:#C9A84C;font-size:13px;font-weight:700;letter-spacing:2px;margin:0 0 8px;">SOUTH FLORIDA MARKET REPORT — 2026</p>
  <h1 style="color:#fff;font-size:26px;font-weight:800;margin:0;line-height:1.3;">Your Monthly Snapshot:<br>What's Really Happening</h1>
</div>
<div style="padding:32px 30px;">
  <p style="color:#333;line-height:1.8;font-size:15px;">Hi {first_name},</p>
  <p style="color:#333;line-height:1.8;font-size:15px;">Here's your South Florida market update — straight talk, no fluff.</p>
  <div style="background:#F8FAFC;border-radius:12px;padding:24px;margin:20px 0;">
    <p style="color:#0F2744;font-weight:800;font-size:16px;margin:0 0 16px;">📊 By the Numbers — Q2 2026</p>
    <div style="display:grid;gap:12px;">
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #E2E8F0;">
        <span style="color:#555;">Median sale price (Miami-Dade)</span><span style="color:#0F2744;font-weight:700;">$645,000</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #E2E8F0;">
        <span style="color:#555;">Days on market (resale)</span><span style="color:#0F2744;font-weight:700;">28 days</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #E2E8F0;">
        <span style="color:#555;">Pre-construction units available</span><span style="color:#C9A84C;font-weight:700;">↓ 34% vs last year</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0;">
        <span style="color:#555;">Avg rent increase (Miami)</span><span style="color:#E53E3E;font-weight:700;">+8.2% YoY</span>
      </div>
    </div>
  </div>
  <p style="color:#333;line-height:1.8;font-size:15px;"><strong>Bottom line:</strong> Renters are paying more. Resale buyers are fighting over fewer homes. Pre-construction buyers who moved early are watching their equity grow before they even close.</p>
  <p style="color:#333;line-height:1.8;font-size:15px;">Which side of that equation do you want to be on?</p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${BOOK_URL}" style="background:#C9A84C;color:#fff;padding:15px 36px;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">📅 Get My Free Market Analysis</a>
  </div>
</div>
<div style="background:#0F2744;padding:20px 30px;text-align:center;">
  <p style="color:#fff;margin:0 0 4px;font-weight:700;">${AGENT_NAME}, Realtor</p>
  <p style="color:rgba(255,255,255,0.7);margin:0;font-size:12px;">📞 ${AGENT_PHONE} · catherinegomezrealtor.com</p>
</div>
</div>`

const emailReIgniteDay42 = `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#fff;">
<div style="background:linear-gradient(135deg,#0F2744 0%,#1a3a5c 100%);padding:36px 30px;text-align:center;">
  <p style="color:#C9A84C;font-size:13px;font-weight:700;letter-spacing:2px;margin:0 0 8px;">A STORY WORTH READING</p>
  <h1 style="color:#fff;font-size:26px;font-weight:800;margin:0;line-height:1.3;">"I waited 6 months.<br>It cost me $60,000."</h1>
</div>
<div style="padding:32px 30px;">
  <p style="color:#333;line-height:1.8;font-size:15px;">Hi {first_name},</p>
  <p style="color:#333;line-height:1.8;font-size:15px;">I want to share a story about a couple I worked with in Doral. They were ready to buy pre-construction in early 2025. They thought: <em>"Let's wait a few months, see what happens with rates."</em></p>
  <p style="color:#333;line-height:1.8;font-size:15px;">Six months later, they came back. The unit they wanted? <strong>Sold.</strong> The next available unit in the same building? <strong>$60,000 more.</strong></p>
  <div style="background:#FEF2F2;border-left:4px solid #E53E3E;padding:16px 20px;margin:20px 0;border-radius:0 8px 8px 0;">
    <p style="color:#C53030;font-weight:700;margin:0 0 8px;">What waiting cost them:</p>
    <p style="color:#555;margin:0;line-height:1.8;">• $60,000 more for a comparable unit<br>
    • 6 more months of rent paid ($12,000+)<br>
    • The specific floor and view they wanted — gone<br>
    • Total cost of waiting: <strong>$72,000+</strong></p>
  </div>
  <p style="color:#333;line-height:1.8;font-size:15px;">They still bought — and they love their home. But they wish they had moved when they were ready.</p>
  <p style="color:#333;line-height:1.8;font-size:15px;">I'm not sharing this to pressure you. I'm sharing it because I've seen this happen too many times and I genuinely don't want it to happen to you.</p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${BOOK_URL}" style="background:#C9A84C;color:#fff;padding:15px 36px;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">Let's talk before it's too late →</a>
  </div>
</div>
<div style="background:#0F2744;padding:20px 30px;text-align:center;">
  <p style="color:#fff;margin:0 0 4px;font-weight:700;">${AGENT_NAME}, Realtor</p>
  <p style="color:rgba(255,255,255,0.7);margin:0;font-size:12px;">📞 ${AGENT_PHONE} · catherinegomezrealtor.com</p>
</div>
</div>`

const emailReIgniteDay60 = `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#fff;">
<div style="background:linear-gradient(135deg,#0F2744 0%,#1a3a5c 100%);padding:36px 30px;text-align:center;">
  <p style="color:#C9A84C;font-size:13px;font-weight:700;letter-spacing:2px;margin:0 0 8px;">MID-YEAR UPDATE — SOUTH FLORIDA</p>
  <h1 style="color:#fff;font-size:26px;font-weight:800;margin:0;line-height:1.3;">5 Pre-Construction Projects<br>Selling Fast in 2026</h1>
</div>
<div style="padding:32px 30px;">
  <p style="color:#333;line-height:1.8;font-size:15px;">Hi {first_name},</p>
  <p style="color:#333;line-height:1.8;font-size:15px;">Here are the top pre-construction opportunities in South Florida right now — before they're all reserved:</p>
  <div style="background:#F8FAFC;border-radius:12px;padding:20px;margin:20px 0;">
    <p style="color:#0F2744;font-weight:700;margin:0 0 12px;">🔥 Hot Pre-Construction Markets in 2026:</p>
    <p style="color:#555;line-height:2;margin:0;">
      🏙️ <strong>Brickell</strong> — Luxury condos, rental-friendly, 10% deposits<br>
      🌴 <strong>Doral</strong> — Best value for families, A-rated schools, rapid appreciation<br>
      🌊 <strong>Pompano Beach</strong> — Oceanfront pre-con at prices Brickell can't touch<br>
      🏡 <strong>Miramar / Pembroke Pines</strong> — Single family pre-con, no HOA restrictions<br>
      ✈️ <strong>Hialeah Gardens</strong> — Fastest growing market, lowest entry point
    </p>
  </div>
  <p style="color:#333;line-height:1.8;font-size:15px;">Each of these has units available <strong>right now</strong> — but inventory is moving. Builder incentives (closing costs paid, free upgrades) are still on the table but not for long.</p>
  <p style="color:#333;line-height:1.8;font-size:15px;">Tell me which area interests you most and I'll send you the exact units, floor plans and pricing — no obligation.</p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${BOOK_URL}" style="background:#C9A84C;color:#fff;padding:15px 36px;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">📍 Show Me What's Available</a>
  </div>
</div>
<div style="background:#0F2744;padding:20px 30px;text-align:center;">
  <p style="color:#fff;margin:0 0 4px;font-weight:700;">${AGENT_NAME}, Realtor</p>
  <p style="color:rgba(255,255,255,0.7);margin:0;font-size:12px;">📞 ${AGENT_PHONE} · catherinegomezrealtor.com</p>
</div>
</div>`

const emailReIgniteDay80 = `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#fff;">
<div style="background:linear-gradient(135deg,#0F2744 0%,#1a3a5c 100%);padding:36px 30px;text-align:center;">
  <p style="color:#C9A84C;font-size:13px;font-weight:700;letter-spacing:2px;margin:0 0 8px;">FREE OFFER — NO STRINGS ATTACHED</p>
  <h1 style="color:#fff;font-size:26px;font-weight:800;margin:0;line-height:1.3;">Know exactly what your<br>buying power is today.</h1>
</div>
<div style="padding:32px 30px;">
  <p style="color:#333;line-height:1.8;font-size:15px;">Hi {first_name},</p>
  <p style="color:#333;line-height:1.8;font-size:15px;">I want to offer you something completely free, no strings attached:</p>
  <div style="background:#E8F5E9;border-radius:12px;padding:24px;margin:20px 0;text-align:center;">
    <p style="color:#2E7D32;font-weight:800;font-size:18px;margin:0 0 8px;">🎁 Free Personalized Market Analysis</p>
    <p style="color:#555;margin:0;line-height:1.8;">I'll show you exactly:<br>
    • What you can afford in pre-construction today<br>
    • Which South Florida projects match your budget<br>
    • What your projected equity looks like at closing<br>
    • What builder incentives you qualify for right now</p>
  </div>
  <p style="color:#333;line-height:1.8;font-size:15px;">No pressure. No commitment. Just real numbers so you can make a real decision.</p>
  <p style="color:#333;line-height:1.8;font-size:15px;">Takes 15 minutes. Could save you years of waiting.</p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${BOOK_URL}" style="background:#C9A84C;color:#fff;padding:15px 36px;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">📅 Claim My Free Analysis</a>
  </div>
</div>
<div style="background:#0F2744;padding:20px 30px;text-align:center;">
  <p style="color:#fff;margin:0 0 4px;font-weight:700;">${AGENT_NAME}, Realtor</p>
  <p style="color:rgba(255,255,255,0.7);margin:0;font-size:12px;">📞 ${AGENT_PHONE} · catherinegomezrealtor.com</p>
</div>
</div>`

async function seedReIgniteDrip(db) {
  const exists = await db.smartPlan.findFirst({
    where: { name: "Re-Ignite: South Florida Pre-Construction (Unresponsive)" },
  })
  if (exists) {
    console.log("[db-migrate] Re-Ignite drip already seeded — skip")
    return
  }

  await db.smartPlan.create({
    data: {
      name: "Re-Ignite: South Florida Pre-Construction (Unresponsive)",
      description: "90-day resurrection drip for local South Florida buyers interested in pre-construction who did not respond after 4+ contact attempts. Mix of SMS, WhatsApp, and email. Reply triggers warm pipeline move + Catherine notification.",
      trigger: "MANUAL",
      isActive: true,
      steps: {
        create: [
          // DAY 1 — SMS — Pain: rent going up
          {
            order: 0, type: "SMS", delay: 0,
            content: "Hey {first_name} — Catherine Gomez here 🌴 Quick question: did your rent go up again this year? Most South Florida renters are paying 8–12% more than last year. I've been helping local buyers lock in pre-construction prices before they climb higher. Want me to show you what's available in your budget? Just reply YES and I'll send details.",
          },
          // DAY 3 — EMAIL — Market record hit
          {
            order: 1, type: "EMAIL", delay: 3,
            subject: "{first_name}, Miami home prices just hit a new record — here's what that means for you",
            content: emailReIgniteDay3,
          },
          // DAY 7 — WHATSAPP — The home costs more now
          {
            order: 2, type: "WHATSAPP", delay: 7,
            content: "Hi {first_name} 👋 Catherine here. Just a heads up — the pre-construction unit we talked about has gone up in price since we last spoke. This happens every quarter as construction progresses. The good news: there are still units available at the current price. Want me to send you a current list? Reply YES and I'll get it to you today. 🏠",
          },
          // DAY 10 — EMAIL — Pre-con vs resale comparison
          {
            order: 3, type: "EMAIL", delay: 10,
            subject: "Pre-construction vs. resale: what $500K actually buys you in South Florida right now",
            content: emailReIgniteDay10,
          },
          // DAY 14 — SMS — Builder incentive alert
          {
            order: 4, type: "SMS", delay: 14,
            content: "🚨 Builder alert, {first_name}: Several South Florida pre-construction projects are still offering to cover closing costs (up to $15K value) — but only for a limited time. Once units sell out, the incentives go away. I can send you the full list of projects with active incentives. Reply INFO and I'll send it over. — Catherine ${AGENT_PHONE}",
          },
          // DAY 20 — EMAIL — Monthly market report
          {
            order: 5, type: "EMAIL", delay: 20,
            subject: "Your South Florida market report — Q2 2026",
            content: emailReIgniteDay20,
          },
          // DAY 25 — WHATSAPP — 5 projects selling fast
          {
            order: 6, type: "WHATSAPP", delay: 25,
            content: "Good morning {first_name}! ☀️ Catherine here. The 5 pre-construction projects with the best value in South Florida right now:\n\n🏙️ Brickell — luxury, rental-friendly\n🌴 Doral — best for families\n🌊 Pompano Beach — oceanfront deals\n🏡 Miramar — single family, no restrictions\n✈️ Hialeah Gardens — fastest appreciation\n\nAll have units available. Which area fits your life best? Reply with the name and I'll send floor plans + pricing today.",
          },
          // DAY 30 — EMAIL — Interest rate + buying power
          {
            order: 7, type: "EMAIL", delay: 30,
            subject: "Rates, buying power, and why pre-construction changes everything",
            content: `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#fff;"><div style="background:linear-gradient(135deg,#0F2744 0%,#1a3a5c 100%);padding:36px 30px;text-align:center;"><p style="color:#C9A84C;font-size:13px;font-weight:700;letter-spacing:2px;margin:0 0 8px;">RATE UPDATE — 2026</p><h1 style="color:#fff;font-size:26px;font-weight:800;margin:0;line-height:1.3;">Why pre-construction buyers<br>don't stress about rates</h1></div><div style="padding:32px 30px;"><p style="color:#333;line-height:1.8;font-size:15px;">Hi {first_name},</p><p style="color:#333;line-height:1.8;font-size:15px;">Everyone is watching mortgage rates. But here's what most buyers don't realize: <strong>pre-construction buyers don't lock in their rate today.</strong></p><div style="background:#FFF8E7;border-left:4px solid #C9A84C;padding:16px 20px;margin:20px 0;border-radius:0 8px 8px 0;"><p style="color:#0F2744;font-weight:700;margin:0 0 8px;">How pre-construction protects you from rates:</p><p style="color:#555;margin:0;line-height:1.8;">✅ You pay 10% deposit today — that's it<br>✅ Building takes 18–36 months<br>✅ You get your mortgage at closing — not now<br>✅ If rates drop, you benefit<br>✅ If prices rise, your equity already grew<br>✅ Builder may offer rate buydowns at closing</p></div><p style="color:#333;line-height:1.8;font-size:15px;">You're buying time — and South Florida real estate — at today's prices.</p><div style="text-align:center;margin:28px 0;"><a href="${BOOK_URL}" style="background:#C9A84C;color:#fff;padding:15px 36px;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">Let's run your numbers →</a></div></div><div style="background:#0F2744;padding:20px 30px;text-align:center;"><p style="color:#fff;margin:0 0 4px;font-weight:700;">${AGENT_NAME}, Realtor</p><p style="color:rgba(255,255,255,0.7);margin:0;font-size:12px;">📞 ${AGENT_PHONE} · catherinegomezrealtor.com</p></div></div>`,
          },
          // DAY 35 — SMS — Low friction YES ask
          {
            order: 8, type: "SMS", delay: 35,
            content: "Hi {first_name}, Catherine here 👋 Still dreaming about owning in South Florida? No pressure — just reply YES and I'll send you something you'll actually want to see. Takes 2 seconds. ${AGENT_PHONE}",
          },
          // DAY 42 — EMAIL — Story of someone who waited
          {
            order: 9, type: "EMAIL", delay: 42,
            subject: "\"I waited 6 months. It cost me $60,000.\" — A true story.",
            content: emailReIgniteDay42,
          },
          // DAY 50 — WHATSAPP — "I found something for you"
          {
            order: 10, type: "WHATSAPP", delay: 50,
            content: "Hey {first_name} 👋 Catherine here. I was going through some new listings this morning and found something that made me think of you immediately — a pre-construction unit in South Florida that checks a lot of boxes at a price that still makes sense.\n\nWant me to send you the details? Just reply YES and I'll send everything over — floor plan, price, projected ROI. No obligation. 🏠",
          },
          // DAY 60 — EMAIL — Mid-year 5 projects
          {
            order: 11, type: "EMAIL", delay: 60,
            subject: "5 pre-construction projects selling fast in South Florida — mid-2026 update",
            content: emailReIgniteDay60,
          },
          // DAY 70 — SMS — Still thinking?
          {
            order: 12, type: "SMS", delay: 70,
            content: "Hi {first_name} — Catherine Gomez 🌴 Still thinking about buying in South Florida? The market hasn't slowed down. But I can help you find an entry point that works for where you are right now. No minimums, no pressure. Just reply and let's talk. ${AGENT_PHONE}",
          },
          // DAY 80 — EMAIL — Free market analysis offer
          {
            order: 13, type: "EMAIL", delay: 80,
            subject: "Free: I'll show you exactly what you can afford in pre-construction today",
            content: emailReIgniteDay80,
          },
          // DAY 90 — WHATSAPP — Graceful goodbye
          {
            order: 14, type: "WHATSAPP", delay: 90,
            content: "Hi {first_name}, Catherine here — last message, I promise. 🙏\n\nI've shared a lot over the past few months because I genuinely believe South Florida pre-construction is one of the best moves a local buyer can make right now.\n\nIf now isn't the right time — totally OK. Life happens.\n\nBut if anything changes — rates, your situation, your mindset — I'm always here. My number is saved: ${AGENT_PHONE}.\n\nWishing you the best. And when you're ready, I'll be ready too. 🌴🏠",
          },
        ],
      },
    },
  })
  console.log("[db-migrate] Re-Ignite drip seeded (15 steps, 90 days)")
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
  await db.$disconnect()
  console.log("[db-migrate] done")
}

main().catch(e => { console.error("[db-migrate] fatal:", e); process.exit(1) })
