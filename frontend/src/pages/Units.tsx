import React from 'react';
import SimpleCrudPage from './SimpleCrud';

export default function Units() {
  return <SimpleCrudPage title="Unidades de Medida" endpoint="/inventory/units" showShort />;
}
