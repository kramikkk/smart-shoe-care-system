import { config } from 'dotenv'
import { resolve } from 'path'
import prisma from '../src/lib/prisma'

// Load environment variables from .env file
config({ path: resolve(__dirname, '../.env') })

async function clearTransactions() {
  try {
    const result = await prisma.transaction.deleteMany({})
    console.log(`✅ Successfully deleted ${result.count} transactions`)
  } catch (error) {
    console.error('❌ Error clearing transactions:', error)
  } finally {
    await prisma.$disconnect()
  }
}

clearTransactions()
