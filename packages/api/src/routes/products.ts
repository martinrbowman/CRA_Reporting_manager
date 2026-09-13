import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { manufacturers, products, productVersions } from '../db/schema.js';
import { CreateManufacturerSchema, UpdateManufacturerSchema, CreateProductSchema, UpdateProductSchema } from '@cra/shared';
import { audit } from '../lib/audit.js';

export default async function productRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };
  const can = (p: string) => ({ preHandler: [fastify.requirePermission(p)] });

  // ── Manufacturers ────────────────────────────────────────────────────────────

  fastify.post('/manufacturers', can('products:write'), async (req, reply) => {
    const body = CreateManufacturerSchema.parse(req.body);
    const [mfg] = await db.insert(manufacturers).values(body).returning();
    await audit(req, 'create', 'manufacturer', mfg!.manufacturerId);
    return reply.code(201).send(mfg);
  });

  fastify.get('/manufacturers', auth, async () => {
    return db.select().from(manufacturers).orderBy(manufacturers.legalName);
  });

  fastify.get('/manufacturers/:manufacturerId', auth, async (req, reply) => {
    const { manufacturerId } = req.params as { manufacturerId: string };
    const [mfg] = await db.select().from(manufacturers).where(eq(manufacturers.manufacturerId, manufacturerId)).limit(1);
    if (!mfg) return reply.code(404).send({ error: 'Manufacturer not found' });
    return mfg;
  });

  fastify.patch('/manufacturers/:manufacturerId', can('products:write'), async (req, reply) => {
    const { manufacturerId } = req.params as { manufacturerId: string };
    const body = UpdateManufacturerSchema.parse(req.body);
    const [updated] = await db.update(manufacturers)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(manufacturers.manufacturerId, manufacturerId))
      .returning();
    if (!updated) return reply.code(404).send({ error: 'Manufacturer not found' });
    await audit(req, 'update', 'manufacturer', manufacturerId);
    return updated;
  });

  // ── Products (trimmed — FK anchor for vulnerability/PSIRT cases) ─────────────

  fastify.post('/products', can('products:write'), async (req, reply) => {
    const body = CreateProductSchema.parse(req.body);
    const [product] = await db.insert(products).values(body).returning();
    await audit(req, 'create', 'product', product!.productId);
    return reply.code(201).send(product);
  });

  fastify.get('/products', auth, async () => {
    return db.select().from(products).orderBy(products.productName);
  });

  fastify.get('/products/:productId', auth, async (req, reply) => {
    const { productId } = req.params as { productId: string };
    const [product] = await db.select().from(products).where(eq(products.productId, productId)).limit(1);
    if (!product) return reply.code(404).send({ error: 'Product not found' });
    return product;
  });

  fastify.patch('/products/:productId', can('products:write'), async (req, reply) => {
    const { productId } = req.params as { productId: string };
    const body = UpdateProductSchema.parse(req.body);
    const [updated] = await db.update(products)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(products.productId, productId))
      .returning();
    if (!updated) return reply.code(404).send({ error: 'Product not found' });
    await audit(req, 'update', 'product', productId);
    return updated;
  });

  fastify.get('/products/:productId/versions', auth, async (req) => {
    const { productId } = req.params as { productId: string };
    return db.select().from(productVersions)
      .where(eq(productVersions.productId, productId))
      .orderBy(productVersions.createdAt);
  });

  fastify.get('/product-versions', auth, async () => {
    return db.select().from(productVersions).orderBy(productVersions.createdAt);
  });
}
