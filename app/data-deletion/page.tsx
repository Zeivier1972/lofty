import type { Metadata } from "next"
import Link from "next/link"
import RequestForm from "./request-form"

const BASE = "https://www.catherinegomezrealtor.com"
const PAGE_URL = `${BASE}/data-deletion`
const CONTACT_EMAIL = "info@catherinegomezrealtor.com"

const TITLE =
  "Eliminar mis datos | Data Deletion Request — Catherine Gomez Realtor"
const DESCRIPTION =
  "Solicita la eliminación de tus datos personales de Catherine Gomez Realtor, incluyendo conversaciones de Facebook Messenger e Instagram. Request deletion of your personal data, including Facebook and Instagram message history. Respuesta en 30 días."

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "eliminar mis datos",
    "borrar mis datos Catherine Gomez",
    "data deletion request",
    "delete my data real estate",
    "eliminar datos Facebook Messenger",
    "eliminar datos Instagram",
    "privacidad Catherine Gomez Realtor",
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    type: "website",
    siteName: "Catherine Gomez Realtor",
    locale: "es_US",
    // No `images` here on purpose: opengraph-image.tsx generates the real
    // 1200x630 card, and file-based metadata only takes over when the config
    // does not also set images.
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
}

/**
 * Visible Q&A. Mirrored verbatim into the FAQPage JSON-LD below so answer
 * engines quote the same text a human reads.
 */
