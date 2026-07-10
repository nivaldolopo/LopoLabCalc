# Lopo Lab Calc

Calculadora de preço para impressão 3D migrada de um HTML único para um projeto Next.js com App Router e TypeScript.

## Stack

- Next.js App Router
- React + TypeScript
- Firebase Firestore no client
- pnpm

## Como rodar localmente

O projeto espera Node 24, definido em `.nvmrc`.

```bash
nvm install
nvm use
pnpm install
pnpm dev
```

Depois abra [http://localhost:3000](http://localhost:3000).

Se você ainda não usa NVM:

```bash
brew install nvm
mkdir -p ~/.nvm
```

Adicione ao `~/.zshrc`:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && . "/opt/homebrew/opt/nvm/nvm.sh"
```

## Variáveis de ambiente

Copie `.env.example` para `.env.local` se quiser sobrescrever a configuração Firebase.

```bash
cp .env.example .env.local
```

O app mantém fallback para o mesmo projeto Firebase usado pelo HTML original, então a primeira migração funciona sem configurar env local.

## Estrutura

```txt
src/
  app/
    layout.tsx
    page.tsx
    globals.css
  features/
    pricing-calculator/
      components/
      hooks/
      lib/
      constants.ts
      types.ts
  lib/
    firebase/
    formatting/
```

## Separação principal

- `calculatePricing.ts`: regra pura de preço.
- `calculateCapacity.ts`: capacidade diária/mensal.
- `productCsv.ts`: importação/exportação CSV.
- `productsRepository.ts`: integração Firestore.
- `usePricingForm.ts`: estado do formulário.
- `components/`: blocos visuais da calculadora.

## Validação

```bash
pnpm lint
pnpm build
```
