import express from 'express';
import https from 'https';
import { readFileSync } from 'fs';
import cors from 'cors';
import os from 'os';
import { env } from './config/env';
import { initDatabase } from './utils/database';
import { ensureSelfSignedCertificate } from './utils/certificate';
import authRoutes from './routes/auth.routes';
import taskRoutes from './routes/task.routes';
import projectRoutes from './routes/project.routes';
import versionRoutes from './routes/version.routes';
import uploadRoutes from './routes/upload.routes';
import userRoutes from './routes/user.routes';
import shareRoutes from './routes/share.routes';
import auditRoutes from './routes/audit.routes';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Set default charset to utf-8
app.use((req, res, next) => {
  req.headers['content-type'] = req.headers['content-type']?.toString().includes('charset')
    ? req.headers['content-type']
    : `${req.headers['content-type']}; charset=utf-8`;
  res.header('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', versionRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/audit', auditRoutes);

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ success: false, error: err.message });
});

function getLocalIPs(): { name: string; address: string }[] {
  const interfaces = os.networkInterfaces();
  const result: { name: string; address: string }[] = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      if (iface.family === 'IPv4' && !iface.internal) {
        result.push({ name, address: iface.address });
      }
    }
  }
  return result;
}

async function start() {
  try {
    await initDatabase();
    
    if (env.HTTPS_ENABLED) {
      let key: string;
      let cert: string;
      
      if (env.HTTPS_KEY_PATH && env.HTTPS_CERT_PATH) {
        key = readFileSync(env.HTTPS_KEY_PATH, 'utf-8');
        cert = readFileSync(env.HTTPS_CERT_PATH, 'utf-8');
      } else {
        const certs = await ensureSelfSignedCertificate();
        key = certs.key;
        cert = certs.cert;
      }
      
      https.createServer({ key, cert }, app).listen(env.PORT, () => {
        console.log(`Server running on https://localhost:${env.PORT}`);
        const ips = getLocalIPs();
        if (ips.length > 0) {
          console.log('Also accessible via:');
          ips.forEach(({ name, address }) => {
            console.log(`  - ${name}: https://${address}:${env.PORT}`);
          });
        }
      });
    } else {
      app.listen(env.PORT, () => {
        console.log(`Server running on http://localhost:${env.PORT}`);
        const ips = getLocalIPs();
        if (ips.length > 0) {
          console.log('Also accessible via:');
          ips.forEach(({ name, address }) => {
            console.log(`  - ${name}: http://${address}:${env.PORT}`);
          });
        }
      });
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();