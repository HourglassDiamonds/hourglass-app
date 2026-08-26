/**
 * My Card form display model.
 * Failed validation must replay submitted values, never blank persisted defaults.
 */

import { DIGITAL_CARD_LINK_LABEL_MAX } from "./types";
import type {
  DigitalCard,
  SaveDigitalCardField,
  SaveDigitalCardFieldErrors,
  SaveDigitalCardInput,
} from "./types";
import {
  parseHttpsUrl,
  parseHttpUrl,
  parseInstagramUrl,
  trimToNull,
} from "./urls";

export type MyCardFormValues = {
  displayName: string;
  memorableTitle: string;
  professionalTitle: string;
  company: string;
  email: string;
  emailPublic: boolean;
  phone: string;
  phonePublic: boolean;
  websiteUrl: string;
  linkedinUrl: string;
  instagramUrl: string;
  avatarUrl: string;
  slug: string;
  published: boolean;
  link1Label: string;
  link1Url: string;
  link2Label: string;
  link2Url: string;
};

export const MY_CARD_FIELD_ORDER: SaveDigitalCardField[] = [
  "displayName",
  "memorableTitle",
  "professionalTitle",
  "company",
  "email",
  "phone",
  "websiteUrl",
  "linkedinUrl",
  "instagramUrl",
  "link1Label",
  "link1Url",
  "link2Label",
  "link2Url",
  "avatarUrl",
  "slug",
];

export function emptyMyCardFormValues(): MyCardFormValues {
  return {
    displayName: "",
    memorableTitle: "",
    professionalTitle: "",
    company: "",
    email: "",
    emailPublic: true,
    phone: "",
    phonePublic: true,
    websiteUrl: "",
    linkedinUrl: "",
    instagramUrl: "",
    avatarUrl: "",
    slug: "",
    published: false,
    link1Label: "",
    link1Url: "",
    link2Label: "",
    link2Url: "",
  };
}

export function myCardFormValuesFromCard(card: DigitalCard | null): MyCardFormValues {
  const empty = emptyMyCardFormValues();
  if (!card) return empty;
  return {
    displayName: card.displayName,
    memorableTitle: card.memorableTitle ?? "",
    professionalTitle: card.professionalTitle ?? "",
    company: card.company ?? "",
    email: card.email ?? "",
    emailPublic: card.emailPublic,
    phone: card.phone ?? "",
    phonePublic: card.phonePublic,
    websiteUrl: card.websiteUrl ?? "",
    linkedinUrl: card.linkedinUrl ?? "",
    instagramUrl: card.instagramUrl ?? "",
    avatarUrl: card.avatarUrl ?? "",
    slug: card.slug,
    published: card.published,
    link1Label: card.additionalLinks[0]?.label ?? "",
    link1Url: card.additionalLinks[0]?.url ?? "",
    link2Label: card.additionalLinks[1]?.label ?? "",
    link2Url: card.additionalLinks[1]?.url ?? "",
  };
}

function readChecked(formData: FormData, name: string): boolean {
  const raw = String(formData.get(name) ?? "");
  return raw === "true" || raw === "on" || raw === "1";
}

