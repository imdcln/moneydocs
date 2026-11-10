"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface AdminModalContextType {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

const AdminModalContext = createContext<AdminModalContextType | null>(null);

export function AdminModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openModal = useCallback(() => setIsOpen(true), []);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <AdminModalContext.Provider value={{ isOpen, openModal, closeModal }}>
      {children}
    </AdminModalContext.Provider>
  );
}

export function useAdminModal(): AdminModalContextType {
  const ctx = useContext(AdminModalContext);
  if (!ctx) throw new Error("useAdminModal must be used within AdminModalProvider");
  return ctx;
}
