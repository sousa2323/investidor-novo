import "server-only";

import { eq } from "drizzle-orm";

import { getDatabase } from "@/db";
import { userProfile } from "@/db/schema";
import { requireCurrentUser } from "@/lib/dal/session";
import type { RiskProfile } from "@/types/investment";

export interface UserProfileDto {
  riskProfile: RiskProfile;
  monthlyContributionPercentage: number;
  onboardingCompleted: boolean;
}

export async function getUserProfileDto(): Promise<UserProfileDto> {
  const currentUser = await requireCurrentUser();
  const profileRecord = await getDatabase().query.userProfile.findFirst({
    where: eq(userProfile.userId, currentUser.id),
    columns: {
      riskProfile: true,
      monthlyContributionPercentage: true,
      onboardingCompleted: true,
    },
  });

  return {
    riskProfile: profileRecord?.riskProfile ?? "MODERATE",
    monthlyContributionPercentage:
      profileRecord?.monthlyContributionPercentage ?? 20,
    onboardingCompleted: profileRecord?.onboardingCompleted ?? false,
  };
}
