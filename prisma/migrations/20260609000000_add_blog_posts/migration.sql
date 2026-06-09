CREATE TABLE "BlogPost" (
    "id"          TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "slug"        TEXT NOT NULL,
    "excerpt"     TEXT,
    "content"     TEXT NOT NULL,
    "coverImage"  TEXT,
    "author"      TEXT NOT NULL DEFAULT 'Catherine Gomez',
    "tags"        TEXT NOT NULL DEFAULT '[]',
    "featured"    BOOLEAN NOT NULL DEFAULT false,
    "published"   BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");
