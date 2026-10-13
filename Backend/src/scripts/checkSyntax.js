/** Loads the full module graph (without starting the server) to catch import/syntax errors. */
process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/openpage-check';
await import('../app.js');
await import('../jobs/scheduler.js');
await import('./seedData.js');
console.log('Module graph OK');
process.exit(0);
