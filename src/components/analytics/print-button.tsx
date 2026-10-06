"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return <button type="button" className="button-primary" onClick={() => window.print()}><Printer size={16} aria-hidden="true" />Imprimir ou salvar PDF</button>;
}
