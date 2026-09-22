type Role = 'USER' | 'ADMIN';
type Action = 'view' | 'create' | 'update' | 'delete' | 'search' | 'hide';

type Resource = 'Product' | 'Review' | 'Order' | 'Cart' | 'Payment';

type RolePermissions = {
  [role in Role]: {
    [resource in Resource]?: Action[];
  };
};

const rolePermissions: RolePermissions = {
  ADMIN: {
    Product: ['view', 'create', 'update', 'delete', 'hide', 'search'],
    Review: ['view', 'delete'],
    Order: ['view', 'update', 'delete', 'create'],
    Cart: ['view'],
    Payment: ['view'],
  },
  USER: {
    Product: ['view', 'search'],
    Review: ['view', 'create', 'update', 'delete'],
    Order: ['create', 'view', 'delete'],
    Cart: ['view', 'create', 'update', 'delete'],
    Payment: ['view'],
  },
};

export { rolePermissions };
export type { Role, Action, Resource };
