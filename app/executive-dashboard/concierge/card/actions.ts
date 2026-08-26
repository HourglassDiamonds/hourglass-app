"use server";

import { saveAuthenticatedDigitalCard } from "@/lib/continuum/digital-card/load";
import {
  myCardFormValuesFromFormData,
  saveDigitalCardInputFromValues,
  type MyCardFormValues,
} from "@/lib/continuum/digital-card/form-state";
import type {
  DigitalCard,
  SaveDigitalCardFieldErrors,
} from "@/lib/continuum/digital-card/types";

export type SaveOwnerCardState =
  | {
      status: "saved";
      card: DigitalCard;
      message: string;
      values?: undefined;
      fieldErrors?: undefined;
    }
  | {
      status: "error";
      message: string;
      values: MyCardFormValues;
      fieldErrors: SaveDigitalCardFieldErrors;
      card?: undefined;
    };

export async function saveOwnerCard(
  _prev: SaveOwnerCardState | null,
  formData: FormData,
): Promise<SaveOwnerCardState> {
  const values = myCardFormValuesFromFormData(formData);
  const result = await saveAuthenticatedDigitalCard(
    saveDigitalCardInputFromValues(values),
  );

  if (result.status === "saved") {
    return { status: "saved", card: result.card, message: "Saved." };
  }
  if (result.status === "unauthorized") {
    return {
      status: "error",
      message: "Sign in to continue.",
      values,
      fieldErrors: {},
    };
  }
  if (result.status === "validation-error") {
    return {
      status: "error",
      message: result.message,
      values,
      fieldErrors: result.fieldErrors,
    };
  }
  return {
    status: "error",
    message: "Unable to save the card.",
    values,
    fieldErrors: {},
  };
}
