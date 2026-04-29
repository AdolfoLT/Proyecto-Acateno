import pool from './config/db.js'
import dotenv from 'dotenv'
dotenv.config()

const statements = [
  `CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    username VARCHAR(60) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol ENUM('usuario','contador','admin') NOT NULL DEFAULT 'usuario',
    activo TINYINT(1) NOT NULL DEFAULT 1,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS areas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL UNIQUE
  )`,
  `INSERT IGNORE INTO areas (nombre) VALUES
    ('Tesorería'),('Presidencia'),('Secretaría'),
    ('Obras Públicas'),('Desarrollo Social'),
    ('Servicios Públicos'),('DIF Municipal'),('Contraloría')`,
  `CREATE TABLE IF NOT EXISTS clasificaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clave VARCHAR(20) NOT NULL UNIQUE,
    nombre VARCHAR(200) NOT NULL
  )`,
  `INSERT IGNORE INTO clasificaciones (clave, nombre) VALUES
    ('1000','Servicios Personales'),
    ('2000','Materiales y Suministros'),
    ('3000','Servicios Generales'),
    ('4000','Transferencias y Subsidios'),
    ('5000','Bienes Muebles e Inmuebles'),
    ('6000','Inversión Pública'),
    ('7000','Deuda Pública')`,
  `CREATE TABLE IF NOT EXISTS requisiciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    folio VARCHAR(30) NOT NULL UNIQUE,
    area_id INT,
    area_nombre VARCHAR(120),
    clasificacion_id INT,
    concepto TEXT,
    proveedor VARCHAR(200),
    rfc VARCHAR(15),
    monto DECIMAL(14,2) NOT NULL DEFAULT 0,
    forma_pago ENUM('CHEQUE','TRANSFERENCIA','EFECTIVO') DEFAULT 'CHEQUE',
    cuenta_bancaria VARCHAR(40),
    no_factura VARCHAR(100),
    no_contrato VARCHAR(100),
    fecha DATE NOT NULL DEFAULT (CURRENT_DATE),
    estado ENUM('activa','oculta','eliminada') NOT NULL DEFAULT 'activa',
    oculta_por INT,
    oculta_en DATETIME,
    oculta_motivo TEXT,
    creado_por INT,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS auditoria (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT,
    username VARCHAR(60),
    accion VARCHAR(60) NOT NULL,
    tabla VARCHAR(60),
    registro_id INT,
    detalle JSON,
    ip VARCHAR(45),
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
]

console.log('🏗️  Creando tablas...')
for (const stmt of statements) {
  try {
    await pool.query(stmt)
    console.log('✅', stmt.slice(0, 60).replace(/\n/g, ' ').trim())
  } catch (err) {
    console.log('⚠️ ', err.message)
  }
}
console.log('\n✅ Tablas listas')
process.exit(0)