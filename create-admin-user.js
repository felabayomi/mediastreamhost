// Script to create admin user with access code
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
});

async function createAdminUser() {
  const client = await pool.connect();
  try {
    const adminCode = '19770520$&?';
    
    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE access_code = $1',
      [adminCode]
    );
    
    if (existingUser.rows.length === 0) {
      // Create the admin user
      await client.query(`
        INSERT INTO users (name, email, access_code, role, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
      `, ['Admin User', 'admin@citydiscoverer.ai', adminCode, 'admin', true]);
      
      console.log('Admin user created successfully with access code:', adminCode);
    } else {
      console.log('Admin user already exists');
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    client.release();
  }
}

createAdminUser().then(() => process.exit(0));