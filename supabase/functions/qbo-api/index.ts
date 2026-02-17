// QBO API Edge Function
// Single fat function with Hono routing for all QBO operations
// See: https://supabase.com/docs/guides/functions/routing
import { Hono } from 'jsr:@hono/hono'

// basePath must match the Edge Function directory name
const app = new Hono().basePath('/qbo-api')

// Placeholder route — full implementation in Plan 01-02
app.get('/', (c) => {
  return c.json({ status: 'QBO API ready' })
})

Deno.serve(app.fetch)
