import { db } from "./server/db";
import { users } from "./shared/schema";
import { eq } from "drizzle-orm";

async function initializeAdmin() {
  try {
    const adminCode = '19770520$&?';
    
    // Check if admin user exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.accessCode, adminCode));
    
    if (!existingUser) {
      // Create admin user
      await db.insert(users).values({
        name: 'Admin User',
        email: 'admin@citydiscoverer.ai',
        accessCode: adminCode,
        role: 'admin',
        isActive: true,
      });
      console.log('✓ Admin user created with access code:', adminCode);
    } else {
      console.log('✓ Admin user already exists');
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}

initializeAdmin().then(() => process.exit(0));