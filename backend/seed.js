/**
 * seed.js — Usuarios iniciales
 * Ejecutar: node seed.js
 *
 * Usuarios:
 *   admin     / Admin2024!       → rol admin (todos los permisos)
 *   contador  / Contador2024!    → rol contador (ocultar + ver todo, sin purgar ni gestionar usuarios)
 *   tesorero  / Tesorero2024!    → rol usuario  (solo crear y ver)
 *
 * ⚠️  CAMBIA LAS CONTRASEÑAS ANTES DE PRODUCCIÓN
 */
import bcrypt from 'bcrypt';
import pool from './config/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function seed() {
  console.log('🌱  Sembrando usuarios...');

  const usuarios = [
    { nombre: 'Administrador', username: 'admin',    password: 'Admin2024!',    rol: 'admin'    },
    { nombre: 'Contador',      username: 'contador', password: 'Contador2024!', rol: 'contador' },
    { nombre: 'Tesorero',   username: 'tesorero', password: 'Tesorero2024!', rol: 'usuario'  },
  ];

  for (const u of usuarios) {
    const hash = await bcrypt.hash(u.password, 10);
    await pool.query(
      `INSERT INTO usuarios (nombre, username, password_hash, rol)
       VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash), rol=VALUES(rol)`,
      [u.nombre, u.username, hash, u.rol]
    );
    console.log(`  ✅  ${u.username} (${u.rol}) — contraseña: ${u.password}`);
  }

  console.log('\n⚠️   CAMBIA LAS CONTRASEÑAS ANTES DE USAR EN PRODUCCIÓN\n');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });