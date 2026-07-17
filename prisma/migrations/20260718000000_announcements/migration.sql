-- Team hub announcements (SOP — internal comms). Fully additive: three brand-new
-- tables and one new enum. No existing model, column, index or constraint is
-- touched, so this is safe to deploy against production out of band.
--
-- authorId / userId hold User.id values but are deliberately plain columns with
-- no FK to "User" — matching the Prisma schema, which keeps this feature a pure
-- add-on. Reactions and acks DO cascade-delete with their Announcement.

-- CreateEnum
CREATE TYPE "AnnouncementAudience" AS ENUM ('ALL', 'PROVIDERS', 'ADMINS');

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorLabel" TEXT NOT NULL,
    "audience" "AnnouncementAudience" NOT NULL DEFAULT 'ALL',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementReaction" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementAck" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementAck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Announcement_pinned_createdAt_idx" ON "Announcement"("pinned", "createdAt");

-- CreateIndex
CREATE INDEX "Announcement_authorId_idx" ON "Announcement"("authorId");

-- CreateIndex
CREATE INDEX "Announcement_audience_idx" ON "Announcement"("audience");

-- CreateIndex
CREATE INDEX "AnnouncementReaction_announcementId_idx" ON "AnnouncementReaction"("announcementId");

-- CreateIndex
CREATE INDEX "AnnouncementReaction_userId_idx" ON "AnnouncementReaction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementReaction_announcementId_userId_emoji_key" ON "AnnouncementReaction"("announcementId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "AnnouncementAck_announcementId_idx" ON "AnnouncementAck"("announcementId");

-- CreateIndex
CREATE INDEX "AnnouncementAck_userId_idx" ON "AnnouncementAck"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementAck_announcementId_userId_key" ON "AnnouncementAck"("announcementId", "userId");

-- AddForeignKey
ALTER TABLE "AnnouncementReaction" ADD CONSTRAINT "AnnouncementReaction_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementAck" ADD CONSTRAINT "AnnouncementAck_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
