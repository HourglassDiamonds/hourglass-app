export type ShapeStudioSessionStatus =
  | "pending"
  | "image_uploaded"
  | "expired";

export type ShapeStudioSessionRecord = {
  sessionId: string;
  status: ShapeStudioSessionStatus;
  imagePath: string | null;
  imageMime: string | null;
  createdAt: string;
  expiresAt: string;
};

export type CreateSessionResult = {
  sessionId: string;
  capturePath: string;
  expiresAt: string;
};

export type SessionPollResult = {
  sessionId: string;
  status: ShapeStudioSessionStatus;
  expiresAt: string;
  imageUrl?: string;
};
