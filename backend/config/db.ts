import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               Number(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '1234',
  database:           process.env.DB_NAME     || 'acateno_tesoreria',
  waitForConnections: true,
  connectionLimit:    20,
  queueLimit:         0,
  timezone:           '-06:00',
  charset:            'utf8mb4',
});

export default pool;
