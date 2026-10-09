import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "../utils/AppError";

// si ninguna ruta coincide devuelve un error 404 y lo pasa al manejador con next(...)
export const notFound: RequestHandler = (req, _res, next) => {
  next(
    new AppError(
      404,
      `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
      "NOT_FOUND",
    ),
  );
};

//convierte errores en respuestas, ("_") -> lo recibo pero no lo uso
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Error interno del servidor" },
  });
};
