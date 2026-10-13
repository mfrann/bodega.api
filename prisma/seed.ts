import bcrypt from "bcryptjs";
import { prisma } from "../src/config/prisma";

async function seedAdmin() {
  const email = process.env["SEED_ADMIN_EMAIL"];
  const password = process.env["SEED_ADMIN_PASSWORD"];

  if (!email || !password || password.length < 12) {
    throw new Error(
      "Define SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD (mínimo 12 caracteres) en .env",
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  //upsert: si el correo existe no lo duplica

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: "Administrador", email, passwordHash, role: "ADMIN" },
  });

  console.log(`ADMIN listo: ${email}`);
}

async function seedCatalog() {
  const admin = await prisma.user.findFirstOrThrow({
    where: { role: "ADMIN" },
  });

  const categoryNames = ["Bebidas", "Snacks", "Abarrotes"];
  const categories = new Map<string, number>();

  for (const name of categoryNames) {
    const category = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    categories.set(name, category.id);
  }

  const products = [
    {
      name: "Gaseosa 500 ml",
      sku: "BEB-001",
      category: "Bebidas",
      price: "3.50",
      cost: "2.20",
      stock: 24,
      minStock: 6,
    },
    {
      name: "Agua mineral 625 ml",
      sku: "BEB-002",
      category: "Bebidas",
      price: "2.00",
      cost: "1.20",
      stock: 30,
      minStock: 10,
    },
    {
      name: "Galletas de vainilla",
      sku: "SNK-001",
      category: "Snacks",
      price: "1.50",
      cost: "0.90",
      stock: 40,
      minStock: 10,
    },
    {
      name: "Arroz 1 kg",
      sku: "ABA-001",
      category: "Abarrotes",
      price: "4.80",
      cost: "3.90",
      stock: 20,
      minStock: 5,
    },
    {
      name: "Aceite 1 L",
      sku: "ABA-002",
      category: "Abarrotes",
      price: "9.50",
      cost: "7.80",
      stock: 3,
      minStock: 5,
    },
  ];

  for (const p of products) {
    const exists = await prisma.product.findUnique({ where: { sku: p.sku } });
    if (exists) continue;

    await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: p.name,
          sku: p.sku,
          categoryId: categories.get(p.category)!,
          price: p.price,
          cost: p.cost,
          stock: p.stock,
          minStock: p.minStock,
        },
      });

      await tx.stockMovement.create({
        data: {
          productId: product.id,
          type: "IN",
          quantity: p.stock,
          reason: "INITIAL_STOCK",
          userId: admin.id,
        },
      });
    });
  }

  console.log("Catalogo de prueba listo");
}

async function main() {
  await seedAdmin();
  await seedCatalog();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
