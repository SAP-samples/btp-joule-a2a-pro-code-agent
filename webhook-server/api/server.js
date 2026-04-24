/* CAP custom server entrypoint (JS) using precompiled TypeScript (no ts-node in CF runtime) */

// Load compiled bootstrap which registers Express middleware/routes
require('./gen/server.js')

// Start CAP server programmatically
const cds = require('@sap/cds')
if (require.main === module) {
  cds.server().catch(err => {
    console.error('Failed to start CAP server:', err)
    process.exit(1)
  })
} else {
  module.exports = cds.server
}
