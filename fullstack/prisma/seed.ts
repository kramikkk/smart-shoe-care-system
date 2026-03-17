import { hashPassword } from 'better-auth/crypto'
import prisma from '../src/lib/prisma'

async function main() {
  const email = process.env.ADMIN_EMAIL
  const name = process.env.ADMIN_NAME
  const password = process.env.ADMIN_PASSWORD

  if (!email || !name || !password) {
    throw new Error('ADMIN_EMAIL, ADMIN_NAME, and ADMIN_PASSWORD env vars are required')
  }

  // Check if admin already exists
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    await prisma.user.update({ where: { email }, data: { role: 'admin' } })
    console.log(`Admin user already exists (${email}), ensured role=admin`)
    return
  }

  const hashedPassword = await hashPassword(password)
  const id = crypto.randomUUID().replace(/-/g, '')

  await prisma.$transaction([
    prisma.user.create({
      data: { id, name, email, emailVerified: true, role: 'admin' },
    }),
    prisma.account.create({
      data: {
        id: crypto.randomUUID().replace(/-/g, ''),
        accountId: id,
        providerId: 'credential',
        userId: id,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ])

  console.log(`Admin user created: ${email}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
