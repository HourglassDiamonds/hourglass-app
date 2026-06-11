import { getSupabaseAdmin } from "./client";

export const DI_SUBMISSIONS_BUCKET = "diamond-intelligence-submissions";
export const DI_SUBMISSIONS_SCHEMA_VERSION = 1;

export type DiamondIntelligenceSubmissionStatus =
  | "success"
  | "partial"
  | "unable_to_verify"
  | "parser_failure"
  | "timeout"
  | "unsupported_report";

export type DiamondIntelligenceSubmissionInsert = {
  id?: string;
  status: DiamondIntelligenceSubmissionStatus;
  httpStatus: number;
  cacheHit?: boolean;
  reportNumber?: string | null;
  lab?: string | null;
  shape?: string | null;
  carat?: string | null;
  color?: string | null;
  clarity?: string | null;
  cut?: string | null;
  polish?: string | null;
  symmetry?: string | null;
  fluorescence?: string | null;
  measurements?: string | null;
  parserFamily?: string | null;
  parserPath?: string | null;
  ocrUsed?: boolean;
  ocrConfidence?: Record<string, unknown> | null;
  extractionConfidence?: Record<string, unknown> | null;
  missingFields?: string[];
  opticalTier?: string | null;
  purchaseRecommendation?: string | null;
  percentileScope?: string | null;
  warnings?: string[];
  errorCode?: string | null;
  failureReason?: string | null;
  sourceFilename?: string | null;
  fileMime?: string | null;
  fileSizeBytes?: number | null;
  fileSha256?: string | null;
  filePath?: string | null;
  pageImagePaths?: string[];
  rawExtractedText?: string | null;
  rawFieldsJson?: Record<string, unknown> | null;
  finalOutputJson?: Record<string, unknown> | null;
  renderAudit?: Record<string, unknown> | null;
  uploadMetadata?: Record<string, unknown>;
  sourceType?: "upload" | "url";
  sourceUrl?: string | null;
  vendor?: string | null;
  listingId?: string | null;
  listingPrice?: number | null;
  listingCurrency?: string | null;
  listingExtractionJson?: Record<string, unknown> | null;
  reportUrl?: string | null;
  urlIngestionStatus?: string | null;
  urlIngestionWarnings?: string[];
};

export function isDiamondIntelligenceArchiveAvailable(): boolean {
  return getSupabaseAdmin() !== null;
}

function toRow(input: DiamondIntelligenceSubmissionInsert) {
  return {
    id: input.id,
    status: input.status,
    http_status: input.httpStatus,
    cache_hit: input.cacheHit ?? false,
    report_number: input.reportNumber ?? null,
    lab: input.lab ?? null,
    shape: input.shape ?? null,
    carat: input.carat ?? null,
    color: input.color ?? null,
    clarity: input.clarity ?? null,
    cut: input.cut ?? null,
    polish: input.polish ?? null,
    symmetry: input.symmetry ?? null,
    fluorescence: input.fluorescence ?? null,
    measurements: input.measurements ?? null,
    parser_family: input.parserFamily ?? null,
    parser_path: input.parserPath ?? null,
    ocr_used: input.ocrUsed ?? false,
    ocr_confidence: input.ocrConfidence ?? null,
    extraction_confidence: input.extractionConfidence ?? null,
    missing_fields: input.missingFields ?? [],
    optical_tier: input.opticalTier ?? null,
    purchase_recommendation: input.purchaseRecommendation ?? null,
    percentile_scope: input.percentileScope ?? null,
    warnings: input.warnings ?? [],
    error_code: input.errorCode ?? null,
    failure_reason: input.failureReason ?? null,
    source_filename: input.sourceFilename ?? null,
    file_mime: input.fileMime ?? null,
    file_size_bytes: input.fileSizeBytes ?? null,
    file_sha256: input.fileSha256 ?? null,
    file_path: input.filePath ?? null,
    page_image_paths: input.pageImagePaths ?? [],
    raw_extracted_text: input.rawExtractedText ?? null,
    raw_fields_json: input.rawFieldsJson ?? null,
    final_output_json: input.finalOutputJson ?? null,
    render_audit: input.renderAudit ?? null,
    upload_metadata: input.uploadMetadata ?? {},
    source_type: input.sourceType ?? "upload",
    source_url: input.sourceUrl ?? null,
    vendor: input.vendor ?? null,
    listing_id: input.listingId ?? null,
    listing_price: input.listingPrice ?? null,
    listing_currency: input.listingCurrency ?? null,
    listing_extraction_json: input.listingExtractionJson ?? null,
    report_url: input.reportUrl ?? null,
    url_ingestion_status: input.urlIngestionStatus ?? null,
    url_ingestion_warnings: input.urlIngestionWarnings ?? [],
    schema_version: DI_SUBMISSIONS_SCHEMA_VERSION,
  };
}

export async function uploadDiamondIntelligenceSubmissionFile(input: {
  submissionId: string;
  bytes: Buffer;
  mime: string;
  sourceFilename?: string;
}): Promise<string> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const ext = extensionForMime(input.mime, input.sourceFilename);
  const objectPath = `${input.submissionId}/original${ext}`;

  const { error } = await supabase.storage
    .from(DI_SUBMISSIONS_BUCKET)
    .upload(objectPath, input.bytes, {
      contentType: input.mime,
      upsert: false,
    });

  if (error) {
    throw new Error(`DI archive upload failed: ${error.message}`);
  }

  return objectPath;
}

export async function insertDiamondIntelligenceSubmission(
  input: DiamondIntelligenceSubmissionInsert,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const { data, error } = await supabase
    .from("diamond_intelligence_submissions")
    .insert(toRow(input))
    .select("id")
    .single();

  if (error) {
    throw new Error(`DI archive insert failed: ${error.message}`);
  }

  return data.id as string;
}

function extensionForMime(mime: string, sourceFilename?: string): string {
  const fromName = sourceFilename?.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase();
  if (fromName) return fromName;

  switch (mime) {
    case "application/pdf":
      return ".pdf";
    case "image/jpeg":
    case "image/jpg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/heic":
      return ".heic";
    case "image/heif":
      return ".heif";
    default:
      return ".bin";
  }
}
