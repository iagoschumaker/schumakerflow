-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."BlockMode" AS ENUM ('BLOCK_FINAL_ONLY', 'BLOCK_ALL');

-- CreateEnum
CREATE TYPE "public"."BriefingCycleStatus" AS ENUM ('draft', 'sent', 'in_progress', 'submitted', 'archived');

-- CreateEnum
CREATE TYPE "public"."BriefingTemplateFieldType" AS ENUM ('text', 'textarea', 'date', 'month', 'time', 'money', 'number', 'select', 'boolean', 'email', 'phone', 'url');

-- CreateEnum
CREATE TYPE "public"."BriefingTemplateFieldWidth" AS ENUM ('half', 'full');

-- CreateEnum
CREATE TYPE "public"."BriefingTemplateSectionKind" AS ENUM ('single', 'repeater');

-- CreateEnum
CREATE TYPE "public"."ContractStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'FINISHED');

-- CreateEnum
CREATE TYPE "public"."ContractType" AS ENUM ('MONTHLY', 'PER_VIDEO', 'PER_PROJECT', 'ONE_OFF');

-- CreateEnum
CREATE TYPE "public"."DownloadStatus" AS ENUM ('STARTED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."ExpenseCategory" AS ENUM ('SOFTWARE', 'EQUIPMENT', 'MARKETING', 'OFFICE', 'SALARY', 'FREELANCER', 'TAX', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ExpenseStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."FileKind" AS ENUM ('PREVIEW', 'FINAL', 'RAW', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."InvoiceItemType" AS ENUM ('MONTHLY_FEE', 'VIDEO', 'PROJECT', 'ONE_OFF');

-- CreateEnum
CREATE TYPE "public"."InvoiceStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."JobStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('INVOICE_REMINDER', 'INVOICE_OVERDUE', 'WELCOME', 'PASSWORD_RESET', 'FILE_PUBLISHED', 'DOWNLOAD_BLOCKED', 'WHATSAPP_REMINDER', 'WHATSAPP_DUE_TODAY', 'WHATSAPP_OVERDUE');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('PIX', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."ProjectStatus" AS ENUM ('DRAFT', 'IN_PRODUCTION', 'IN_REVIEW', 'DELIVERED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('SUPERADMIN', 'TENANT_ADMIN', 'TENANT_STAFF', 'CLIENT_USER');

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "details" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Client" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "driveFolderId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClientAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClientInstagram" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "igUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientInstagram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Contract" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "public"."ContractType" NOT NULL,
    "status" "public"."ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "monthlyAmount" DECIMAL(10,2),
    "perVideoAmount" DECIMAL(10,2),
    "perProjectAmount" DECIMAL(10,2),
    "oneOffAmount" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "billingDay" INTEGER DEFAULT 5,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DownloadEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "clientAccessId" TEXT NOT NULL,
    "status" "public"."DownloadStatus" NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "bytesSent" BIGINT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DownloadEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Expense" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "category" "public"."ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "date" TIMESTAMP(3) NOT NULL,
    "referenceMonth" TEXT,
    "notes" TEXT,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "status" "public"."ExpenseStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."File" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "public"."FileKind" NOT NULL,
    "driveFileId" TEXT,
    "driveFolderId" TEXT,
    "mimeType" TEXT,
    "sizeBytes" BIGINT,
    "md5Hash" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "tags" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HolidayCalendar" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'BR',
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HolidayCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Invoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contractId" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" "public"."InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "pixPayload" TEXT,
    "pixQrCode" TEXT,
    "externalProvider" TEXT DEFAULT 'mercado_pago',
    "externalReference" TEXT,
    "notes" TEXT,
    "proofUrl" TEXT,
    "referenceMonth" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "type" "public"."InvoiceItemType" NOT NULL,
    "fileId" TEXT,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JobRun" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "tenantId" TEXT,
    "status" "public"."JobStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "details" TEXT,
    "error" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NotificationLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "public"."NotificationType" NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "invoiceId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "method" "public"."PaymentMethod" NOT NULL DEFAULT 'PIX',
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "transactionId" TEXT,
    "externalReference" TEXT,
    "pixPayload" TEXT,
    "pixQrCodeBase64" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "rawWebhookData" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlanTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxProjects" INTEGER,
    "maxUsers" INTEGER,
    "featureFinance" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "PlanTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Project" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "public"."ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "driveFolderId" TEXT,
    "drivePreviewFolderId" TEXT,
    "driveFinalFolderId" TEXT,
    "driveRawFolderId" TEXT,
    "driveOtherFolderId" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ShareLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "projectId" TEXT,
    "token" TEXT NOT NULL,
    "label" TEXT,
    "expiresAt" TIMESTAMP(3),
    "password" TEXT,
    "maxViews" INTEGER,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "fileId" TEXT,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "subdomain" TEXT,
    "status" "public"."TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "driveRootFolderId" TEXT,
    "driveRefreshToken" TEXT,
    "driveAccessToken" TEXT,
    "driveTokenExpiry" TIMESTAMP(3),
    "driveEmail" TEXT,
    "blockAfterDays" INTEGER NOT NULL DEFAULT 7,
    "blockMode" "public"."BlockMode" NOT NULL DEFAULT 'BLOCK_FINAL_ONLY',
    "videoBillingMode" TEXT NOT NULL DEFAULT 'CONSOLIDATED',
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "mpAccessToken" TEXT,
    "pixKey" TEXT,
    "pixKeyType" TEXT,
    "pixReceiverName" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT DEFAULT '#6366f1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "evolutionInstance" TEXT,
    "featureFinance" BOOLEAN NOT NULL DEFAULT true,
    "maxProjects" INTEGER,
    "maxUsers" INTEGER,
    "plan" TEXT,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TenantMember" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "permissions" TEXT,

    CONSTRAINT "TenantMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerifiedAt" TIMESTAMP(3),
    "resetToken" TEXT,
    "resetTokenExp" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."briefing_answers" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "groupIndex" INTEGER NOT NULL DEFAULT 0,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "briefing_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."briefing_cycles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "referenceMonth" DATE NOT NULL,
    "title" TEXT,
    "status" "public"."BriefingCycleStatus" NOT NULL DEFAULT 'draft',
    "dueDate" DATE,
    "submittedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "briefing_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."briefing_events" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "briefing_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."briefing_links" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPreview" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "opensCount" INTEGER NOT NULL DEFAULT 0,
    "lastOpenedAt" TIMESTAMP(3),

    CONSTRAINT "briefing_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."briefing_template_fields" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hint" TEXT,
    "placeholder" TEXT,
    "type" "public"."BriefingTemplateFieldType" NOT NULL,
    "options" JSONB,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "width" "public"."BriefingTemplateFieldWidth" NOT NULL DEFAULT 'half',
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "briefing_template_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."briefing_template_sections" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "public"."BriefingTemplateSectionKind" NOT NULL,
    "repeaterItemLabel" TEXT,
    "minItems" INTEGER,
    "maxItems" INTEGER,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "briefing_template_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."briefing_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "briefing_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "public"."AuditLog"("action" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "public"."AuditLog"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "public"."AuditLog"("entityType" ASC, "entityId" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "public"."AuditLog"("tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Client_tenantId_email_key" ON "public"."Client"("tenantId" ASC, "email" ASC);

-- CreateIndex
CREATE INDEX "Client_tenantId_idx" ON "public"."Client"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "ClientAccess_clientId_idx" ON "public"."ClientAccess"("clientId" ASC);

-- CreateIndex
CREATE INDEX "ClientAccess_tenantId_idx" ON "public"."ClientAccess"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "ClientAccess_userId_idx" ON "public"."ClientAccess"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ClientAccess_userId_tenantId_clientId_key" ON "public"."ClientAccess"("userId" ASC, "tenantId" ASC, "clientId" ASC);

-- CreateIndex
CREATE INDEX "ClientInstagram_clientId_idx" ON "public"."ClientInstagram"("clientId" ASC);

-- CreateIndex
CREATE INDEX "ClientInstagram_igUserId_idx" ON "public"."ClientInstagram"("igUserId" ASC);

-- CreateIndex
CREATE INDEX "Contract_clientId_idx" ON "public"."Contract"("clientId" ASC);

-- CreateIndex
CREATE INDEX "Contract_status_idx" ON "public"."Contract"("status" ASC);

-- CreateIndex
CREATE INDEX "Contract_tenantId_idx" ON "public"."Contract"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "Contract_type_idx" ON "public"."Contract"("type" ASC);

-- CreateIndex
CREATE INDEX "DownloadEvent_clientAccessId_idx" ON "public"."DownloadEvent"("clientAccessId" ASC);

-- CreateIndex
CREATE INDEX "DownloadEvent_fileId_idx" ON "public"."DownloadEvent"("fileId" ASC);

-- CreateIndex
CREATE INDEX "DownloadEvent_startedAt_idx" ON "public"."DownloadEvent"("startedAt" ASC);

-- CreateIndex
CREATE INDEX "DownloadEvent_tenantId_idx" ON "public"."DownloadEvent"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "public"."Expense"("date" ASC);

-- CreateIndex
CREATE INDEX "Expense_referenceMonth_idx" ON "public"."Expense"("referenceMonth" ASC);

-- CreateIndex
CREATE INDEX "Expense_status_idx" ON "public"."Expense"("status" ASC);

-- CreateIndex
CREATE INDEX "Expense_tenantId_idx" ON "public"."Expense"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "File_kind_idx" ON "public"."File"("kind" ASC);

-- CreateIndex
CREATE INDEX "File_projectId_idx" ON "public"."File"("projectId" ASC);

-- CreateIndex
CREATE INDEX "File_publishedAt_idx" ON "public"."File"("publishedAt" ASC);

-- CreateIndex
CREATE INDEX "File_tenantId_idx" ON "public"."File"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "HolidayCalendar_country_state_idx" ON "public"."HolidayCalendar"("country" ASC, "state" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "HolidayCalendar_date_country_state_key" ON "public"."HolidayCalendar"("date" ASC, "country" ASC, "state" ASC);

-- CreateIndex
CREATE INDEX "Invoice_clientId_idx" ON "public"."Invoice"("clientId" ASC);

-- CreateIndex
CREATE INDEX "Invoice_contractId_idx" ON "public"."Invoice"("contractId" ASC);

-- CreateIndex
CREATE INDEX "Invoice_dueDate_idx" ON "public"."Invoice"("dueDate" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_externalReference_key" ON "public"."Invoice"("externalReference" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_idempotencyKey_key" ON "public"."Invoice"("idempotencyKey" ASC);

-- CreateIndex
CREATE INDEX "Invoice_referenceMonth_idx" ON "public"."Invoice"("referenceMonth" ASC);

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "public"."Invoice"("status" ASC);

-- CreateIndex
CREATE INDEX "Invoice_tenantId_idx" ON "public"."Invoice"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "public"."InvoiceItem"("invoiceId" ASC);

-- CreateIndex
CREATE INDEX "JobRun_idempotencyKey_idx" ON "public"."JobRun"("idempotencyKey" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "JobRun_idempotencyKey_key" ON "public"."JobRun"("idempotencyKey" ASC);

-- CreateIndex
CREATE INDEX "JobRun_jobName_idx" ON "public"."JobRun"("jobName" ASC);

-- CreateIndex
CREATE INDEX "JobRun_tenantId_idx" ON "public"."JobRun"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "NotificationLog_invoiceId_idx" ON "public"."NotificationLog"("invoiceId" ASC);

-- CreateIndex
CREATE INDEX "NotificationLog_tenantId_idx" ON "public"."NotificationLog"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "NotificationLog_type_idx" ON "public"."NotificationLog"("type" ASC);

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "public"."Payment"("invoiceId" ASC);

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "public"."Payment"("status" ASC);

-- CreateIndex
CREATE INDEX "Payment_tenantId_idx" ON "public"."Payment"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "Payment_transactionId_idx" ON "public"."Payment"("transactionId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PlanTemplate_name_key" ON "public"."PlanTemplate"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PlanTemplate_slug_key" ON "public"."PlanTemplate"("slug" ASC);

-- CreateIndex
CREATE INDEX "Project_clientId_idx" ON "public"."Project"("clientId" ASC);

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "public"."Project"("status" ASC);

-- CreateIndex
CREATE INDEX "Project_tenantId_idx" ON "public"."Project"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "ShareLink_fileId_idx" ON "public"."ShareLink"("fileId" ASC);

-- CreateIndex
CREATE INDEX "ShareLink_projectId_idx" ON "public"."ShareLink"("projectId" ASC);

-- CreateIndex
CREATE INDEX "ShareLink_tenantId_idx" ON "public"."ShareLink"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "ShareLink_token_idx" ON "public"."ShareLink"("token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_token_key" ON "public"."ShareLink"("token" ASC);

-- CreateIndex
CREATE INDEX "Tenant_slug_idx" ON "public"."Tenant"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "public"."Tenant"("slug" ASC);

-- CreateIndex
CREATE INDEX "Tenant_subdomain_idx" ON "public"."Tenant"("subdomain" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_subdomain_key" ON "public"."Tenant"("subdomain" ASC);

-- CreateIndex
CREATE INDEX "TenantMember_tenantId_idx" ON "public"."TenantMember"("tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TenantMember_tenantId_userId_key" ON "public"."TenantMember"("tenantId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "TenantMember_userId_idx" ON "public"."TenantMember"("userId" ASC);

-- CreateIndex
CREATE INDEX "User_email_idx" ON "public"."User"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "briefing_answers_cycleId_fieldId_groupIndex_key" ON "public"."briefing_answers"("cycleId" ASC, "fieldId" ASC, "groupIndex" ASC);

-- CreateIndex
CREATE INDEX "briefing_answers_cycleId_idx" ON "public"."briefing_answers"("cycleId" ASC);

-- CreateIndex
CREATE INDEX "briefing_cycles_clientId_idx" ON "public"."briefing_cycles"("clientId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "briefing_cycles_tenantId_clientId_templateId_referenceMonth_key" ON "public"."briefing_cycles"("tenantId" ASC, "clientId" ASC, "templateId" ASC, "referenceMonth" ASC);

-- CreateIndex
CREATE INDEX "briefing_cycles_tenantId_referenceMonth_idx" ON "public"."briefing_cycles"("tenantId" ASC, "referenceMonth" ASC);

-- CreateIndex
CREATE INDEX "briefing_cycles_tenantId_status_idx" ON "public"."briefing_cycles"("tenantId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "briefing_events_cycleId_idx" ON "public"."briefing_events"("cycleId" ASC);

-- CreateIndex
CREATE INDEX "briefing_links_cycleId_idx" ON "public"."briefing_links"("cycleId" ASC);

-- CreateIndex
CREATE INDEX "briefing_links_tokenHash_idx" ON "public"."briefing_links"("tokenHash" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "briefing_links_tokenHash_key" ON "public"."briefing_links"("tokenHash" ASC);

-- CreateIndex
CREATE INDEX "briefing_template_fields_sectionId_idx" ON "public"."briefing_template_fields"("sectionId" ASC);

-- CreateIndex
CREATE INDEX "briefing_template_sections_templateId_idx" ON "public"."briefing_template_sections"("templateId" ASC);

-- CreateIndex
CREATE INDEX "briefing_templates_tenantId_idx" ON "public"."briefing_templates"("tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "briefing_templates_tenantId_slug_key" ON "public"."briefing_templates"("tenantId" ASC, "slug" ASC);

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Client" ADD CONSTRAINT "Client_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientAccess" ADD CONSTRAINT "ClientAccess_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientAccess" ADD CONSTRAINT "ClientAccess_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientAccess" ADD CONSTRAINT "ClientAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientInstagram" ADD CONSTRAINT "ClientInstagram_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contract" ADD CONSTRAINT "Contract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contract" ADD CONSTRAINT "Contract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DownloadEvent" ADD CONSTRAINT "DownloadEvent_clientAccessId_fkey" FOREIGN KEY ("clientAccessId") REFERENCES "public"."ClientAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DownloadEvent" ADD CONSTRAINT "DownloadEvent_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "public"."File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DownloadEvent" ADD CONSTRAINT "DownloadEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Expense" ADD CONSTRAINT "Expense_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."File" ADD CONSTRAINT "File_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."File" ADD CONSTRAINT "File_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "public"."Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvoiceItem" ADD CONSTRAINT "InvoiceItem_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "public"."File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NotificationLog" ADD CONSTRAINT "NotificationLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShareLink" ADD CONSTRAINT "ShareLink_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "public"."File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShareLink" ADD CONSTRAINT "ShareLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShareLink" ADD CONSTRAINT "ShareLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TenantMember" ADD CONSTRAINT "TenantMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TenantMember" ADD CONSTRAINT "TenantMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."briefing_answers" ADD CONSTRAINT "briefing_answers_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "public"."briefing_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."briefing_answers" ADD CONSTRAINT "briefing_answers_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "public"."briefing_template_fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."briefing_cycles" ADD CONSTRAINT "briefing_cycles_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."briefing_cycles" ADD CONSTRAINT "briefing_cycles_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."briefing_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."briefing_cycles" ADD CONSTRAINT "briefing_cycles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."briefing_events" ADD CONSTRAINT "briefing_events_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "public"."briefing_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."briefing_links" ADD CONSTRAINT "briefing_links_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "public"."briefing_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."briefing_template_fields" ADD CONSTRAINT "briefing_template_fields_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "public"."briefing_template_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."briefing_template_sections" ADD CONSTRAINT "briefing_template_sections_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."briefing_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."briefing_templates" ADD CONSTRAINT "briefing_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

