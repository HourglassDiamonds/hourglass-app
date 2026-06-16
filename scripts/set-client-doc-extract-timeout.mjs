/** Preload for live JPG integration tests — align with production client doc-extract default. */
process.env.CLIENT_DOCUMENT_EXTRACT_TIMEOUT_MS ??= "45000";
process.env.CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS ??= "32000";
