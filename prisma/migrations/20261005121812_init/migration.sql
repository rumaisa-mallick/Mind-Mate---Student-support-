-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "countryCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" DATETIME
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "city" TEXT,
    "university" TEXT,
    "degree" TEXT,
    "degreeLevel" TEXT,
    "currentSemester" INTEGER,
    "enrollmentStatus" TEXT,
    "field" TEXT,
    "graduationYear" INTEGER,
    "ageAtSignup" INTEGER,
    "documentsOnHand" TEXT,
    "profileComplete" BOOLEAN NOT NULL DEFAULT false,
    "profileVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AcademicProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cgpa" REAL,
    "cgpaScale" REAL NOT NULL DEFAULT 4.0,
    "field" TEXT,
    "qualification" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AcademicProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinancialProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "incomeBandCode" TEXT,
    "incomePeriod" TEXT NOT NULL DEFAULT 'MONTHLY',
    "earners" INTEGER,
    "dependents" INTEGER,
    "tuitionAnnual" REAL,
    "otherDebt" REAL,
    "accommodationStatus" TEXT,
    "accommodationAnnual" REAL,
    "existingAidCoverage" TEXT,
    "assistanceRequired" BOOLEAN NOT NULL DEFAULT false,
    "consentToUseForMatching" BOOLEAN NOT NULL DEFAULT false,
    "needScore" INTEGER,
    "needBand" TEXT,
    "weightSetVersion" INTEGER,
    "scoredAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinancialProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IncomeBandConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryCode" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minAmount" REAL NOT NULL,
    "maxAmount" REAL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "ScoringWeightSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" INTEGER NOT NULL,
    "effectiveFrom" DATETIME NOT NULL,
    "weights" TEXT NOT NULL,
    "anchors" TEXT NOT NULL,
    "bands" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WellbeingCheckin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "moodCode" TEXT NOT NULL,
    "stressLevel" INTEGER NOT NULL,
    "sleepHours" REAL,
    "note" TEXT,
    "consentToAnalyze" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WellbeingCheckin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CheckinFactor" (
    "checkinId" TEXT NOT NULL,
    "factorCode" TEXT NOT NULL,

    PRIMARY KEY ("checkinId", "factorCode"),
    CONSTRAINT "CheckinFactor_checkinId_fkey" FOREIGN KEY ("checkinId") REFERENCES "WellbeingCheckin" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConcernAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checkinId" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "engineMode" TEXT NOT NULL DEFAULT 'RULES',
    "scores" TEXT NOT NULL,
    "dominantConcern" TEXT,
    "confidence" REAL,
    "evidence" TEXT,
    "crisisDetected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConcernAnalysis_checkinId_fkey" FOREIGN KEY ("checkinId") REFERENCES "WellbeingCheckin" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "countryCode" TEXT,
    "city" TEXT,
    "description" TEXT,
    "categories" TEXT,
    "deadline" DATETIME,
    "applyUrl" TEXT,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "stipendMin" REAL,
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "sourceUrl" TEXT,
    "lastVerifiedAt" DATETIME,
    "verifiedById" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Opportunity_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OpportunityCriterion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "opportunityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "weight" REAL NOT NULL DEFAULT 0,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "OpportunityCriterion_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OpportunityDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "opportunityId" TEXT NOT NULL,
    "docCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    CONSTRAINT "OpportunityDocument_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Scholarship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "opportunityId" TEXT NOT NULL,
    "tuitionCoverage" TEXT,
    "tuitionCoveragePercent" REAL,
    "coversLiving" BOOLEAN NOT NULL DEFAULT false,
    "coversTravel" BOOLEAN NOT NULL DEFAULT false,
    "stipendAmount" REAL,
    "currency" TEXT,
    "renewable" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Scholarship_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "profileVersion" INTEGER NOT NULL,
    "inputHash" TEXT NOT NULL,
    "candidateCount" INTEGER NOT NULL,
    "eligibleCount" INTEGER NOT NULL,
    "durationMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatchRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScholarshipMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchRunId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "eligible" BOOLEAN NOT NULL,
    "disqualifiers" TEXT,
    "score" REAL,
    "breakdown" TEXT,
    "reasons" TEXT,
    "nearMiss" BOOLEAN NOT NULL DEFAULT false,
    "rank" INTEGER,
    CONSTRAINT "ScholarshipMatch_matchRunId_fkey" FOREIGN KEY ("matchRunId") REFERENCES "MatchRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScholarshipMatch_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'INTERESTED',
    "completedDocs" TEXT,
    "notes" TEXT,
    "submittedAt" DATETIME,
    "reminderAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Application_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedOpportunity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedOpportunity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedOpportunity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "url" TEXT,
    "audienceTags" TEXT,
    "evidenceBased" BOOLEAN NOT NULL DEFAULT false,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewDueAt" DATETIME,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SupportService" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "org" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'PK',
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "openingHours" TEXT,
    "languages" TEXT,
    "isEmergency" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "lastVerifiedAt" DATETIME,
    "requiresVerification" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE INDEX "ConsentRecord_userId_scope_idx" ON "ConsentRecord"("userId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentRecord_userId_scope_policyVersion_key" ON "ConsentRecord"("userId", "scope", "policyVersion");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicProfile_userId_key" ON "AcademicProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialProfile_userId_key" ON "FinancialProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IncomeBandConfig_countryCode_currency_code_key" ON "IncomeBandConfig"("countryCode", "currency", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ScoringWeightSet_version_key" ON "ScoringWeightSet"("version");

-- CreateIndex
CREATE INDEX "WellbeingCheckin_userId_createdAt_idx" ON "WellbeingCheckin"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConcernAnalysis_checkinId_key" ON "ConcernAnalysis"("checkinId");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_slug_key" ON "Opportunity"("slug");

-- CreateIndex
CREATE INDEX "Opportunity_type_isActive_deadline_idx" ON "Opportunity"("type", "isActive", "deadline");

-- CreateIndex
CREATE INDEX "Opportunity_verificationStatus_lastVerifiedAt_idx" ON "Opportunity"("verificationStatus", "lastVerifiedAt");

-- CreateIndex
CREATE INDEX "OpportunityCriterion_opportunityId_idx" ON "OpportunityCriterion"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityDocument_opportunityId_docCode_key" ON "OpportunityDocument"("opportunityId", "docCode");

-- CreateIndex
CREATE UNIQUE INDEX "Scholarship_opportunityId_key" ON "Scholarship"("opportunityId");

-- CreateIndex
CREATE INDEX "MatchRun_userId_createdAt_idx" ON "MatchRun"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MatchRun_userId_inputHash_idx" ON "MatchRun"("userId", "inputHash");

-- CreateIndex
CREATE INDEX "ScholarshipMatch_userId_eligible_score_idx" ON "ScholarshipMatch"("userId", "eligible", "score");

-- CreateIndex
CREATE UNIQUE INDEX "ScholarshipMatch_matchRunId_opportunityId_key" ON "ScholarshipMatch"("matchRunId", "opportunityId");

-- CreateIndex
CREATE INDEX "Application_userId_stage_idx" ON "Application"("userId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "Application_userId_opportunityId_key" ON "Application"("userId", "opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedOpportunity_userId_opportunityId_key" ON "SavedOpportunity"("userId", "opportunityId");

-- CreateIndex
CREATE INDEX "SupportService_type_countryCode_isEmergency_idx" ON "SupportService"("type", "countryCode", "isEmergency");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
