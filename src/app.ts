//armamos la API

import express from "express";
import { errorHandler, notFound } from "./middlewares/errorHandler";

export const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(notFound);
app.use(errorHandler);
