import type { FleetRate, Machine } from "../types";
import { num } from "@/lib/number";

/**
 * [FROTA] Fase 2 — a TAXA DE FROTA.
 *
 * O problema que ela resolve: a mesma peça saía por R$33,06 (A1 Mini), R$37,45
 * (A1) ou R$49,01 (X2D) — 48% de diferença decidida por qual impressora estava
 * livre no dia em que alguém abriu a calculadora. Com três máquinas de 7× de
 * diferença de preço, isso não é ajustável por parâmetro.
 *
 * A saída NÃO toca em nenhum número pesquisado: o `lifeHours` de 7.500h segue
 * sendo o DEC-02, e os R$2,187/h da X2D continuam verdade. O que muda é a
 * DISTRIBUIÇÃO — o produto passa a ser precificado pela média da frota em que
 * ele pode rodar, ponderada pela proporção declarada de uso de cada máquina.
 *
 * ⚠ Cada componente tem a SUA média (ver `FleetRate`), nunca um total rateado.
 */

// R$/h de depreciação de UMA máquina: o preço de compra diluído na vida útil.
// `lifeHours <= 0` devolve 0 — é o mesmo guarda que o `calculateStageCost`
// sempre teve, e mantém a máquina "de zeros" do TD-024 inofensiva.
export function depreciationPerHourOf(machine: Machine): number {
  const life = num(machine.lifeHours);
  return life > 0 ? num(machine.price) / life : 0;
}

// O peso de uma máquina, saneado: percentual, nunca negativo. Ausente (dado
// anterior à Fase 2) vale 0, que é o mesmo que "máquina nova" — fora da média
// ponderada, e a UI avisa.
export function weightOf(machine: Machine): number {
  return Math.max(0, num(machine.weight));
}

/**
 * Resolve o conjunto elegível de uma etapa numa taxa de frota.
 *
 * Fora do caminho feliz há dois casos, e eles são diferentes:
 *
 * · **Conjunto vazio ou só com ids órfãos** → cai na FROTA INTEIRA e marca
 *   `missing`. É o molde do TD-009: o preço não quebra, mas o dado órfão se
 *   anuncia em vez de passar por escolha deliberada. (Todo produto anterior à
 *   Fase 2 chega aqui — eles guardavam um `machineId` escalar, e a Diretriz 7
 *   dispensa migração.)
 *
 * · **Soma de pesos ZERO no subconjunto** → média SIMPLES dele. Sem isso, a
 *   peça que só cabe na máquina recém-cadastrada (peso 0%) daria `NaN` e
 *   contaminaria o preço inteiro. A renormalização no subconjunto sai de graça:
 *   a fórmula já divide pela soma dos pesos PRESENTES, então um produto que só
 *   roda na X2D é precificado pela X2D pura, sem ninguém ter de reescrever
 *   percentual.
 */
export function resolveFleet(
  machines: Machine[],
  machineIds: string[] | undefined,
): FleetRate {
  const ids = (machineIds ?? []).filter(
    (id): id is string => typeof id === "string" && id.trim() !== "",
  );
  const wanted = new Set(ids);
  // Filtra pela LISTA de máquinas (não pelo Set de ids) para a ordem do
  // resultado ser sempre a do cadastro — dois produtos com o mesmo conjunto
  // exibem os mesmos nomes na mesma ordem, independente de como foram salvos.
  const eligible = machines.filter((machine) => wanted.has(machine.id));
  const missing = eligible.length === 0 || eligible.length !== wanted.size;
  const fleet = eligible.length > 0 ? eligible : machines;

  if (fleet.length === 0) {
    // TD-024: lista de máquinas VAZIA. Uma frota de zeros devolve energia,
    // desgaste e manutenção 0 e mantém `missing`, que é o que a tela já sabe
    // mostrar. O preço não pode depender de a função não explodir.
    return {
      machines: [],
      missing: true,
      weighted: false,
      depreciationPerHour: 0,
      maintenancePerHour: 0,
      watts: 0,
    };
  }

  const weights = fleet.map(weightOf);
  const total = weights.reduce((sum, w) => sum + w, 0);
  const weighted = total > 0;
  // Peso zero em todo o subconjunto → média simples (cada uma pesa 1).
  const shares = weighted
    ? weights.map((w) => w / total)
    : fleet.map(() => 1 / fleet.length);

  const media = (valueOf: (machine: Machine) => number) =>
    fleet.reduce((sum, machine, index) => sum + shares[index] * valueOf(machine), 0);

  return {
    machines: fleet,
    missing,
    weighted,
    depreciationPerHour: media(depreciationPerHourOf),
    maintenancePerHour: media((machine) => num(machine.maintenancePerHour)),
    watts: media((machine) => num(machine.watts)),
  };
}

/**
 * A união de vários conjuntos elegíveis, na ordem do cadastro — "onde este
 * PRODUTO pode rodar", somando a etapa principal com as extras.
 */
export function unionEligible(fleets: FleetRate[], machines: Machine[]): Machine[] {
  const ids = new Set<string>();
  for (const fleet of fleets) {
    for (const machine of fleet.machines) ids.add(machine.id);
  }
  return machines.filter((machine) => ids.has(machine.id));
}