const FAQS: { q: string; a: string }[] = [
  {
    q: "¿Cuánto tarda la eliminación de mis datos?",
    a: "Procesamos toda solicitud dentro de los 30 días. En la mayoría de los casos los datos de Facebook Messenger e Instagram se eliminan de forma inmediata y automática, y recibirás un código de confirmación al enviar tu solicitud.",
  },
  {
    q: "¿Qué datos se eliminan exactamente?",
    a: "Eliminamos tu historial de conversación de Facebook Messenger e Instagram, tu nombre, correo electrónico, número de teléfono, tus preferencias de búsqueda de propiedades y las notas asociadas a tu perfil en nuestro CRM.",
  },
  {
    q: "¿Hay datos que no se pueden eliminar?",
    a: "Sí. Si firmaste un contrato de compraventa o de representación con nosotros, la ley de Florida nos obliga a conservar los registros de esa transacción. También conservamos registros mínimos de bajas (opt-out) para no volver a contactarte por error. Nada de esto se usa para marketing.",
  },
  {
    q: "¿Cómo elimino mis datos desde Facebook o Instagram?",
    a: "Responde la palabra ELIMINAR o DELETE en la misma conversación de Messenger o Instagram. El asistente deja de escribirte de inmediato y la solicitud queda registrada. También puedes quitar el acceso desde la configuración de tu cuenta de Facebook, en Configuración y privacidad, Configuración, Aplicaciones y sitios web.",
  },
  {
    q: "¿Necesito tener una cuenta para pedir la eliminación?",
    a: "No. Basta con enviar el formulario de esta página con el correo electrónico, el teléfono o el usuario de Instagram que usaste para contactarnos, o escribir a info@catherinegomezrealtor.com.",
  },
  {
    q: "¿Dejaré de recibir mensajes de texto y correos?",
    a: "Sí. Al eliminar tus datos te damos de baja de todos los mensajes SMS, WhatsApp, correos y mensajes de Messenger e Instagram. También puedes responder STOP en cualquier momento solo para dejar de recibir mensajes, sin eliminar tus datos.",
  },
]

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": PAGE_URL,
      url: PAGE_URL,
      name: TITLE,
      description: DESCRIPTION,
      inLanguage: "es-US",
      isPartOf: { "@type": "WebSite", name: "Catherine Gomez Realtor", url: BASE },
      about: { "@type": "Thing", name: "Eliminación de datos personales" },
      publisher: {
        "@type": "RealEstateAgent",
        name: "Catherine Gomez Realtor",
        url: BASE,
        email: CONTACT_EMAIL,
        areaServed: { "@type": "City", name: "Miami", addressRegion: "FL", addressCountry: "US" },
      },
    },
    {
      "@type": "FAQPage",
      "@id": `${PAGE_URL}#faq`,
      mainEntity: FAQS.map(f => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
}

export default function DataDeletionPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-gray-500 mb-3">
        Catherine Gomez Realtor
      </p>
      <h1 className="text-3xl font-bold mb-4">
        Eliminación de datos{" "}
        <span className="text-gray-400 font-normal">/ Data Deletion</span>
      </h1>
      <p className="text-gray-700 leading-relaxed mb-2">
        Puedes pedir que eliminemos la información personal que tenemos sobre ti —
        incluido tu historial de conversación en Facebook Messenger e Instagram —
        en cualquier momento y sin costo.
      </p>
      <p className="text-sm text-gray-500 mb-10">
        You may request deletion of the personal data we hold about you, including your
        Facebook Messenger and Instagram conversation history, at any time and free of charge.
        This page is available in English further down.
      </p>

      {/* ── 1. The form ─────────────────────────────────────────────────── */}
      <section aria-labelledby="solicitar" className="mb-14">
        <h2 id="solicitar" className="text-xl font-semibold mb-2">
          1. Solicita la eliminación
        </h2>
        <p className="text-gray-700 leading-relaxed mb-5">
          Completa el formulario con el correo, el teléfono o el usuario de Instagram que
          usaste para contactarnos. Recibirás un código de confirmación al instante.
        </p>
        <RequestForm />
      </section>

      {/* ── 2. Other ways ───────────────────────────────────────────────── */}
      <section aria-labelledby="otras-formas" className="mb-14">
        <h2 id="otras-formas" className="text-xl font-semibold mb-4">
          2. Otras formas de pedirlo
        </h2>
        <ul className="space-y-4 text-gray-700 leading-relaxed">
          <li>
            <strong className="block">Desde Messenger o Instagram</strong>
            Responde <strong>ELIMINAR</strong> (o <strong>DELETE</strong>) en la misma
            conversación. El asistente deja de escribirte de inmediato y tu solicitud
            queda registrada.
          </li>
          <li>
            <strong className="block">Por correo electrónico</strong>
            Escribe a{" "}
            <a href={`mailto:${CONTACT_EMAIL}?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20datos`} className="text-blue-600 underline">
              {CONTACT_EMAIL}
            </a>{" "}
            con el asunto «Eliminación de datos».
          </li>
          <li>
            <strong className="block">Desde tu cuenta de Facebook</strong>
            Ve a <em>Configuración y privacidad → Configuración → Aplicaciones y sitios
            web</em>, selecciona nuestra aplicación y elige <em>Eliminar</em>. Facebook nos
            envía la solicitud automáticamente y la procesamos sin que tengas que escribirnos.
          </li>
        </ul>
      </section>

      {/* ── 3. Scope ────────────────────────────────────────────────────── */}
      <section aria-labelledby="que-eliminamos" className="mb-14">
        <h2 id="que-eliminamos" className="text-xl font-semibold mb-4">
          3. Qué eliminamos y qué conservamos
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 p-5">
            <h3 className="font-semibold mb-2 text-gray-900">Se elimina</h3>
            <ul className="list-disc pl-5 space-y-1 text-gray-700 text-sm leading-relaxed">
              <li>Historial de Facebook Messenger e Instagram</li>
              <li>Nombre, correo electrónico y teléfono</li>
              <li>Preferencias de búsqueda y propiedades guardadas</li>
              <li>Notas y actividad de tu perfil en nuestro CRM</li>
              <li>Suscripciones a SMS, WhatsApp y correo</li>
            </ul>
          </div>
          <div className="rounded-lg border border-gray-200 p-5">
            <h3 className="font-semibold mb-2 text-gray-900">Se conserva</h3>
            <ul className="list-disc pl-5 space-y-1 text-gray-700 text-sm leading-relaxed">
              <li>
                Registros de transacciones inmobiliarias cerradas, cuando la ley de Florida
                nos obliga a conservarlos
              </li>
              <li>
                Un registro mínimo de tu baja, para no volver a contactarte por error
              </li>
            </ul>
            <p className="mt-3 text-xs text-gray-500 leading-relaxed">
              Nada de lo que conservamos se usa para marketing ni se comparte con terceros.
            </p>
          </div>
        </div>
        <p className="mt-5 text-gray-700 leading-relaxed">
          Procesamos toda solicitud dentro de los <strong>30 días</strong>. Los datos de
          Facebook e Instagram normalmente se eliminan de forma automática e inmediata.
        </p>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section aria-labelledby="faq" className="mb-14">
        <h2 id="faq" className="text-xl font-semibold mb-5">
          Preguntas frecuentes
        </h2>
        <dl className="space-y-6">
          {FAQS.map(f => (
            <div key={f.q}>
              <dt className="font-semibold text-gray-900 mb-1">{f.q}</dt>
              <dd className="text-gray-700 leading-relaxed">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── English ─────────────────────────────────────────────────────── */}
      <section aria-labelledby="english" className="mb-14 border-t border-gray-200 pt-10">
        <h2 id="english" className="text-xl font-semibold mb-4">
          In English — How to delete your data
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          Catherine Gomez Realtor is a licensed real estate business in Miami, Florida. To
          request deletion of the personal data we hold about you — including your Facebook
          Messenger and Instagram conversation history, your name, email, phone number and
          property preferences — choose any of these:
        </p>
        <ol className="list-decimal pl-6 space-y-2 text-gray-700 leading-relaxed mb-4">
          <li>Submit the form at the top of this page.</li>
          <li>
            Reply <strong>DELETE</strong> in the Messenger or Instagram conversation.
          </li>
          <li>
            Email{" "}
            <a href={`mailto:${CONTACT_EMAIL}?subject=Data%20Deletion%20Request`} className="text-blue-600 underline">
              {CONTACT_EMAIL}
            </a>
            .
          </li>
          <li>
            In Facebook, go to <em>Settings &amp; Privacy → Settings → Apps and Websites</em>,
            select our app and choose <em>Remove</em>. Facebook notifies us automatically.
          </li>
        </ol>
        <p className="text-gray-700 leading-relaxed">
          All requests are processed within <strong>30 days</strong>. Facebook and Instagram
          message data is normally deleted immediately and automatically. We retain only
          closed real estate transaction records where Florida law requires it, and a minimal
          opt-out record so we do not contact you again by mistake. Neither is used for
          marketing.
        </p>
      </section>

      <section aria-labelledby="contacto">
        <h2 id="contacto" className="text-xl font-semibold mb-3">
          Contacto
        </h2>
        <p className="text-gray-700 leading-relaxed">
          Catherine Gomez Realtor
          <br />
          Miami, Florida
          <br />
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 underline">
            {CONTACT_EMAIL}
          </a>
        </p>
        <p className="mt-6 text-sm text-gray-500">
          Consulta también nuestra{" "}
          <Link href="/privacy" className="text-blue-600 underline">
            Política de Privacidad
          </Link>
          .
        </p>
      </section>
    </main>
  )
}
