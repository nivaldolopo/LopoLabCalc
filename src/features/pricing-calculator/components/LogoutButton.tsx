"use client";

import { LogOut } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useConfirm } from "./ConfirmDialog";

// Botão de logout. Chama o signOut global do Firebase — o onAuthStateChanged do
// AuthGate detecta e volta para a tela de login sozinho. currentUser está
// preenchido aqui porque o app só renderiza quando autorizado.
export function LogoutButton() {
  const email = auth.currentUser?.email ?? "";
  const { ask, dialog } = useConfirm();

  async function handleSignOut() {
    const confirmed = await ask({
      title: `Sair da conta ${email || "atual"}?`,
      body: <p>Nada é perdido — os dados ficam na nuvem e voltam ao entrar.</p>,
      confirmLabel: "Sair",
    });
    if (!confirmed) return;
    await signOut(auth);
  }

  const label = email ? `Sair (${email})` : "Sair";

  return (
    <>
      <button
        className="icon-label-button"
        type="button"
        onClick={handleSignOut}
        aria-label={label}
        title={label}
      >
        {/* UX-33: o rótulo vai num `<span>` próprio porque no celular ele sai
            (o botão vira ícone puro ao lado do ☰) — ver `.header-utils-label`
            no responsive.css.
            A11Y-01: e é exatamente por isso que o `aria-label` acima precisa
            existir. Sem ele, no celular o botão fica com o ícone `aria-hidden` e
            nada mais, e o nome acessível cai no `title` — que é o último recurso
            do algoritmo, não um rótulo. */}
        <LogOut size={15} aria-hidden="true" />{" "}
        <span className="header-utils-label">Sair</span>
      </button>
      {dialog}
    </>
  );
}
