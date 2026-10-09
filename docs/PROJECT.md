# PROYECTO: API de inventario y ventas para una bodega pequeña

> Documento vivo. Versión 3: ajustes de diseño acordados + base de datos en Supabase (sin Docker). Fase 0 completada.

## 1. Definición

API REST con:

- Autenticación
- Roles
- Control de stock
- Reportes simples

**Tipo de proyecto:** MVP mediano, personal / portafolio, greenfield.

## 2. Stack

- Node.js + TypeScript (`strict`)
- Express
- PostgreSQL alojado en **Supabase** (solo como base de datos: no se usa Supabase Auth ni su API automática; la autenticación la hace nuestra API con JWT)
- Prisma (ORM)
- Zod (validación runtime, incluida la de variables de entorno)
- JWT
- argon2 o bcrypt (hash de passwords)
- Vitest + supertest (tests)
- Docker: **fuera del plan por ahora** (equipo con recursos limitados). Se puede añadir al final como práctica opcional.

## 3. MVP

- Registrar y autenticar usuarios con roles **ADMIN** y **EMPLEADO**.
- Gestionar productos y categorías.
- Registrar ventas, con descuento automático de stock.
- Registrar ingresos de mercadería (reposición).
- Consultar historial de movimientos de stock y alertas de stock bajo.
- Reporte básico de ventas por día y producto.

**Fuera del MVP (a propósito):** refresh tokens, Redis, colas, microservicios, caché. Ninguno resuelve un problema real en este alcance.

## 4. Arquitectura

Arquitectura modular por features, con capas **aplicadas de forma selectiva**:

```text
Cliente (Postman / futuro front)
        │
   [ Routes ]        URLs y middlewares
        │
 [ Controllers ]     recibe request, responde HTTP
        │
  [ Services ]       lógica de negocio (reglas, transacciones)
        │
 [ Repository ]      SOLO en sales, stock y reports
        │
 Prisma → PostgreSQL
```

| Módulo | Flujo |
|---|---|
| `users`, `categories`, `products`, `auth` | Controller → Service → Prisma directo |
| `sales`, `stock`, `reports` | Controller → Service → Repository → Prisma |

**Por qué:** Prisma ya es una capa de acceso a datos. Un repository por módulo suele ser código que solo reenvía llamadas y complica las transacciones (hay que pasar `tx` por todas partes). Se usa donde hay transacciones o SQL complejo.

### Estructura de carpetas

```text
src/
├── config/          # variables de entorno (validadas con Zod), conexión DB
├── modules/
│   ├── auth/        # routes, controller, service, schemas
│   ├── users/
│   ├── products/
│   ├── categories/
│   ├── sales/       # + repository
│   ├── stock/       # + repository
│   └── reports/     # + repository
├── middlewares/     # auth, roles, errorHandler, validate
├── utils/           # AppError, logger, helpers
├── app.ts           # configura Express
└── server.ts        # levanta el servidor
prisma/
├── schema.prisma
└── seed.ts          # primer ADMIN + datos de prueba
tests/
.env.example
README.md
```

## 5. Modelo de datos (ajustado)

**Dinero:** siempre `Decimal(10,2)`, nunca `Float`.

```text
users            id, name, email (unique), password_hash, role (ADMIN | EMPLEADO),
                 active, created_at

categories       id, name (unique)

products         id, name, sku (unique), category_id, price, cost,
                 stock, min_stock, active, created_at, updated_at
                 CHECK (stock >= 0)

sales            id, user_id, total, payment_method,
                 status (COMPLETED | CANCELLED),
                 cancelled_at (nullable), cancelled_by (nullable, FK users),
                 created_at

sale_items       id, sale_id, product_id, quantity, unit_price, subtotal
                 (unit_price = snapshot del precio al momento de la venta)

stock_movements  id, product_id, type (IN | OUT | ADJUSTMENT),
                 quantity (FIRMADA), reason, user_id,
                 sale_id (nullable), created_at
```

### Convención de `stock_movements.quantity`

`quantity` va **siempre con signo**:

- `IN` → positivo
- `OUT` → negativo
- `ADJUSTMENT` → positivo o negativo según el delta

Así `SUM(quantity)` por producto debe coincidir con `products.stock`, lo que permite **auditar** que no hubo desincronización.

## 6. Decisiones de diseño

| # | Decisión | Razón |
|---|---|---|
| 1 | Dinero con `Decimal` | Evita errores de centavos de los floats |
| 2 | `products.stock` + `stock_movements` | Consulta rápida + historial. Obliga a actualizar ambos **en la misma transacción** |
| 3 | Descuento de stock atómico | `updateMany({ where: { id, stock: { gte: qty } }, data: { stock: { decrement: qty } } })` y verificar `count === 1`. Evita stock negativo con ventas concurrentes |
| 4 | `CHECK (stock >= 0)` en DB | Red de seguridad si falla la lógica de aplicación |
| 5 | `sales.status` + `cancelled_at` + `cancelled_by` | Distinguir ventas canceladas en listados y reportes |
| 6 | Cancelación de venta | Transacción: marca la venta como `CANCELLED`, devuelve stock con movimientos `IN` (`reason: "SALE_CANCELLED"`, con `sale_id`). Un tipo `RETURN` sería más explícito; para el MVP basta `IN` + reason |
| 7 | Soft delete de productos | `DELETE /products/:id` → `active = false`. Hay FKs desde `sale_items` y `stock_movements` |
| 8 | `GET /stock/low` con `$queryRaw` | Prisma no compara dos columnas (`stock <= min_stock`) en `where` |
| 9 | Ajustes de stock | Añadir `POST /stock/adjustments` (ADMIN) con delta firmado y `reason` obligatorio |
| 10 | Reportes con zona horaria del negocio | Agrupar "por día" en UTC desplaza las ventas nocturnas al día siguiente. Definir `BUSINESS_TIMEZONE` en `.env` |
| 11 | Reportes con rango de fechas | Query params `from` y `to` validados con Zod |

