import { createApiRouter } from "./core/router.js";
import { v1Routes } from "./routes.js";

export const handleV1Request = createApiRouter(v1Routes);
