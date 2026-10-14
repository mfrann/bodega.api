import type { RequestHandler } from "express";
import * as authService from "./auth.service";

export const login: RequestHandler = async (req, res) => {
  const result = await authService.login(req.body);
  res.json(result);
};
