import type { FastifyInstance } from 'fastify';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createReadStream } from 'fs';
import { readdir, stat, unlink, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import { audit } from '../lib/audit.js';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = join(__dirname, '../../../../backups');
mkdirSync(BACKUP_DIR, { recursive: true });

function parseDbUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port || '5432',
    database: u.pathname.slice(1),
    user: u.username,
    password: u.password,
  };
}

export default async function adminRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };
  const can = (p: string) => ({ preHandler: [fastify.requirePermission(p)] });

  // POST /api/v1/admin/backup
  fastify.post('/admin/backup', can('admin:backup'), async (req, reply) => {
    const db = parseDbUrl(process.env['DATABASE_URL']!);
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `cra_backup_${ts}.dump`;
    const filepath = join(BACKUP_DIR, filename);

    const env = { ...process.env, PGPASSWORD: db.password };

    try {
      await execFileAsync('pg_dump', [
        '-h', db.host, '-p', db.port, '-U', db.user,
        '-F', 'c', '-f', filepath, db.database,
      ], { env });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'pg_dump failed', detail: (err as Error).message });
    }

    const { size } = await stat(filepath);
    await audit(req, 'backup', 'database', 'system', { filename, size });
    return reply.code(201).send({ filename, size, createdAt: new Date().toISOString() });
  });

  // GET /api/v1/admin/backups
  fastify.get('/admin/backups', auth, async () => {
    const files = await readdir(BACKUP_DIR).catch(() => [] as string[]);
    const entries = await Promise.all(
      files
        .filter((f) => f.endsWith('.dump') || f.endsWith('.sql'))
        .map(async (f) => {
          const { size, mtime } = await stat(join(BACKUP_DIR, f));
          return { filename: f, size, createdAt: mtime.toISOString() };
        }),
    );
    return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  // GET /api/v1/admin/backups/:filename
  fastify.get('/admin/backups/:filename', auth, async (req, reply) => {
    const { filename } = req.params as { filename: string };
    if (filename.includes('/') || filename.includes('..')) {
      return reply.code(400).send({ error: 'Invalid filename' });
    }
    const filepath = join(BACKUP_DIR, filename);
    try {
      await stat(filepath);
    } catch {
      return reply.code(404).send({ error: 'Backup not found' });
    }
    const encodedFilename = encodeURIComponent(filename);
    reply.header('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
    reply.header('Content-Type', 'application/octet-stream');
    return reply.send(createReadStream(filepath));
  });

  // DELETE /api/v1/admin/backups/:filename
  fastify.delete('/admin/backups/:filename', can('admin:backup'), async (req, reply) => {
    const { filename } = req.params as { filename: string };
    if (filename.includes('/') || filename.includes('..')) {
      return reply.code(400).send({ error: 'Invalid filename' });
    }
    const filepath = join(BACKUP_DIR, filename);
    try {
      await unlink(filepath);
    } catch {
      return reply.code(404).send({ error: 'Backup not found' });
    }
    await audit(req, 'delete_backup', 'database', 'system', { filename });
    return { ok: true };
  });

  // POST /api/v1/admin/restore
  fastify.post('/admin/restore', can('admin:backup'), async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: 'No file uploaded' });

    const db = parseDbUrl(process.env['DATABASE_URL']!);
    const tmpPath = join(BACKUP_DIR, `restore_tmp_${Date.now()}.dump`);

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) chunks.push(chunk);
    await writeFile(tmpPath, Buffer.concat(chunks));

    const env = { ...process.env, PGPASSWORD: db.password };

    try {
      await execFileAsync('pg_restore', [
        '-h', db.host, '-p', db.port, '-U', db.user, '-d', db.database,
        '--clean', '--if-exists', '--no-owner', '--no-privileges', tmpPath,
      ], { env });
    } catch (err) {
      const msg = (err as { stderr?: string }).stderr ?? (err as Error).message;
      if (msg.includes('FATAL') || msg.includes('error:')) {
        await unlink(tmpPath).catch(() => {});
        return reply.code(500).send({ error: 'Restore failed', detail: msg.slice(0, 500) });
      }
    }

    await unlink(tmpPath).catch(() => {});
    await audit(req, 'restore', 'database', 'system', { originalName: data.filename });
    return { ok: true, message: 'Database restored successfully' };
  });
}
