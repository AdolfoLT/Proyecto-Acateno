import { Request } from 'express';

export type Rol = 'usuario' | 'contador' | 'admin';
export type EstadoRequisicion = 'activa' | 'oculta' | 'eliminada';
export type FormaPago = 'CHEQUE' | 'TRANSFERENCIA' | 'EFECTIVO';

export interface UsuarioJWT {
  id:       number;
  username: string;
  rol:      Rol;
  nombre:   string;
}

export interface RequestAutenticado extends Request {
  user: UsuarioJWT;
}

export interface Requisicion {
  id:               number;
  folio:            string;
  area_id:          number | null;
  area_nombre:      string | null;
  clasificacion_id: number | null;
  concepto:         string | null;
  proveedor:        string | null;
  rfc:              string | null;
  monto:            number;
  forma_pago:       FormaPago;
  cuenta_bancaria:  string | null;
  no_factura:       string | null;
  no_contrato:      string | null;
  fecha:            string;
  estado:           EstadoRequisicion;
  oculta_por:       number | null;
  oculta_en:        string | null;
  oculta_motivo:    string | null;
  creado_por:       number | null;
  creado_en:        string;
  actualizado_en:   string;
}

export interface Usuario {
  id:           number;
  nombre:       string;
  username:     string;
  password_hash: string;
  rol:          Rol;
  activo:       number;
  creado_en:    string;
}

export interface Area {
  id:     number;
  nombre: string;
}

export interface Clasificacion {
  id:     number;
  clave:  string;
  nombre: string;
}

export interface RegistroAuditoria {
  id:          number;
  usuario_id:  number | null;
  username:    string | null;
  accion:      string;
  tabla:       string | null;
  registro_id: number | null;
  detalle:     Record<string, unknown> | null;
  ip:          string | null;
  fecha:       string;
}
