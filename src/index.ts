import 'dotenv/config'
import { buildServer } from './server.js'
import { connectDb } from './db.js'
import { connectRedis } from './redis.js'

const port = Number(process.env.PORT) || 3000

async function main() {
  await connectDb()
  await connectRedis()

  const app = buildServer()
  await app.listen({ port, host: '0.0.0.0' })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
