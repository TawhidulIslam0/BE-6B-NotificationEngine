import { execSync } from 'node:child_process';

const backendDir = process.cwd();

console.log('Starting Kafka integration test...');

try {
  execSync('npx vitest run tests/kafka-integration.test.ts', {
    cwd: backendDir,
    stdio: 'inherit',
  });

  console.log('Kafka integration test completed successfully.');
} catch {
  console.error('Kafka integration test failed.');
  process.exit(1);
}
