import React from 'react';
import SimpleCrudPage from './SimpleCrud';

export default function Forms() {
  return <SimpleCrudPage title="Formas farmaceuticas" endpoint="/inventory/forms" managePerm="forms.manage" />;
}