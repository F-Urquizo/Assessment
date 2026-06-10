-- CreateEnum
CREATE TYPE "AuditEvent" AS ENUM ('register', 'login_success', 'login_failure', 'logout', 'token_rotated', 'refresh_reuse_detected', 'email_verified', 'role_changed');

-- CreateTable
CREATE TABLE "auth_audit_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "event" "AuditEvent" NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auth_audit_log_userId_idx" ON "auth_audit_log"("userId");

-- CreateIndex
CREATE INDEX "auth_audit_log_event_idx" ON "auth_audit_log"("event");

-- CreateIndex
CREATE INDEX "auth_audit_log_createdAt_idx" ON "auth_audit_log"("createdAt");

-- AddForeignKey
ALTER TABLE "auth_audit_log" ADD CONSTRAINT "auth_audit_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
