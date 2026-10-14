import { Router } from "express";
import { validateBody } from "../../middlewares/validate";
import { login } from "./auth.controller";
import { loginSchema } from "./auth.schemas";

export const authRouter = Router();

authRouter.post("/login", validateBody(loginSchema), login);
