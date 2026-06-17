"use client"

import { useState } from "react"
import { HelpCircle, X, Clock, CheckCircle, Lightbulb, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface HelpStep {
  label: string
  description: string
}

interface HelpSection {
  title: string
  what: string
  how: HelpStep[]
  when: string
  tip?: string
}

const HELP_CONTENT: Record<string, HelpSection> = {
  dashboard: {
    title: "Dashboard",
    what: "Tu centro de comando. Muestra tus KPIs del día: contactos nuevos, tareas pendientes, citas y valor del pipeline.",
    how: [
      { label: "KPIs superiores", description: "Total de contactos, nuevos leads esta semana, valor del pipeline y volumen cerrado." },
      { label: "Tareas pendientes", description: "Haz clic en cualquier tarea para marcarla como completada o abrirla." },
      { label: "Próximas citas", description: "Muestra tus citas de hoy y mañana. Haz clic para ver los detalles del contacto." },
      { label: "Actividad reciente", description: "Últimas acciones del sistema: leads captados, mensajes enviados, posts publicados." },
    ],
    when: "Cada mañana — toma 30 segundos revisar el estado del negocio.",
  },
  contacts: {
    title: "Contactos",
    what: "Tu base de datos completa de leads y clientes. Todo el mundo que llena un formulario, te escribe, o agregas manualmente aparece aquí.",
    how: [
      { label: "Buscar y filtrar", description: "Busca por nombre, teléfono o email. Filtra por etapa del pipeline, fuente o etiqueta." },
      { label: "Lead Score", description: "El número 0–100 junto a cada contacto indica qué tan 'caliente' está el lead. Llama primero a los de mayor score." },
      { label: "Abrir un contacto", description: "Haz clic en el nombre para ver historial completo: llamadas, mensajes, notas, propiedades guardadas." },
      { label: "Agregar nota", description: "Dentro del contacto, escribe una nota después de cada interacción. El AI extrae tareas y criterios de búsqueda automáticamente." },
    ],
    when: "Antes de cada llamada — revisa el historial del contacto. Después de cada llamada — agrega una nota.",
    tip: "Usa el Lead Score para priorizar tu día. Enfócate primero en scores 70+.",
  },
  pipeline: {
    title: "Pipeline",
    what: "Vista Kanban de tus leads moviéndose por etapas: Nuevo Lead → Contactado → Cita Agendada → Bajo Contrato → Cerrado.",
    how: [
      { label: "Mover un lead", description: "Arrastra la tarjeta de una columna a la siguiente cuando el lead avance de etapa." },
      { label: "Ver detalles", description: "Haz clic en cualquier tarjeta para abrir el contacto completo." },
      { label: "Limpiar leads muertos", description: "Si un lead lleva más de 30 días sin responder, muévelo a 'Frío' o archívalo." },
    ],
    when: "Revisión semanal — cada lunes, 10 minutos moviendo leads hacia adelante.",
    tip: "Un pipeline limpio = visión clara del negocio. No dejes leads estancados.",
  },
  social: {
    title: "Social Media & Auto-Pilot",
    what: "Gestiona tus cuentas de Facebook, Instagram y YouTube. El Auto-Pilot publica automáticamente todos los días.",
    how: [
      { label: "Conectar cuentas", description: "Ve a la pestaña 'Accounts'. Cada plataforma muestra su estado (conectada/desconectada)." },
      { label: "Activar Auto-Pilot", description: "Activa el toggle verde de Auto-Pilot. Desde ese momento, cada día a las 9am y 6pm ET se publican posts automáticamente." },
      { label: "Ver posts publicados", description: "La pestaña 'Posts' muestra todo lo que se ha publicado: plataforma, contenido, fecha y estado." },
      { label: "Post de mañana", description: "El sistema investiga tendencias de Miami real estate, escribe el post en español con gancho viral, genera imagen y publica. Todo automático." },
    ],
    when: "Revisa una vez por semana para confirmar que los posts se publicaron correctamente.",
    tip: "El Auto-Pilot publica: mañana (9am ET) imagen + texto en Facebook/Instagram, y martes/viernes (6pm ET) sube un video a YouTube Shorts.",
  },
  "content-studio": {
    title: "Content Studio",
    what: "Tu fábrica de contenido AI. Escribe artículos de blog, genera imágenes profesionales, crea videos con tu cara, e investiga tendencias del mercado.",
    how: [
      { label: "Blog Writer", description: "Escribe el tema o selecciona una sugerencia → genera un artículo de 600-800 palabras en español → revisa y publica. Aparece en tu blog público inmediatamente." },
      { label: "Video (tu cara)", description: "Escribe el guión → selecciona tu avatar (Catherine Face Swap, Catherine Gomez Avatar, o Catherine) → genera el video. Listo en 2-5 minutos." },
      { label: "Imágenes", description: "Describe el tipo de imagen que necesitas → genera una foto profesional de real estate Miami." },
      { label: "Posts", description: "Ver y editar todos tus artículos de blog publicados. Haz clic en Ver Blog para ver como aparece en tu sitio." },
    ],
    when: "Usa el Blog Writer cuando quieras escribir sobre una propiedad específica o tema. Videos para campañas especiales. El blog diario se genera solo automáticamente.",
    tip: "Para videos que se vean profesionales, escribe el guión como si estuvieras hablando en cámara — frases cortas, conversacional.",
  },
  dialer: {
    title: "Power Dialer",
    what: "Llama a 20-30 leads en 30 minutos. Los leads están ordenados por lead score (los más calientes primero).",
    how: [
      { label: "Iniciar sesión", description: "Haz clic en 'Initialize Phone' → luego 'Start Dialing'. El sistema llama al siguiente lead automáticamente." },
      { label: "Parallel x3", description: "Marca 3 números al mismo tiempo, te conecta con el primero que contesta. Ideal para leads fríos." },
      { label: "Tomar notas", description: "Después de cada llamada escribe lo que habló. El AI extrae automáticamente: criterios de búsqueda, tareas de seguimiento y etapa del pipeline." },
      { label: "Pausar/Continuar", description: "Puedes pausar en cualquier momento y retomar donde quedaste." },
    ],
    when: "Martes y jueves por la mañana — bloquea 45 minutos para sesión de llamadas.",
    tip: "El mejor horario para llamar en Miami: 10am-12pm y 5pm-7pm.",
  },
  "instagram-bot": {
    title: "Instagram Bot",
    what: "Responde automáticamente los DMs de Instagram cuando alguien escribe la palabra clave (ej: 'info', 'quiero info'). Captura el lead en el CRM.",
    how: [
      { label: "Configurar campaña", description: "Crea una campaña con: nombre, palabra clave que activa el bot, mensaje de bienvenida y opciones de respuesta." },
      { label: "Mensaje de bienvenida", description: "El bot envía este mensaje automáticamente cuando alguien escribe la palabra clave." },
      { label: "Captura automática", description: "El lead queda guardado en Contactos con sus datos de Instagram." },
    ],
    when: "Configura una vez. Revisa semanalmente los nuevos leads capturados.",
    tip: "Usa en tus historias de Instagram: 'Escríbeme INFO para recibir la guía gratuita'.",
  },
  "facebook-bot": {
    title: "Facebook Bot",
    what: "Igual que el bot de Instagram pero para Facebook Messenger. Responde automáticamente y captura leads 24/7.",
    how: [
      { label: "Configurar campaña", description: "Igual que Instagram: palabra clave + mensaje de bienvenida + opciones." },
      { label: "PDF de bienvenida", description: "Puedes enviar automáticamente un PDF (guía de compradores, lista de propiedades) cuando alguien escribe la clave." },
    ],
    when: "Actívalo en tus posts de Facebook con propiedades: 'Comenta INFO para recibir detalles'.",
  },
  "website-builder": {
    title: "Website Builder",
    what: "Tu sitio web público en catherinegomezrealtor.com — héroe, about, estadísticas, testimonios, blog integrado y propiedades.",
    how: [
      { label: "Editar sección", description: "Haz clic en cualquier sección del menú izquierdo (Hero, About, Stats, etc.) y edita los campos." },
      { label: "Subir foto", description: "En Agent Photo, pega una URL de imagen o sube un archivo directamente. También acepta links de Imgur." },
      { label: "Save & Publish", description: "Cada vez que guardes, los cambios se publican instantáneamente en tu sitio." },
      { label: "Preview", description: "Haz clic en 'Preview Site' para ver cómo queda antes de publicar." },
    ],
    when: "Cuando recibas un nuevo testimonio, cambies tu foto, o quieras actualizar tu bio.",
  },
  tasks: {
    title: "Tareas",
    what: "Tu lista de pendientes conectada con los contactos. El AI crea tareas automáticamente cuando analiza tus notas de llamadas.",
    how: [
      { label: "Ver por estado", description: "Filtra entre Pendientes, En Progreso y Completadas." },
      { label: "Crear tarea manual", description: "Haz clic en el contacto → 'Add Task' → escribe qué hay que hacer y cuándo." },
      { label: "Completar tarea", description: "Marca el checkbox cuando esté lista. Aparece en el Dashboard como tarea completada." },
    ],
    when: "Revisa cada mañana las tareas pendientes del día.",
  },
  calendar: {
    title: "Calendario",
    what: "Vista mensual de todas tus citas — llamadas de seguimiento, tours de propiedades, cierres, reuniones de Zoom.",
    how: [
      { label: "Ver cita", description: "Haz clic en cualquier evento para ver los detalles y el contacto asociado." },
      { label: "Crear cita", description: "Ve al contacto → 'Add Appointment' → selecciona fecha y hora." },
    ],
    when: "Revisa cada mañana para saber tu agenda del día.",
  },
  transactions: {
    title: "Transacciones",
    what: "Seguimiento de cada deal activo desde contrato hasta cierre. Hitos, documentos y precio final de venta.",
    how: [
      { label: "Nueva transacción", description: "Cuando firmes un contrato, crea la transacción vinculada al contacto." },
      { label: "Hitos", description: "Marca cada etapa completada: inspección, tasación, aprobación del préstamo, cierre." },
      { label: "Documentos", description: "Adjunta el contrato y documentos importantes directamente en la transacción." },
    ],
    when: "Inmediatamente al firmar un contrato. Actualiza hitos a medida que avanza.",
  },
  reports: {
    title: "Reportes",
    what: "Gráficas de tendencia de los últimos 6 meses — contactos, tareas, transacciones, ingresos y fuentes de leads.",
    how: [
      { label: "Tendencias", description: "Ve si tus leads están creciendo, estables o bajando mes a mes." },
      { label: "Fuentes de leads", description: "¿Dónde vienen tus mejores clientes? Instagram, Facebook, referidos, sitio web?" },
    ],
    when: "El primer día de cada mes — 5 minutos para entender cómo fue el mes anterior.",
  },
}

interface HelpPanelProps {
  section: string
  className?: string
}

export default function HelpPanel({ section, className }: HelpPanelProps) {
  const [open, setOpen] = useState(false)
  const [expandedStep, setExpandedStep] = useState<number | null>(null)
  const help = HELP_CONTENT[section]

  if (!help) return null

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-lofty-600 transition-colors px-2 py-1 rounded-lg hover:bg-lofty-50"
        title="Ayuda y entrenamiento"
      >
        <HelpCircle className="w-4 h-4" />
        <span>Ayuda</span>
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-96 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-lofty-600 to-lofty-700">
            <div>
              <p className="text-xs font-medium text-lofty-200 uppercase tracking-wide">Guía de Uso</p>
              <h3 className="text-white font-bold text-base">{help.title}</h3>
            </div>
            <button onClick={() => setOpen(false)} className="text-lofty-200 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* What */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">¿Qué es?</p>
              <p className="text-sm text-gray-700 leading-relaxed">{help.what}</p>
            </div>

            {/* How */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">¿Cómo usarlo?</p>
              <div className="space-y-1.5">
                {help.how.map((step, i) => (
                  <div key={i} className="rounded-xl border border-gray-100 overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedStep(expandedStep === i ? null : i)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-lofty-100 text-lofty-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-800">{step.label}</span>
                      </div>
                      {expandedStep === i
                        ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                        : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                    </button>
                    {expandedStep === i && (
                      <div className="px-4 pb-3 pt-0">
                        <p className="text-xs text-gray-500 leading-relaxed">{step.description}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* When */}
            <div className="flex gap-2.5 bg-blue-50 rounded-xl p-3">
              <Clock className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-blue-700 mb-0.5">¿Cuándo usarlo?</p>
                <p className="text-xs text-blue-600 leading-relaxed">{help.when}</p>
              </div>
            </div>

            {/* Tip */}
            {help.tip && (
              <div className="flex gap-2.5 bg-amber-50 rounded-xl p-3">
                <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-700 mb-0.5">Consejo Pro</p>
                  <p className="text-xs text-amber-700 leading-relaxed">{help.tip}</p>
                </div>
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-400 text-center">
              Lofty CRM · Catherine Gomez Realtor
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
