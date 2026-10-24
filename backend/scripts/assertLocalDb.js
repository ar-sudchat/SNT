// Refuse to run the test suite against anything but a local database.
// backend/.env points at production, and dotenv fills DATABASE_URL from it
// whenever the shell doesn't export a local one first.
require('dotenv').config();

const urls = { DATABASE_URL: process.env.DATABASE_URL, DIRECT_URL: process.env.DIRECT_URL };
const isLocal = (u) => !u || /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(u) || /host=\/tmp/.test(u);

const bad = Object.entries(urls).filter(([, u]) => !isLocal(u)).map(([k]) => k);
if (bad.length) {
  console.error(`Refusing to run tests: ${bad.join(', ')} is not a local database.`);
  console.error('Run first:');
  console.error('  export DATABASE_URL="postgresql://$(whoami)@localhost:5432/snt_local?host=/tmp"');
  console.error('  export DIRECT_URL="$DATABASE_URL"');
  process.exit(1);
}
