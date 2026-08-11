/** Catalogo de permisos por accion (espejo del backend: src/config/actions.ts). */

export const ACTION_GROUPS: Record<string, string[]> = {
  Dashboard: ['dashboard.view'],
  'Punto de venta': ['pos.view', 'pos.sale'],
  Ventas: ['sales.view', 'sales.annul', 'sales.delete'],
  Clientes: ['clients.view', 'clients.create', 'clients.edit', 'clients.delete'],
  Productos: ['products.view', 'products.create', 'products.edit', 'products.delete'],
  'Categorias, laboratorios, unidades y proveedores': ['inventory.refs.view', 'inventory.refs.manage'],
  'Formas farmaceuticas': ['forms.manage'],
  Compras: ['purchases.view', 'purchases.create', 'purchases.delete'],
  Sucursales: ['branches.view', 'branches.edit', 'branches.stock'],
  Reportes: ['reports.view'],
  Usuarios: ['users.view', 'users.manage'],
  Backups: ['backups.view', 'backups.manage'],
  Logs: ['logs.view'],
};

export const ACTION_LABELS: Record<string, string> = {
  'dashboard.view': 'Ver dashboard',
  'pos.view': 'Usar punto de venta',
  'pos.sale': 'Cobrar ventas',
  'sales.view': 'Ver ventas',
  'sales.annul': 'Anular ventas',
  'sales.delete': 'Desactivar ventas',
  'clients.view': 'Ver clientes',
  'clients.create': 'Registrar clientes',
  'clients.edit': 'Editar clientes',
  'clients.delete': 'Eliminar clientes',
  'products.view': 'Ver productos',
  'products.create': 'Crear productos',
  'products.edit': 'Editar productos',
  'products.delete': 'Desactivar productos',
  'inventory.refs.view': 'Ver categorias, laboratorios, unidades y proveedores',
  'inventory.refs.manage': 'Gestionar categorias, laboratorios, unidades y proveedores',
  'forms.manage': 'Gestionar formas farmaceuticas',
  'purchases.view': 'Ver compras',
  'purchases.create': 'Registrar compras',
  'purchases.delete': 'Eliminar compras',
  'branches.view': 'Ver sucursales y stock',
  'branches.edit': 'Editar sucursales',
  'branches.stock': 'Distribuir y transferir stock',
  'reports.view': 'Ver reportes',
  'users.view': 'Ver usuarios',
  'users.manage': 'Crear y editar usuarios',
  'backups.view': 'Ver backups',
  'backups.manage': 'Ejecutar backups',
  'logs.view': 'Ver logs',
};

export const ALL_ACTIONS: string[] = Object.values(ACTION_GROUPS).flat();

const LEGACY_TO_ACTIONS: Record<string, string[]> = {
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

export function hasAction(permissions: string[] | undefined | null, action: string): boolean {
  const granted = Array.isArray(permissions) ? permissions : [];
  if (granted.includes(action)) return true;
  for (const [legacy, actions] of Object.entries(LEGACY_TO_ACTIONS)) {
    if (granted.includes(legacy) && actions.includes(action)) return true;
  }
  return false;
}