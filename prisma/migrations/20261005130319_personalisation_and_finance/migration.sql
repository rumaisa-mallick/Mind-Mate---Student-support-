-- AlterTable
ALTER TABLE "AcademicProfile" ADD COLUMN "hatScore" REAL;
ALTER TABLE "AcademicProfile" ADD COLUMN "hatTestDate" DATETIME;

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN "gender" TEXT;

-- CreateTable
CREATE TABLE "PersonalisationProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "primaryGoal" TEXT NOT NULL,
    "secondaryGoals" TEXT,
    "stressTriggers" TEXT,
    "supportPreference" TEXT,
    "availableHoursPerWeek" INTEGER,
    "studyStyle" TEXT,
    "commuteMinutes" INTEGER,
    "workCommitment" TEXT,
    "caresForOthers" BOOLEAN NOT NULL DEFAULT false,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "tonePreference" TEXT NOT NULL DEFAULT 'DIRECT',
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PersonalisationProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "incomeSources" TEXT NOT NULL,
    "expenses" TEXT NOT NULL,
    "annualTuition" REAL NOT NULL DEFAULT 0,
    "termsPerYear" INTEGER NOT NULL DEFAULT 2,
    "bufferTargetMonths" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BudgetPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PersonalisationProfile_userId_key" ON "PersonalisationProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetPlan_userId_key" ON "BudgetPlan"("userId");
