import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"

export const revalidate = 0

export default async function GuidePage({ params }: { params: { keyword: string } }) {
  const slug = params.keyword.toLowerCase()

  // Normalize slug back to keyword (e.g. "inversion" → "INVERSIÓN")
  const magnet = await prisma.leadMagnet.findFirst({
    where: {
      guideUrl: { endsWith: `/${slug}` },
    },
  })

  if (!magnet?.content) notFound()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
  const bookingUrl = `${appUrl}/book`

  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{magnet.title} — Catherine Gomez Realtor</title>
        <meta name="description" content={magnet.description} />
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Georgia, serif; background: #f8f7f4; color: #333; }
          .header { background: #1a1a2e; padding: 32px 24px; text-align: center; }
          .header-tag { color: #c9a84c; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; font-family: Arial, sans-serif; margin-bottom: 8px; }
          .header-title { color: #fff; font-size: 26px; font-weight: bold; line-height: 1.3; margin-bottom: 8px; }
          .header-sub { color: #aaa; font-size: 14px; font-family: Arial, sans-serif; }
          .container { max-width: 680px; margin: 0 auto; padding: 40px 24px; }
          .content h2 { color: #1a1a2e; font-size: 20px; margin: 32px 0 12px; border-left: 4px solid #c9a84c; padding-left: 12px; }
          .content p { font-size: 16px; line-height: 1.8; margin-bottom: 16px; color: #444; }
          .content ul { margin: 12px 0 16px 20px; }
          .content li { font-size: 15px; line-height: 1.7; color: #444; margin-bottom: 6px; }
          .content strong { color: #1a1a2e; }
          .cta-box { background: #1a1a2e; border-radius: 12px; padding: 32px; text-align: center; margin: 40px 0; }
          .cta-tag { color: #c9a84c; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; font-family: Arial, sans-serif; margin-bottom: 12px; }
          .cta-box p { color: #ddd; font-size: 15px; font-family: Arial, sans-serif; margin-bottom: 20px; line-height: 1.6; }
          .cta-btn { display: inline-block; background: #c9a84c; color: #fff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-size: 15px; font-weight: bold; font-family: Arial, sans-serif; }
          .agent-card { background: #fff; border: 1px solid #e5e0d5; border-radius: 12px; padding: 20px; margin-top: 24px; }
          .agent-card h4 { color: #1a1a2e; font-size: 16px; margin-bottom: 6px; }
          .agent-card p { color: #888; font-size: 13px; font-family: Arial, sans-serif; margin-bottom: 3px; }
          .agent-card a { color: #c9a84c; text-decoration: none; }
          .print-btn { text-align: center; margin: 0 0 24px; }
          .print-btn button { background: none; border: 1px solid #ccc; padding: 8px 20px; border-radius: 6px; font-size: 13px; cursor: pointer; color: #666; font-family: Arial, sans-serif; }
          @media print { .print-btn, .cta-box { display: none; } }
        `}</style>
      </head>
      <body>
        <div className="header">
          <p className="header-tag">Catherine Gomez Realtor · Miami</p>
          <h1 className="header-title">{magnet.title}</h1>
          <p className="header-sub">{magnet.description}</p>
        </div>

        <div className="container">
          <div className="print-btn">
            <button onClick={() => window.print()}>Descargar / Imprimir como PDF</button>
          </div>

          <div className="content" dangerouslySetInnerHTML={{ __html: magnet.content }} />

          <div className="cta-box">
            <p className="cta-tag">¿Listo para el siguiente paso?</p>
            <p>
              Agenda una consulta gratuita con Catherine Gomez.<br />
              Más de 15 años ayudando a familias hispanas en South Florida.
            </p>
            <a href={bookingUrl} className="cta-btn">Agendar consulta gratuita →</a>
          </div>

          <div className="agent-card">
            <h4>Catherine Gomez</h4>
            <p>Realtor · South Florida · 15+ años de experiencia</p>
            <p><a href="tel:3052830872">(305) 283-0872</a> · <a href="mailto:info@catherinegomezrealtor.com">info@catherinegomezrealtor.com</a></p>
          </div>
        </div>
      </body>
    </html>
  )
}
