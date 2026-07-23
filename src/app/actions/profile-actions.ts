"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDatabase } from "@/db";
import { userProfile } from "@/db/schema";
import { requireCurrentUser } from "@/lib/dal/session";

const profileSchema = z.object({
  riskProfile: z.enum(["CONSERVATIVE", "MODERATE", "AGGRESSIVE"]),
  monthlyContributionPercentage: z.coerce.number().int().min(0).max(100),
});

export interface ProfileActionState {
  success: boolean;
  message: string;
}

export async function updateProfileAction(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const currentUser = await requireCurrentUser();
  const parsedProfile = profileSchema.safeParse({
    riskProfile: formData.get("riskProfile"),
    monthlyContributionPercentage: formData.get(
      "monthlyContributionPercentage",
    ),
  });

  if (!parsedProfile.success) {
    return {
      success: false,
      message: "Revise o perfil e o percentual mensal informado.",
    };
  }

  await getDatabase()
    .insert(userProfile)
    .values({
      userId: currentUser.id,
      riskProfile: parsedProfile.data.riskProfile,
      monthlyContributionPercentage:
        parsedProfile.data.monthlyContributionPercentage,
      onboardingCompleted: true,
    })
    .onConflictDoUpdate({
      target: userProfile.userId,
      set: {
        riskProfile: parsedProfile.data.riskProfile,
        monthlyContributionPercentage:
          parsedProfile.data.monthlyContributionPercentage,
        onboardingCompleted: true,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/perfil");
  revalidatePath("/painel");
  revalidatePath("/acoes");
  revalidatePath("/fiis");

  return {
    success: true,
    message: "Preferências salvas.",
  };
}
