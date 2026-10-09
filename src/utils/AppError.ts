// Aca definimos como falla la API, el cliente nunca vera ldetalles internos

export class AppError extends Error {
  // El constructor de la clase AppError recibe un statusCode,
  // un mensaje, un código de error y detalles opcionales.
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = "ERROR",
    public readonly details?: unknown,
  ) {
    // Llamamos al constructor de la clase base Error con el mensaje proporcionado.
    super(message);
    this.name = "AppError"; // Establecemos el nombre del error como "AppError" para identificarlo fácilmente.
  }
}
