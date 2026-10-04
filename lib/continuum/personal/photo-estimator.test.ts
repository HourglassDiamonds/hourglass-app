import assert from "node:assert/strict";
import { it } from "node:test";
import { UnavailablePhotoNutritionEstimator } from "./photo-estimator";
it("never fabricates nutrition when no provider is configured", async () => { const result = await new UnavailablePhotoNutritionEstimator().estimate({ image: new File([], "meal.jpg") }); assert.equal(result.status, "unavailable"); assert.equal(result.calories, undefined); assert.ok(result.ambiguities.length > 0); });
