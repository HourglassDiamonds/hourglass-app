/** Preload for live JPG integration tests — cold OCR can exceed the 8s default. */
process.env.CLIENT_DOCUMENT_EXTRACT_TIMEOUT_MS ??= "15000";
process.env.CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS ??= "32000";
