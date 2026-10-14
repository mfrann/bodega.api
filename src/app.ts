//armamos la API

import express from "express";
import { errorHandler, notFound } from "./middlewares/errorHandler";
import { authRouter } from "./modules/auth/auth.routes";

export const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);

//las rutas van antes de estas dos lineas de codigo
app.use(notFound);
app.use(errorHandler);
