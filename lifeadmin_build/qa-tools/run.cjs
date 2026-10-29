const path = require('node:path');
const suites = { home: 'qa_home_accessibility.cjs', bills: 'qa_bill_experience.cjs', help: 'qa_bill_help.cjs', layout: 'check_local_layout.cjs' };
const suite = suites[process.argv[2]];
if (!suite) { console.error('Choose home, bills, help or layout.'); process.exit(1); }
process.env.NODE_PATH = [path.join(__dirname, 'node_modules'), process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
require('node:module').Module._initPaths();
process.argv = [process.argv[0], path.resolve(__dirname, '../scripts', suite)];
require(process.argv[1]);
