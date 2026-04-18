import pg from 'pg'

const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function connectDb(): Promise<void> {
  const client = await pool.connect()
  client.release()
  console.log('PostgreSQL connected')
}
