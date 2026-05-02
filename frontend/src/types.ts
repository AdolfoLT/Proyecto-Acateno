export type Rol = 'usuario' | 'contador' | 'admin';
export type EstadoRequisicion = 'activa' | 'oculta' | 'eliminada';
export type FormaPago = 'CHEQUE' | 'TRANSFERENCIA' | 'EFECTIVO';

export interface UsuarioSesion {
  id:       number;
  nombre:   string;
  username: string;
  rol:      Rol;
}

export interface Requisicion {
  id:                  number;
  folio:               string;
  area_id:             number | null;
  area_nombre:         string | null;
  area_catalogo:       string | null;
  clasificacion_id:    number | null;
  clasificacion_clave: string | null;
  clasificacion_nombre: string | null;
  concepto:            string | null;
  proveedor:           string | null;
  rfc:                 string | null;
  monto:               number;
  forma_pago:          FormaPago;
  cuenta_bancaria:     string | null;
  no_factura:          string | null;
  no_contrato:         string | null;
  fecha:               string;
  estado:              EstadoRequisicion;
  oculta_por:          number | null;
  oculta_en:           string | null;
  oculta_motivo:       string | null;
  oculta_por_nombre:   string | null;
  creado_por:          number | null;
  creado_por_nombre:   string | null;
  creado_en:           string;
  actualizado_en:      string;
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

export interface UsuarioAdmin {
  id:        number;
  nombre:    string;
  username:  string;
  rol:       Rol;
  activo:    number;
  creado_en: string;
}

export interface RegistroAuditoria {
  id:          number;
  usuario_id:  number | null;
  username:    string | null;
  accion:      string;
  tabla:       string | null;
  registro_id: number | null;
  ip:          string | null;
  fecha:       string;
}

export interface RespuestaPaginada<T> {
  datos:   T[];
  total:   number;
  pagina:  number;
  paginas: number;
}

export interface FormularioRequisicion {
  area_id:          string;
  area_nombre:      string;
  clasificacion_id: string;
  concepto:         string;
  proveedor:        string;
  rfc:              string;
  monto:            string;
  forma_pago:       FormaPago;
  cuenta_bancaria:  string;
  no_factura:       string;
  no_contrato:      string;
  fecha:            string;
}

export interface FormularioUsuario {
  nombre:   string;
  username: string;
  password: string;
  rol:      Rol;
}
