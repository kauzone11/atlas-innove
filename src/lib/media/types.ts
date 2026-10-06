export type MediaDto = { id: string; width: number; height: number; url: string; srcSet: string; detailUrl: string };
export type SocialPostMediaDto = MediaDto & { mediaId: string; altText: string | null; position: number };
export type MediaVariant = "small" | "medium" | "large";
export type MediaDerivative = { key: string; width: number; height: number; sizeBytes: number };
export type MediaDerivatives = Record<MediaVariant, MediaDerivative>;
