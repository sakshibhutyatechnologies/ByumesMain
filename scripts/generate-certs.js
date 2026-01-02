const selfsigned = require('selfsigned');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Get network IP address
function getNetworkIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const networkIP = getNetworkIP();
const hostname = os.hostname();

console.log(`Detected network IP: ${networkIP}`);
console.log(`Detected hostname: ${hostname}`);

// Define certificate attributes
const attrs = [
  { name: 'commonName', value: '127.0.0.1' },
  { name: 'countryName', value: 'US' },
  { shortName: 'ST', value: 'State' },
  { name: 'localityName', value: 'City' },
  { name: 'organizationName', value: 'MesonEx' },
  { shortName: 'OU', value: 'Development' }
];

// Certificate options with multiple hostnames and IPs
const options = {
  keySize: 2048,
  days: 365,
  algorithm: 'sha256',
  extensions: [
    {
      name: 'subjectAltName',
      altNames: [
        { type: 2, value: 'localhost' },           // DNS: localhost
        { type: 2, value: hostname },              // DNS: hostname
        { type: 7, ip: '127.0.0.1' },             // IP: localhost
        { type: 7, ip: networkIP }                // IP: network IP
      ]
    }
  ]
};

console.log('Generating self-signed certificates with multiple hostnames...');

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
console.log('\nCertificate includes:');
console.log('  - localhost');
console.log(`  - ${hostname}`);
console.log('  - 127.0.0.1');
console.log(`  - ${networkIP}`);
