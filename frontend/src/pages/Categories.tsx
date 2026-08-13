import React from 'react';
import SimpleCrudPage from './SimpleCrud';

export default function Categories() {
  return <SimpleCrudPage title="Categorias" endpoint="/inventory/categories" managePerm="inventory.refs.manage" />;
}
