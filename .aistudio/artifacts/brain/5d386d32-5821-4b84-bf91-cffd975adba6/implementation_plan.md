# Painel de Auditoria de Quebra (QB) & Nota (NT) + Segurança em Nuvem

## Visão Geral & Segurança na Nuvem

### 1. Resposta Técnica sobre Segurança em Nuvem para Dispositivos Permitidos
**Sim, é seguro e altamente recomendado para operações empresariais**, desde que implementado seguindo padrões modernos de segurança:

1. **Controle de Acesso & Dispositivos Permitidos**:
   - **Autenticação Segura**: Acesso condicionado a credenciais exclusivas por operador ou dispositivo (ex.: chaves de API restritas, tokens JWT assinados ou Firebase Auth).
   - **Regras de Segurança no Servidor (Security Rules)**: O banco de dados (ex.: Firestore ou Cloud SQL) valida diretamente na nuvem quem pode ler ou gravar, impedindo acessos anônimos ou injeções externas.
   - **Restrição de Rede / IP ou Dispositivo**: É possível restringir conexões a dispositivos cadastrados ou à rede corporativa/VPN da empresa.
2. **Criptografia Ponta a Ponta**:
   - Todos os dados trafegam exclusivamente por canais criptografados HTTPS/TLS 1.3 e ficam criptografados em repouso no datacenter (AES-256).
3. **Imutabilidade e Backup**:
   - Protege a operação contra perda de dados caso um tablet/computador quebre, garantindo histórico centralizado para relatórios fiscais e de auditoria de estoque.

---

## Decisões Confirmadas com o Usuário

> [!IMPORTANT]
> **Decisões Validadas na Fase de Planejamento**:
> - **Visualização**: Implementação de uma **Aba/Painel dedicado exclusivo para auditoria e quantificação de QB e NT**.
> - **Foco Imediato**: Implementar primeiramente a quantificação completa de QB e NT no aplicativo (com cálculos, taxas percentuais, métricas por peso/unidade e exportação), mantendo o sistema pronto para posterior conexão ao banco de dados na nuvem.

---

## 1. Conceito e Funcionalidades do Novo Painel de Auditoria

O aplicativo ganhará uma nova seção dedicada: **"Auditoria QB / NT"** (além de "Registrar", "Tabela Atual" e "Lançamentos & Períodos").

### Principais Recursos:
1. **Indicadores Chave de Desempenho (KPIs)**:
   - **Volume Total Registrado**: Peso líquido (kg) e Unidades (un).
   - **Total Destinado à Nota de Devolução (NT)**: Peso/quantidade absoluta e percentual sobre o total (ex.: `12.4%`).
   - **Total de Quebra/Descarte (QB)**: Peso/quantidade absoluta e percentual sobre o total (ex.: `5.8%`).
   - **Saldo Regular (Aprovado sem ocorrência)**: Quantidade regular recebida.
2. **Filtro Temporal Integrado**:
   - Permite auditar por **Hoje**, **Ontem**, **Últimos 7 dias**, **Mês Atual** ou **Intervalo Customizado (De / Até)**.
3. **Detalhamento por Mercadoria**:
   - Lista classificada por produto indicando:
     - Nome e Código de Barras
     - Total de Quebra (QB) acumulado do produto
     - Total de Nota (NT) acumulado do produto
     - Proporção de perda do produto
4. **Exportação Especializada**:
   - Relatório de Auditoria em formato CSV com colunas de classificação discriminadas para conferência pelo setor financeiro e de prevenção de perdas.

---

## 2. Experiência do Usuário & Design Visual

Seguindo as diretrizes de design para SaaS e dashboards operacionais:

- **Paleta de Cores Semântica e Restrita**:
   - **Verde Esmeralda (`#15803D`)**: Nota de Devolução (NT) — recuperação de crédito fiscal.
   - **Vermelho Carmesim (`#B91C1C`)**: Quebra (QB) — perda e descarte.
   - **Azul Slate (`#0F172A` / `#334155`)**: Estrutura geral, saldo regular e neutros de alta legibilidade.
- **Tipografia Tabular**:
   - Uso rigoroso de `tabular-nums` / `font-mono` para alinhamento vertical exato de casas decimais em pesos e percentuais.
- **Estrutura de Abas Limpa**:
   - Navegação superior organizada:
     1. `Registrar` (Formulário)
     2. `Tabela Atual` (Lote consolidado com data preservada)
     3. `Lançamentos & Períodos` (Log de cada bipagem)
     4. `Auditoria QB / NT` (Novo painel de perdas e devoluções)

---

## 3. Arquitetura Técnica & Fluxo de Dados

```
┌──────────────────────────────────────────────────────────────┐
│                       ESTADO GLOBAL                          │
│  - registeredProducts (Lote consolidado)                    │
│  - productLaunchHistory (Lançamentos individuais com NT/QB) │
│  - tableCreationDate (Data fixa da tabela preservada)        │
└──────────────┬───────────────────────────────┬───────────────┘
               │                               │
               ▼                               ▼
┌─────────────────────────────┐  ┌─────────────────────────────┐
│  Lançamentos & Períodos     │  │   NOVO: Auditoria QB / NT   │
│  - Timeline de pesagens     │  │  - Métricas de Quebra (QB)  │
│  - Filtro De / Até          │  │  - Métricas de Nota (NT)    │
│  - Lançamentos acumulados   │  │  - Taxas % sobre o lote     │
│                             │  │  - Ranking de perdas        │
│                             │  │  - Exportação para auditoria│
└─────────────────────────────┘  └─────────────────────────────┘
```

### Modelo de Dados:
Cada item em `productLaunchHistory` já carrega `classification: 'NT' | 'QB' | ''` e `netQuantity`.
O novo componente computará:
- `totalGross`, `totalNet`
- `totalNT` e `percentNT = (totalNT / totalNet) * 100`
- `totalQB` e `percentQB = (totalQB / totalNet) * 100`
- Agrupamentos por produto no período selecionado.

---

## 4. Etapas de Execução

1. **Criação do Componente `QBNTAuditPanel.tsx`**:
   - Painel com cartões de balanço de perdas e devoluções.
   - Seletor de período temporal (hoje, ontem, intervalo de datas).
   - Tabela analítica com produtos que tiveram Quebra ou Nota.
   - Exportação em CSV do relatório de auditoria.
2. **Integração no `App.tsx`**:
   - Adição da aba "Auditoria QB / NT" no menu superior e nas rotas de navegação.
   - Sincronização em tempo real com as marcações feitas na tabela ou formulário.
3. **Verificação & Testes**:
   - Validação da precisão matemática de pesos e percentuais.
   - Teste de compilação e verificação de lint.
