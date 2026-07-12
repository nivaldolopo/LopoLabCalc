"use client";

import { LogOut } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

// Botão de logout. Chama o signOut global do Firebase — o onAuthStateChanged do
// AuthGate detecta e volta para a tela de login sozinho. currentUser está
// preenchido aqui porque o app só renderiza quando autorizado.
export function LogoutButton() {
  const email = auth.currentUser?.email ?? "";

  async function handleSignOut() {
    if (!window.confirm(`Sair da conta ${email || "atual"}?`)) return;
    await signOut(auth);
  }

  return (
    <button
      className="icon-label-button"
      type="button"
      onClick={handleSignOut}
      title={email ? `Sair (${email})` : "Sair"}
    >
      <LogOut size={15} /> Sair
    </button>
  );
}
