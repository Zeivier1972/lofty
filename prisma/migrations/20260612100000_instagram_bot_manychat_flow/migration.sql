-- Add intent to conversations
ALTER TABLE "InstagramConversation" ADD COLUMN IF NOT EXISTS "intent" TEXT;

-- New config fields for the qualification flow
ALTER TABLE "InstagramBotConfig" ADD COLUMN IF NOT EXISTS "msgAskIntent" TEXT NOT NULL DEFAULT E'¡Perfecto! 🎉 Antes de enviarte la información, para ayudarte mejor... ¿Estás interesado en:\n\nA) Comprar para vivir\nB) Invertir para Airbnb\nC) Solo explorando\n\nResponde A, B o C';
ALTER TABLE "InstagramBotConfig" ADD COLUMN IF NOT EXISTS "msgAskName" TEXT NOT NULL DEFAULT '¡Excelente! ¿Cuál es tu nombre completo?';
ALTER TABLE "InstagramBotConfig" ADD COLUMN IF NOT EXISTS "websiteUrl" TEXT NOT NULL DEFAULT 'https://catherinegomezrealtor.com';

-- Update existing config row to the new ManyChat-style flow copy
UPDATE "InstagramBotConfig" SET
  "triggerKeywords" = 'info,más info,mas info,interesado,precio,price,interested,details,detalles,casa,comprar,invest,miami,hola,interesa,preconstruccion,preconstrucción',
  "msgGreeting" = E'¡Hola! 👋 Gracias por tu interés en nuestros proyectos en Miami y Homestead. ¿Te gustaría recibir nuestra lista exclusiva de casas en preconstrucción o nuestro paquete de inversión para Airbnb y rentas cortas? Responde SÍ y te la envío 🏠',
  "msgAskEmail" = 'Mucho gusto, {name}! Para enviarte el catálogo completo y planos de los proyectos, ¿me puedes escribir tu correo electrónico? 📧',
  "msgAskPhone" = '¡Perfecto! Una última cosa... ¿Podrías compartirme tu número de teléfono con código de país? Ejemplo: +1 786 123 4567 📱 (usa el número correcto, no te vamos a molestar)',
  "msgThankYou" = '¡Muchas gracias {name}! 🙌 Ya tenemos tu información. Catherine te contactará muy pronto con las mejores opciones. Mientras tanto puedes visitar nuestra página web: {website}';

-- Reset any in-progress conversations to the new flow
UPDATE "InstagramConversation" SET "state" = 'ASKED_OPTIN' WHERE "state" IN ('ASKED_NAME', 'ASKED_EMAIL', 'ASKED_PHONE');
