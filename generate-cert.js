const fs = require('fs');
const path = require('path');
const selfsigned = require('selfsigned');
const mkdirp = require('mkdirp');

// Directory to store certificates
const certsDir = path.join(__dirname, 'certs');

// Ensure the certs directory exists
mkdirp.sync(certsDir);

const certPath = path.join(certsDir, 'cert.pem');
const keyPath = path.join(certsDir, 'key.pem');

// Check if certificates already exist
if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  console.log('SSL certificates already exist at:', certsDir);
  console.log('Using existing certificates.');
} else {
  console.log('Generating new self-signed SSL certificates...');
  
  // Generate self-signed certificate
  const attrs = [{ name: 'commonName', value: 'localhost' }];
  const pems = selfsigned.generate(attrs, { 
    algorithm: 'sha256',
    days: 365,
    keySize: 2048,
    extensions: [
      { name: 'subjectAltName', altNames: [
        { type: 2, value: 'localhost' },
        { type: 7, ip: '127.0.0.1' }
      ]}
    ]
  });

  // Write certificates to files
  fs.writeFileSync(certPath, pems.cert);
  fs.writeFileSync(keyPath, pems.private);
  
  console.log('SSL certificates generated successfully at:', certsDir);
}

// Export certificate paths
module.exports = {
  cert: fs.readFileSync(certPath),
  key: fs.readFileSync(keyPath)
};