export function myCardFormValuesFromFormData(formData: FormData): MyCardFormValues {
  return {
    displayName: String(formData.get("displayName") ?? ""),
    memorableTitle: String(formData.get("memorableTitle") ?? ""),
    professionalTitle: String(formData.get("professionalTitle") ?? ""),
    company: String(formData.get("company") ?? ""),
    email: String(formData.get("email") ?? ""),
    emailPublic: readChecked(formData, "emailPublic"),
    phone: String(formData.get("phone") ?? ""),
    phonePublic: readChecked(formData, "phonePublic"),
    websiteUrl: String(formData.get("websiteUrl") ?? ""),
    linkedinUrl: String(formData.get("linkedinUrl") ?? ""),
    instagramUrl: String(formData.get("instagramUrl") ?? ""),
    avatarUrl: String(formData.get("avatarUrl") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    published: readChecked(formData, "published"),
    link1Label: String(formData.get("link1Label") ?? ""),
    link1Url: String(formData.get("link1Url") ?? ""),
    link2Label: String(formData.get("link2Label") ?? ""),
    link2Url: String(formData.get("link2Url") ?? ""),
  };
}

export function saveDigitalCardInputFromValues(
  values: MyCardFormValues,
): SaveDigitalCardInput {
  return {
    displayName: values.displayName,
    memorableTitle: values.memorableTitle,
    professionalTitle: values.professionalTitle,
    company: values.company,
    email: values.email,
    emailPublic: values.emailPublic,
    phone: values.phone,
    phonePublic: values.phonePublic,
    websiteUrl: values.websiteUrl,
    linkedinUrl: values.linkedinUrl,
    instagramUrl: values.instagramUrl,
    avatarUrl: values.avatarUrl,
    slug: values.slug,
    published: values.published,
    additionalLinks: [
      { label: values.link1Label, url: values.link1Url },
      { label: values.link2Label, url: values.link2Url },
    ],
  };
}

function clientAdditionalLinkErrors(
  label: string,
  url: string,
  labelKey: "link1Label" | "link2Label",
  urlKey: "link1Url" | "link2Url",
): SaveDigitalCardFieldErrors {
  const errors: SaveDigitalCardFieldErrors = {};
  const labelTrim = trimToNull(label);
  const urlTrim = trimToNull(url);
  if (!labelTrim && !urlTrim) return errors;
  if (labelTrim && labelTrim.length > DIGITAL_CARD_LINK_LABEL_MAX) {
    errors[labelKey] = "That label is too long.";
  }
  if (!labelTrim && urlTrim) {
    errors[labelKey] = "Enter a label for this link.";
  }
  const urlResult = parseHttpUrl(url);
  if (urlTrim && !urlResult.ok) {
    errors[urlKey] = "Enter a valid URL for this link.";
  }
  if (!urlTrim && labelTrim) {
    errors[urlKey] = "Enter a URL for this link.";
  }
  return errors;
}

export function clientMyCardFieldErrors(
  values: MyCardFormValues,
): SaveDigitalCardFieldErrors {
  const errors: SaveDigitalCardFieldErrors = {};
  if (!trimToNull(values.displayName)) {
    errors.displayName = "Enter a name.";
  }
  if (!parseHttpUrl(values.websiteUrl).ok) {
    errors.websiteUrl = "Enter a valid website URL.";
  }
  if (!parseHttpUrl(values.linkedinUrl).ok) {
    errors.linkedinUrl = "Enter a valid LinkedIn URL.";
  }
  if (!parseInstagramUrl(values.instagramUrl).ok) {
    errors.instagramUrl = "Enter a valid Instagram URL or handle.";
  }
  if (!parseHttpsUrl(values.avatarUrl).ok) {
    errors.avatarUrl = "Portrait must use an HTTPS URL.";
  }
  Object.assign(
    errors,
    clientAdditionalLinkErrors(values.link1Label, values.link1Url, "link1Label", "link1Url"),
    clientAdditionalLinkErrors(values.link2Label, values.link2Url, "link2Label", "link2Url"),
  );
  return errors;
}

export function optionalUrlIsAbsent(raw: string | null | undefined): boolean {
  return trimToNull(raw) == null;
}

export function optionalHttpUrlOk(raw: string | null | undefined): boolean {
  return parseHttpUrl(raw).ok;
}

export function optionalHttpsUrlOk(raw: string | null | undefined): boolean {
  return parseHttpsUrl(raw).ok;
}

export function optionalInstagramOk(raw: string | null | undefined): boolean {
  return parseInstagramUrl(raw).ok;
}

export type MyCardFormDisplay = {
  values: MyCardFormValues;
  fieldErrors: SaveDigitalCardFieldErrors;
  summary: string | null;
  saved: boolean;
  formKey: string;
};

export function resolveMyCardFormDisplay(input: {
  card: DigitalCard | null;
  submitted?: MyCardFormValues | null;
  fieldErrors?: SaveDigitalCardFieldErrors | null;
  status?: "saved" | "error" | null;
  message?: string | null;
  savedAt?: string | null;
}): MyCardFormDisplay {
  if (input.status === "error" && input.submitted) {
    return {
      values: input.submitted,
      fieldErrors: input.fieldErrors ?? {},
      summary: input.message ?? "Check the highlighted fields.",
      saved: false,
      formKey: `error:${input.savedAt ?? "pending"}:${input.message ?? ""}`,
    };
  }
  if (input.status === "saved" && input.card) {
    return {
      values: myCardFormValuesFromCard(input.card),
      fieldErrors: {},
      summary: input.message ?? "Saved.",
      saved: true,
      formKey: `saved:${input.card.updatedAt}`,
    };
  }
  return {
    values: myCardFormValuesFromCard(input.card),
    fieldErrors: {},
    summary: null,
    saved: false,
    formKey: `loaded:${input.card?.updatedAt ?? "new"}`,
  };
}
