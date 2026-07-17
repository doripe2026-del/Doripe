import { requireOperator } from "../core/auth.js";
import { apiSuccess } from "../core/response.js";
import type { RouteHandler } from "../core/router.js";

export const getOperatorMe: RouteHandler = async (request, context) => {
  const operator = await requireOperator(request);
  return apiSuccess({
    operatorId: operator.user.id,
    active: true,
    scopes: operator.scopes,
  }, context.requestId, { headers: { "cache-control": "private, no-store" } });
};
