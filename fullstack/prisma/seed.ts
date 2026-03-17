import { auth } from '../src/lib/auth'
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
    // Ensure role is set to admin
    await prisma.user.update({ where: { email }, data: { role: 'admin' } })
    console.log(`Admin user already exists (${email}), ensured role=admin`)
    return
  }

  // Create user via Better Auth
  const result = await auth.api.signUpEmail({
    body: { email, name, password },
  })

  if (!result?.user) {
    throw new Error('Failed to create admin user')
  }

  // Promote to admin
  await prisma.user.update({
    where: { id: result.user.id },
    data: { role: 'admin' },
  })

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
