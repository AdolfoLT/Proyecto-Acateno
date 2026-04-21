-- ============================================================
--  ACATENO TESORERÍA — Esquema MySQL
--  Administración 2024-2027
-- ============================================================

CREATE DATABASE IF NOT EXISTS acateno_tesoreria
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE acateno_tesoreria;

-- ──────────────────────────────────────────────────────────────
-- USUARIOS  (login único, múltiples sesiones simultáneas)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  nombre       VARCHAR(100) NOT NULL,
  username     VARCHAR(60)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol          ENUM('usuario','admin') NOT NULL DEFAULT 'usuario',
  activo       TINYINT(1) NOT NULL DEFAULT 1,
  creado_en    DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Usuario admin por defecto (password: Admin2024!)
-- La contraseña se hashea al sembrar datos con bcrypt
INSERT INTO usuarios (nombre, username, password_hash, rol) VALUES
  ('Administrador', 'admin',   '$2b$10$PLACEHOLDER_ADMIN',  'admin'),
  ('Tesorero',      'tesorero','$2b$10$PLACEHOLDER_USER',   'usuario')
ON DUPLICATE KEY UPDATE id=id;

-- ──────────────────────────────────────────────────────────────
-- CATÁLOGO DE ÁREAS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS areas (
  id     INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL UNIQUE
) ENGINE=InnoDB;

INSERT INTO areas (nombre) VALUES
  ('Tesorería'),
  ('Presidencia'),
  ('Secretaría'),
  ('Obras Públicas'),
  ('Desarrollo Social'),
  ('Servicios Públicos'),
  ('DIF Municipal'),
  ('Contraloría')
ON DUPLICATE KEY UPDATE id=id;

-- ──────────────────────────────────────────────────────────────
-- CATÁLOGO DE CLASIFICACIÓN PRESUPUESTAL
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clasificaciones (
  id     INT AUTO_INCREMENT PRIMARY KEY,
  clave  VARCHAR(20) NOT NULL UNIQUE,
  nombre VARCHAR(200) NOT NULL
) ENGINE=InnoDB;

INSERT INTO clasificaciones (clave, nombre) VALUES
  ('1000', 'Servicios Personales'),
  ('2000', 'Materiales y Suministros'),
  ('3000', 'Servicios Generales'),
  ('4000', 'Transferencias y Subsidios'),
  ('5000', 'Bienes Muebles e Inmuebles'),
  ('6000', 'Inversión Pública'),
  ('7000', 'Deuda Pública')
ON DUPLICATE KEY UPDATE id=id;

-- ──────────────────────────────────────────────────────────────
-- REQUISICIONES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS requisiciones (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  folio             VARCHAR(30)  NOT NULL UNIQUE,
  area_id           INT          REFERENCES areas(id),
  area_nombre       VARCHAR(120),               -- copia desnormalizada por si cambia
  clasificacion_id  INT          REFERENCES clasificaciones(id),
  concepto          TEXT,
  proveedor         VARCHAR(200),
  rfc               VARCHAR(15),
  monto             DECIMAL(14,2) NOT NULL DEFAULT 0,
  forma_pago        ENUM('CHEQUE','TRANSFERENCIA','EFECTIVO') DEFAULT 'CHEQUE',
  cuenta_bancaria   VARCHAR(40),
  no_factura        VARCHAR(100),
  no_contrato       VARCHAR(100),
  fecha             DATE         NOT NULL DEFAULT (CURRENT_DATE),
  estado            ENUM('activa','oculta','eliminada') NOT NULL DEFAULT 'activa',
  -- soft-delete: nunca se borra del todo
  oculta_por        INT          REFERENCES usuarios(id),
  oculta_en         DATETIME,
  oculta_motivo     TEXT,
  -- auditoría
  creado_por        INT          REFERENCES usuarios(id),
  creado_en         DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- LOG DE AUDITORÍA (quién hizo qué y cuándo)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auditoria (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id     INT REFERENCES usuarios(id),
  username       VARCHAR(60),
  accion         VARCHAR(60)   NOT NULL,   -- 'crear','editar','ocultar','restaurar','login','logout'
  tabla          VARCHAR(60),
  registro_id    INT,
  detalle        JSON,
  ip             VARCHAR(45),
  fecha          DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- ÍNDICES PARA RENDIMIENTO
-- ──────────────────────────────────────────────────────────────
CREATE INDEX idx_req_estado   ON requisiciones(estado);
CREATE INDEX idx_req_fecha    ON requisiciones(fecha);
CREATE INDEX idx_req_area     ON requisiciones(area_id);
CREATE INDEX idx_audit_usuario ON auditoria(usuario_id);
CREATE INDEX idx_audit_fecha  ON auditoria(fecha);
