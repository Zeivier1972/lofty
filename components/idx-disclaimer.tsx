// Required IDX / Broker Reciprocity disclaimer for displaying MLS listing data.
export function IdxDisclaimer() {
  const year = new Date().getFullYear()
  return (
    <div className="text-[11px] text-gray-400 leading-relaxed border-t border-gray-200 pt-4 mt-8">
      <p>
        La información de las propiedades es proporcionada por el MIAMI Association of REALTORS®
        (Broker Reciprocity℠ / IDX). Las propiedades pueden estar listadas por firmas de bienes raíces
        distintas a Catherine Gomez Realtor. La información se considera confiable pero no está garantizada
        y debe verificarse de forma independiente. Igualdad de Oportunidad de Vivienda (Equal Housing Opportunity).
        © {year} MIAMI MLS. Todos los derechos reservados.
      </p>
    </div>
  )
}
