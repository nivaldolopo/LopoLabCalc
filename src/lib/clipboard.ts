/**
 * Texto para a área de transferência.
 *
 * A API só existe em contexto seguro (HTTPS ou localhost) e só responde dentro
 * de um gesto do usuário — as duas coisas valem nos botões que a usam. Quando
 * o navegador não a expõe, o erro é EXPLÍCITO: copiar em silêncio para lugar
 * nenhum é pior do que dizer que não deu.
 */
export async function copyText(text: string): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new Error(
      "Este navegador não liberou a área de transferência para a página.",
    );
  }
  await navigator.clipboard.writeText(text);
}