### Reglas de autorización

- **EMPLEADO** ve solo **sus** ventas; **ADMIN** ve todas.
- El **primer ADMIN** se crea con `seed.ts` (porque `/auth/register` exige ser ADMIN).
- El login rechaza usuarios con `active = false`.
- El middleware de auth verifica el estado del usuario en la base de datos, no solo el token.
- Rate limiting solo en `/auth/login`.

## 7. Endpoints

| Módulo | Método y ruta | Acceso |
|---|---|---|
| Auth | `POST /auth/login` | Público |
| Auth | `POST /auth/register` | Solo ADMIN |
| Productos | `GET /products` (filtros, paginación, búsqueda) | Autenticado |
| Productos | `POST /products`, `PATCH /products/:id`, `DELETE /products/:id` (soft delete) | ADMIN |
| Categorías | `GET /categories` | Autenticado |
| Categorías | `POST /categories`, `PATCH /categories/:id` | ADMIN |
| Ventas | `POST /sales` | Autenticado |
| Ventas | `GET /sales`, `GET /sales/:id` (EMPLEADO: solo las suyas) | Autenticado |
| Ventas | `POST /sales/:id/cancel` | ADMIN |
| Stock | `POST /stock/entries` (ingreso de mercadería) | ADMIN |
| Stock | `POST /stock/adjustments` (ajuste con delta firmado) | ADMIN |
| Stock | `GET /stock/movements`, `GET /stock/low` | Autenticado |
| Reportes | `GET /reports/daily-sales`, `GET /reports/top-products` | ADMIN |

Convenciones: respuestas con estructura consistente, códigos HTTP correctos (`201` al crear, `409` en conflictos como SKU/email duplicado, `422` en errores de validación), errores centralizados con `AppError` + middleware global, sin stack traces ni detalles internos en producción.

## 8. Plan de trabajo

Un commit (o más) por fase, con mensajes tipo `feat:`, `fix:`, `test:`, `docs:`.

| Fase | Contenido |
|---|---|
| 0 ✅ | Setup: TS strict, Express, `.env.example`, validación de env con Zod, `AppError` + error handler global, `/health` |
| 1 | Conexión a Supabase (`DATABASE_URL` + `DIRECT_URL`), Prisma, `schema.prisma` ajustado + migración inicial, protección de tablas (RLS / API de Supabase), `seed.ts` (admin, categorías, productos) |
| 2 | Auth: login, middleware JWT, middleware de roles, register |
| 3 | Categorías y productos (CRUD, paginación, búsqueda, soft delete) |
| 4 | Stock: ingresos, ajustes, movimientos, stock bajo |
| 5 | Ventas con transacción, descuento atómico y cancelación (núcleo del proyecto) |
| 6 | Reportes |
| 7 | Tests de lo crítico (stock insuficiente, concurrencia, cancelación, autorización por rol), README y OpenAPI |

## 9. Testing (qué priorizar)

- Venta con stock insuficiente.
- Dos ventas concurrentes sobre el mismo producto.
- Cancelación: devuelve stock y no se puede cancelar dos veces.
- Consistencia: `SUM(stock_movements.quantity)` = `products.stock`.
- Autorización por rol (EMPLEADO no accede a rutas ADMIN ni a ventas ajenas).
- Login con usuario inactivo.

## 10. Variables de entorno (`.env.example`)

Estado actual (fase 0):

```text
NODE_ENV=development
PORT=3000
JWT_SECRET=change-me-with-at-least-32-characters
JWT_EXPIRES_IN=1h
BUSINESS_TIMEZONE=America/Lima
```

Se añaden en la fase 1 (Supabase + Prisma):

```text
DATABASE_URL=   # conexión por pooler, usada por la app
DIRECT_URL=     # conexión directa o session pooler, usada por las migraciones
```

Ningún secret va en el código; solo en variables de entorno. `.env` está en `.gitignore`.

## 11. Seguridad con Supabase

Supabase expone por defecto las tablas del esquema `public` mediante su propia API. Como solo accederemos a la base desde nuestra API Express, al crear las tablas (fase 1) hay que activar RLS o desactivar esa API para que nadie pueda leer los datos sin pasar por el backend.

## 12. Progreso

- [x] Fase 0: esqueleto, env validado con Zod, errores centralizados, `/health`
- [ ] Fase 1: base de datos y Prisma
- [ ] Fases 2 a 7
