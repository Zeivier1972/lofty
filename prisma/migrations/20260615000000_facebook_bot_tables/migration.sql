-- Facebook Bot: config, conversations, and campaigns tables

CREATE TABLE IF NOT EXISTS "FacebookBotConfig" (
  "id"              TEXT NOT NULL,
  "isEnabled"       BOOLEAN NOT NULL DEFAULT false,
  "triggerKeywords" TEXT NOT NULL DEFAULT 'info,precio,interesado,quiero,casa,propiedad,apartamento,más info,mas info,comprar,miami,invest',
  "msgGreeting"     TEXT NOT NULL DEFAULT '¡Hola! 👋 Gracias por tu interés. Te enviamos un mensaje privado con información sobre propiedades en Miami. ¡Revisa tu bandeja de entrada de Messenger!',
  "msgAskIntent"    TEXT NOT NULL DEFAULT '¡Perfecto! Para ayudarte mejor, ¿qué estás buscando?\n\nA) Comprar para vivir\nB) Invertir (Airbnb/renta)\nC) Solo explorando',
  "msgAskName"      TEXT NOT NULL DEFAULT '¡Genial! ¿Cuál es tu nombre completo?',
  "msgAskEmail"     TEXT NOT NULL DEFAULT 'Mucho gusto, {name}! ¿Cuál es tu correo electrónico? 📧',
  "msgAskPhone"     TEXT NOT NULL DEFAULT '¡Casi listo! ¿Me das tu número de teléfono con código de país? Ej: +1 786 123 4567 📱',
  "msgThankYou"     TEXT NOT NULL DEFAULT '¡Muchas gracias {name}! 🙌 Catherine te contactará muy pronto. Visita: {website}',
  "sendListings"    BOOLEAN NOT NULL DEFAULT true,
  "websiteUrl"      TEXT NOT NULL DEFAULT '',
  "greetingButtons" TEXT NOT NULL DEFAULT 'Sí, me interesa,Quiero más info',
  "intentButtonA"   TEXT NOT NULL DEFAULT 'Comprar para vivir',
  "intentButtonB"   TEXT NOT NULL DEFAULT 'Invertir / Airbnb',
  "intentButtonC"   TEXT NOT NULL DEFAULT 'Solo explorando',
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FacebookBotConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FacebookBotConversation" (
  "id"              TEXT NOT NULL,
  "psid"            TEXT NOT NULL,
  "pageId"          TEXT NOT NULL DEFAULT '',
  "state"           TEXT NOT NULL DEFAULT 'ASKED_OPTIN',
  "intent"          TEXT,
  "firstName"       TEXT,
  "email"           TEXT,
  "phone"           TEXT,
  "sourceCommentId" TEXT,
  "contactId"       TEXT,
  "campaignKeyword" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FacebookBotConversation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FacebookBotConversation_psid_key" ON "FacebookBotConversation"("psid");

CREATE TABLE IF NOT EXISTS "FacebookBotCampaign" (
  "id"        TEXT NOT NULL,
  "keyword"   TEXT NOT NULL,
  "keywords"  TEXT NOT NULL DEFAULT '',
  "name"      TEXT NOT NULL,
  "pdfUrl"    TEXT,
  "pdfName"   TEXT,
  "greeting"  TEXT,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "leads"     INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FacebookBotCampaign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FacebookBotCampaign_keyword_key" ON "FacebookBotCampaign"("keyword");
