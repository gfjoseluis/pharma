/**
 * Catalogo de permisos por accion.
 * Cada usuario (no admin) tiene una lista de acciones habilitadas.
 */
export const ACTIONS: Record<string, string[]> = {
  Dashboard: ['dashboard.view'],
  'Punto de venta': ['pos.view', 'pos.sale'],
  Ventas: ['sales.view', 'sales.annul', 'sales.delete'],
  Clientes: ['clients.view', 'clients.create', 'clients.edit', 'clients.delete'],
  Productos: ['products.view', 'products.create', 'products.edit', 'products.delete'],
  'Inventario (categorias, laboratorios, unidades, proveedores)': ['inventory.refs.view', 'inventory.refs.manage'],
  'Formas farmaceuticas': ['forms.manage'],
  Compras: ['purchases.view', 'purchases.create', 'purchases.delete'],
  Sucursales: ['branches.view', 'branches.edit', 'branches.stock'],
  Reportes: ['reports.view'],
  Usuarios: ['users.view', 'users.manage'],
  Backups: ['backups.view', 'backups.manage'],
  Logs: ['logs.view'],
};

export const ALL_ACTIONS: string[] = Object.values(ACTIONS).flat();

/** Permisos heredados (por modulo) de versiones anteriores. */
export const LEGACY_TO_ACTIONS: Record<string, string[]> = {
  dashboard: ['dashboard.view'],
  pos: ['pos.view', 'pos.sale'],
  sales: ['sales.view', 'sales.annul', 'sales.delete'],
  clients: ['clients.view', 'clients.create', 'clients.edit', 'clients.delete'],
  inventory: [
    'products.view', 'products.create', 'products.edit', 'products.delete',
    'inventory.refs.view', 'inventory.refs.manage', 'forms.manage',
  ],
  purchases: ['purchases.view', 'purchases.create', 'purchases.delete'],
  branches: ['branches.view', 'branches.edit', 'branches.stock'],
  reports: ['reports.view'],
  users: ['users.view', 'users.manage'],
  backups: ['backups.view', 'backups.manage'],
  logs: ['logs.view'],
  products_forms: ['forms.manage'],
};

export function normalizePermissions(permissions: unknown): string[] {
  if (!Array.isArray(permissions)) return [];
  const list = permissions.map(String).filter((x) => ALL_ACTIONS.includes(x));
  return Array.from(new Set(list));
}

/** ¿El usuario tiene la accion (directa o por modulo heredado)? */
export function hasAction(permissions: unknown, action: string): boolean {
  const granted = Array.isArray(permissions) ? permissions.map(String) : [];
  if (granted.includes(action)) return true;
  for (const [legacy, actions] of Object.entries(LEGACY_TO_ACTIONS)) {
    if (granted.includes(legacy) && actions.includes(action)) return true;
  }
  return false;
}