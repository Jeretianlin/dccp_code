import selfsigned from 'selfsigned';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

export async function ensureSelfSignedCertificate(): Promise<{ key: string; cert: string }> {
  const certsDir = join(__dirname, '../../certs');
  const keyPath = join(certsDir, 'key.pem');
  const certPath = join(certsDir, 'cert.pem');

  if (existsSync(keyPath) && existsSync(certPath)) {
    return {
      key: readFileSync(keyPath, 'utf-8'),
      cert: readFileSync(certPath, 'utf-8'),
    };
  }

  if (!existsSync(certsDir)) {
    mkdirSync(certsDir, { recursive: true });
  }

  const attrs = [{ name: 'commonName', value: '10.61.200.78' }];
  const pems = await selfsigned.generate(attrs, {
    keySize: 2048,
    extensions: [{
      name: 'subjectAltName',
      altNames: [
        { type: 7, ip: '10.61.200.78' },
        { type: 2, value: 'localhost' },
      ]
    }]
  });

  writeFileSync(keyPath, pems.private);
  writeFileSync(certPath, pems.cert);

  console.log('Generated self-signed certificate for 10.61.200.78 and localhost');
  
  return {
    key: pems.private,
    cert: pems.cert,
  };
}