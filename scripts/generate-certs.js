const selfsigned = require('selfsigned');
const fs = require('fs');
const path = require('path');

// Define certificate attributes
const attrs = [
  { name: 'commonName', value: '127.0.0.1' },
  { name: 'countryName', value: 'US' },
  { shortName: 'ST', value: 'State' },
  { name: 'localityName', value: 'City' },
  { name: 'organizationName', value: 'MesonEx' },
  { shortName: 'OU', value: 'Development' }
];

// Certificate options
const options = {
  keySize: 2048,
  days: 365,
  algorithm: 'sha256',
  extensions: [
    {
      name: 'subjectAltName',
      altNames: [
        { type: 2, value: '127.0.0.1' }, // DNS
        { type: 7, ip: '127.0.0.1' }     // IP
      ]
    }
  ]
};

console.log('Generating self-signed certificates...');

// Generate certificate
const pems = selfsigned.generate(attrs, options);

// Create certs directory if it doesn't exist
const certsDir = path.join(__dirname, '..', 'certs');
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
  console.log('Created certs directory');
}

// Write certificate and key files
fs.writeFileSync(path.join(certsDir, 'server.cert'), pems.cert);
fs.writeFileSync(path.join(certsDir, 'server.key'), pems.private);

console.log('✓ Certificate generated: certs/server.cert');
console.log('✓ Private key generated: certs/server.key');
console.log('Certificates are valid for 365 days');
