/**
 * Vercel Serverless Function Entry Point
 * Wraps the Express API server for serverless deployment
 */

import app from '../server/api.mjs'

export default async function handler(req, res) {
  // Let Express handle the request
  return app(req, res)
}
