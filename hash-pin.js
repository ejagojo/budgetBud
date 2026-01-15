// Simple script to hash a PIN using SHA-256
const crypto = require('crypto');

function hashPin(pin) {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

const pin = '0807';
const hashedPin = hashPin(pin);

console.log(`PIN: ${pin}`);
console.log(`SHA-256 Hash: ${hashedPin}`);

