import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  WebAuthnCredential,
} from "@simplewebauthn/server";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import {
  CONTINUUM_WEBAUTHN_RP_NAME,
  CONTINUUM_WEBAUTHN_USER_DISPLAY_NAME,
  CONTINUUM_WEBAUTHN_USER_NAME,
  PASSKEY_WEBAUTHN_TIMEOUT_MS,
  founderWebAuthnUserIdBytes,
} from "./config";
import type { FounderPasskeyRecord } from "./types";

export type PasskeyRegistrationBeginInput = {
  rpID: string;
  excludeCredentialIds: { id: string; transports?: string[] }[];
};

export type PasskeyRegistrationVerifyInput = {
  response: RegistrationResponseJSON;
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRPID: string;
};

export type PasskeyRegistrationVerifyResult =
  | { verified: false }
  | {
      verified: true;
      credential: WebAuthnCredential;
      deviceType: string;
      backedUp: boolean;
      origin: string;
      rpID: string | undefined;
    };

export type PasskeyAuthenticationBeginInput = {
  rpID: string;
  allowCredentials: { id: string; transports?: string[] }[];
};

export type PasskeyAuthenticationVerifyInput = {
  response: AuthenticationResponseJSON;
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRPID: string;
  credential: FounderPasskeyRecord;
};

export type PasskeyAuthenticationVerifyResult =
  | { verified: false; reason: "origin-mismatch" | "rp-mismatch" | "challenge-mismatch" | "counter-invalid" | "verify-failed" }
  | {
      verified: true;
      newCounter: number;
      backedUp: boolean;
      deviceType: string;
    };

export type PasskeyCrypto = {
  generateRegistrationOptions(
    input: PasskeyRegistrationBeginInput,
  ): Promise<PublicKeyCredentialCreationOptionsJSON>;
  verifyRegistrationResponse(
    input: PasskeyRegistrationVerifyInput,
  ): Promise<PasskeyRegistrationVerifyResult>;
  generateAuthenticationOptions(
    input: PasskeyAuthenticationBeginInput,
  ): Promise<PublicKeyCredentialRequestOptionsJSON>;
  verifyAuthenticationResponse(
    input: PasskeyAuthenticationVerifyInput,
  ): Promise<PasskeyAuthenticationVerifyResult>;
};

function asTransports(
  value: string[] | undefined,
): AuthenticatorTransportFuture[] | undefined {
  if (!value || value.length === 0) return undefined;
  return value as AuthenticatorTransportFuture[];
}

export const simpleWebAuthnCrypto: PasskeyCrypto = {
  async generateRegistrationOptions(input) {
    return generateRegistrationOptions({
      rpName: CONTINUUM_WEBAUTHN_RP_NAME,
      rpID: input.rpID,
      userName: CONTINUUM_WEBAUTHN_USER_NAME,
      userDisplayName: CONTINUUM_WEBAUTHN_USER_DISPLAY_NAME,
      userID: new Uint8Array(founderWebAuthnUserIdBytes()),
      timeout: PASSKEY_WEBAUTHN_TIMEOUT_MS,
      attestationType: "none",
      excludeCredentials: input.excludeCredentialIds.map((item) => ({
        id: item.id,
        transports: asTransports(item.transports),
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
    });
  },

  async verifyRegistrationResponse(input) {
    try {
      const result = await verifyRegistrationResponse({
        response: input.response,
        expectedChallenge: input.expectedChallenge,
        expectedOrigin: input.expectedOrigin,
        expectedRPID: input.expectedRPID,
        requireUserVerification: true,
      });
      if (!result.verified || !result.registrationInfo) {
        return { verified: false };
      }
      const info = result.registrationInfo;
      if (info.origin !== input.expectedOrigin) {
        return { verified: false };
      }
      if (info.rpID && info.rpID !== input.expectedRPID) {
        return { verified: false };
      }
      return {
        verified: true,
        credential: info.credential,
        deviceType: info.credentialDeviceType,
        backedUp: info.credentialBackedUp,
        origin: info.origin,
        rpID: info.rpID,
      };
    } catch {
      return { verified: false };
    }
  },

  async generateAuthenticationOptions(input) {
    return generateAuthenticationOptions({
      rpID: input.rpID,
      timeout: PASSKEY_WEBAUTHN_TIMEOUT_MS,
      userVerification: "required",
      allowCredentials: input.allowCredentials.map((item) => ({
        id: item.id,
        transports: asTransports(item.transports),
      })),
    });
  },

  async verifyAuthenticationResponse(input) {
    try {
      const result = await verifyAuthenticationResponse({
        response: input.response,
        expectedChallenge: input.expectedChallenge,
        expectedOrigin: input.expectedOrigin,
        expectedRPID: input.expectedRPID,
        requireUserVerification: true,
        credential: {
          id: input.credential.credentialId,
          publicKey: new Uint8Array(input.credential.publicKey),
          counter: input.credential.counter,
          transports: asTransports(input.credential.transports ?? undefined),
        },
      });
      if (!result.verified) {
        return { verified: false, reason: "verify-failed" };
      }
      const info = result.authenticationInfo;
      if (info.origin !== input.expectedOrigin) {
        return { verified: false, reason: "origin-mismatch" };
      }
      if (info.rpID !== input.expectedRPID) {
        return { verified: false, reason: "rp-mismatch" };
      }
      return {
        verified: true,
        newCounter: info.newCounter,
        backedUp: info.credentialBackedUp,
        deviceType: info.credentialDeviceType,
      };
    } catch {
      return { verified: false, reason: "verify-failed" };
    }
    },
};
