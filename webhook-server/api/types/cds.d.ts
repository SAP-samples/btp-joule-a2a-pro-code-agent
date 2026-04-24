// Minimal type shim for @sap/cds to satisfy TypeScript when using runtime-only APIs
declare module '@sap/cds' {
  const cds: any
  export = cds
}
