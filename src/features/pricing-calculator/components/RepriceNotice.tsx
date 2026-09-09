"use client";

import Link from "next/link";
import { TrendingUp, X } from "lucide-react";
import { useChangeLog } from "../hooks/useChangeLog";

/**
 * [FEAT-12] peça 3 — o AVISO PÓS-FATO, nas portas do estoque.
 *
 * As duas alavancas de "conta depois" (rolo novo de uma cor, lote novo de um
 * insumo) se movem como efeito colateral de outra tarefa: o dono está
 * cadastrando compra, não olhando para o preço. Perguntar antes ali seria pedir
 * confirmação de algo que ele não veio decidir — mas não contar nada é o que
 * este item existe para corrigir.
 *
 * ⚠ UM aviso que ACUMULA. Cadastrar quatro rolos seguidos não pode virar quatro
 * caixas empilhadas; vira uma, com a soma. Ele FICA até ser dispensado (dono), a
 * dispensa é por entrada e persistida no localStorage, e ele vive só no aparelho
 * que fez a mudança — os outros ficam com o registro em `/configuracoes`, que é
 * permanente e não interrompe ninguém no meio de outra tarefa.
 */
export function RepriceNotice() {
  const { pending, dismissPending } = useChangeLog();

  if (pending.length === 0) return null;

  const total = pending.reduce((sum, item) => sum + item.impact.affected, 0);
  const uma = pending.length === 1;
  // ⚠ Com uma alteração só, "reprecificou N produtos" é EXATO. Com várias, a
  // soma conta duas vezes o produto que duas delas moveram — e os documentos
  // guardam resumo, não a lista de afetados, então não há como saber o distinto.
  // Em vez de arredondar a verdade, a frase muda: passa a contar MUDANÇAS DE
  // PREÇO, que é o que a soma de fato é.
  const frase = uma
    ? `Uma alteração reprecificou ${total} ${total === 1 ? "produto" : "produtos"}.`
    : `${pending.length} alterações somaram ${total} mudanças de preço no catálogo.`;

  return (
    <div className="reprice-notice" role="status">
      <TrendingUp size={16} aria-hidden="true" />
      <div className="reprice-notice-text">
        <strong>{frase}</strong>{" "}
        <span>
          O preço acompanha o estoque: cor e insumo mais caros deixam o produto
          mais caro, na hora, em todos os aparelhos.
        </span>
      </div>
      <Link
        className="btn btn-secondary reprice-notice-link"
        href={`/configuracoes?entrada=${pending[0].id}`}
      >
        Ver quais
      </Link>
      <button
        className="icon-button"
        type="button"
        onClick={dismissPending}
        title="Dispensar o aviso"
        // A11Y-01: em fileira que se repete o nome diz O QUÊ. Aqui ele é único na
        // página, mas o número muda a cada mudança — nomear a ação e o tamanho
        // dela é o que dá contexto a quem ouve o botão fora da faixa.
        aria-label={`Dispensar o aviso de ${pending.length} ${
          pending.length === 1 ? "alteração" : "alterações"
        } de preço`}
      >
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
