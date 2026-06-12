-- CreateTable
CREATE TABLE "InstagramConversation" (
    "id" TEXT NOT NULL,
    "igUserId" TEXT NOT NULL,
    "igUsername" TEXT,
    "state" TEXT NOT NULL DEFAULT 'ASKED_NAME',
    "firstName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "contactId" TEXT,
    "sourceCommentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramBotConfig" (
    "id" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "triggerKeywords" TEXT NOT NULL DEFAULT 'info,INFO,más info,mas info,interesado,precio,price,interested,details,detalles',
    "msgGreeting" TEXT NOT NULL DEFAULT 'Hola! 👋 Soy Sofia, asistente de Catherine Gomez Realtor. Vi que te interesan propiedades en Miami. ¿Cuál es tu nombre completo?',
    "msgAskEmail" TEXT NOT NULL DEFAULT 'Mucho gusto, {name}! ¿Me puedes dar tu email para enviarte las propiedades disponibles?',
    "msgAskPhone" TEXT NOT NULL DEFAULT 'Perfecto! ¿Y tu número de teléfono para que Catherine te contacte personalmente?',
    "msgThankYou" TEXT NOT NULL DEFAULT '¡Excelente {name}! Ya tenemos tu información. Catherine te contactará muy pronto con las mejores opciones en Miami. 🏠✨',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramBotConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstagramConversation_igUserId_key" ON "InstagramConversation"("igUserId");
