<p align="center">
  <img src="./public/brand/atlas-innove-lockup.svg" alt="Atlas Innove" width="280" />
</p>

<p align="center">
  <strong>Infraestrutura digital para acompanhar programas de fomento, empreendimentos e resultados ao longo do tempo.</strong>
</p>

<div align="center">
  <h3>Demonstração pública</h3>
  <p><strong><a href="https://innove.ouseagency.com/demo">innove.ouseagency.com/demo →</a></strong></p>
  <p><sub>Explore a visão institucional, o acompanhamento longitudinal e as oportunidades públicas sem necessidade de login.</sub></p>
</div>

---

## Sobre o Atlas Innove

O Atlas Innove é uma plataforma SaaS multi-institucional voltada ao acompanhamento de iniciativas apoiadas por programas de inovação e fomento.

A proposta é organizar, em uma mesma infraestrutura, o contexto do apoio recebido e a trajetória posterior de cada empreendimento. Em vez de encerrar a leitura no resultado de um edital, a plataforma preserva observações sucessivas ao longo do tempo e permite acompanhar como projetos e empreendimentos evoluem após o ingresso em uma política, programa ou chamada de incentivo.

O modelo conceitual parte desta sequência:

**Instituição → Programa de fomento → Edital → Seleção → Apoio e execução → Acompanhamento longitudinal → Evidências → Análise**

## Como o modelo funciona

- **Instituição** representa o órgão, fundação ou organização responsável pelo acompanhamento.
- **Programa de fomento** representa uma política, mecanismo ou iniciativa continuada de apoio à inovação.
- **Edital** representa uma chamada específica, com regras, recursos, cronograma e documentos próprios.
- **Coorte** reúne empreendimentos que ingressam no acompanhamento dentro de um mesmo ciclo comparável.
- **Empreendimento** preserva a identidade da iniciativa acompanhada ao longo do tempo.
- **Ondas de acompanhamento** representam momentos sucessivos de observação, como baseline, 6, 12 ou 24 meses.
- **Evidências** registram indicadores, marcos e informações observadas em cada momento, sem sobrescrever o histórico.
- **Análise** transforma esse histórico em uma leitura agregada da coorte e em trajetórias individuais dos empreendimentos.

## Acompanhamento longitudinal

O núcleo do Atlas Innove é a separação entre identidade e observação.

Um empreendimento continua sendo a mesma entidade ao longo do tempo, enquanto faturamento, equipe, clientes, estágio do produto, capital captado e outros indicadores podem mudar a cada onda. Essa estrutura permite comparar diferentes momentos sem substituir dados anteriores.

A plataforma também preserva a diferença entre ausência de resposta e valor zero. Uma observação não realizada permanece identificada como ausência de informação, evitando que lacunas sejam interpretadas como resultados.

O acompanhamento organiza e descreve evidências. Ele não transforma, por si só, uma associação observada em atribuição causal ao programa de fomento.

## Adoção institucional e importações históricas

Em **Configurações → Preparação institucional**, gestores podem consultar um roteiro opcional derivado dos registros atuais: identificação, programa, edital quando aplicável, protocolo, coorte, participação, onda e observação enviada. O roteiro não persiste uma pontuação nem exige divulgação pública.

Em **Configurações → Importar dados históricos**, a sequência é carregar CSV → revisar o mapeamento → validar → conferir as linhas e avisos → confirmar a aplicação. Há modelos para programas, editais, coortes, empreendimentos, participações, ondas, observações e marcos. O processamento é síncrono e limitado a UTF-8, 2 MiB, 1.000 linhas, 64 colunas e 4.000 caracteres por célula; um lote pode afetar até 5.000 registros, incluindo observações previstas. Prévia, auditoria e erros são paginados em 20 itens. O CSV de erros e avisos neutraliza fórmulas de planilha.

Cada identidade usa uma referência externa única por instituição, origem e tipo. Os vínculos aceitam essa referência ou um ID institucional explícito, sem correspondência aproximada por nome. O padrão cria apenas novos registros. A atualização opcional limita-se aos campos descritivos de programas e empreendimentos já identificados. Contas, protocolos, candidaturas, apoios e mensagens não são importados. Editais históricos permanecem com divulgação pública e inscrições desativadas.

Observações usam uma linha por indicador, a versão real do protocolo e as regras canônicas de validação. Ausência permanece ausência, zero continua valor, e datas históricas não são substituídas pela data da importação. Rascunhos e evidências existentes não são sobrescritos. Apenas observações previstas ainda vazias podem ser preenchidas com registro do estado anterior.

`src/lib/imports` concentra preparação, referências, validação, aplicação, auditoria e reversão. As permissões de gestor, administrador ou proprietário são verificadas novamente no servidor. Aplicação e reversão são transações atômicas com controle de revisão. O banco preserva a origem bruta e a auditoria. A reversão só prossegue se todas as alterações permanecerem intactas e sem dependências manuais, de outros lotes ou de relatórios preservados; o histórico de importação é mantido.

## Demonstração

A demonstração pública apresenta um recorte funcional do modelo longitudinal do Atlas Innove.

Ela utiliza metadados públicos de um programa de fomento como referência de contexto. Empreendimentos, pessoas, marcos e resultados exibidos no cenário demonstrativo são fictícios e existem exclusivamente para mostrar o funcionamento da plataforma.

**[Acessar a demonstração pública →](https://innove.ouseagency.com/demo)**

## Arquitetura

O Atlas Innove utiliza Next.js 15 com App Router, React 19, TypeScript em modo estrito, Prisma 6, PostgreSQL, Tailwind CSS, Zod, bcryptjs, date-fns e lucide-react.

A aplicação é multi-tenant. Dados pertencentes a uma instituição são isolados por organização, e operações autenticadas validam sessão, vínculo ativo e permissões no servidor antes de acessar ou modificar recursos institucionais.

As migrations em `prisma/migrations` formam o histórico versionado do schema do banco de dados.

## Desenvolvimento local

Use `.env.example` como referência para a configuração do ambiente e defina, no mínimo, `DATABASE_URL` e `SESSION_SECRET`.

```bash
npm ci
npm run db:generate
npm run db:validate
npm run db:migrate
npm run typecheck
npm run test:security
npm run dev
```

As flags `ALLOW_DEV_RESET_TOKEN` e `ALLOW_DEV_INVITE_TOKEN` são exclusivas para desenvolvimento e devem permanecer desativadas em produção.

Em produção, `APP_BASE_URL` define a origem HTTPS dos metadados públicos e deve estar configurada no build e na execução. Builds Docker recebem essa origem pelo argumento `APP_BASE_URL`.

Os testes de domínio devem usar um PostgreSQL descartável. A integração contínua aplica as migrations e executa as verificações de tipos, segurança, domínio, demonstração e build, sem dispensar o banco de testes.

## Participação e seleção

A mesma conta pode atuar como participante e acessar os espaços institucionais para os quais possui autorização. Pessoas, equipes e projetos mantêm sua identidade ao participar de diferentes programas.

**Pessoa → Equipe → Projeto → Candidatura → Avaliação → Decisão → Apoio → Execução → Acompanhamento**

Equipes e projetos são privados por padrão. Convites permitem ingressar em uma equipe; a candidatura entrega à instituição uma cópia das informações apresentadas na data do envio, preservada mesmo quando o projeto evolui.

A avaliação humana utiliza critérios e pesos definidos por edital. A classificação reúne apenas avaliações enviadas e informa a decisão institucional. O resultado é publicado de forma intencional; participantes consultam seu próprio resultado. Uma candidatura selecionada pode originar um apoio, financeiro ou não, com período de execução, obrigações e documentos próprios.

A execução organiza entregas e relatórios, preservando cada versão enviada e a análise institucional. Desembolsos registram repasses previstos e realizados; não processam pagamentos nem representam despesas do projeto. Responsáveis pelo projeto elaboram as submissões, recebem orientações de ajuste e acompanham seu histórico.

O acompanhamento longitudinal continua separado das obrigações da execução. Um apoio ativo pode ser conectado a um empreendimento e a uma coorte, preservando a candidatura de origem. As ondas podem começar durante a execução e continuar após sua conclusão; vínculos históricos anteriores permanecem válidos.

Tarefas, recursos e atividade operacional pertencem ao espaço privado dos colaboradores atuais do projeto. Essas informações não são compartilhadas automaticamente com a instituição ou com páginas públicas. Os centros de ações organizam pendências reais a partir dos registros da plataforma.

Os protocolos de acompanhamento preservam versões imutáveis de seus indicadores. Cada coorte utiliza uma versão definida, e as observações de cada onda mantêm o histórico, distinguindo valores observados de informações ausentes.

## Análises e resultados públicos

A área **Análises** reúne o portfólio institucional, programas, evolução das coortes, comparação entre coortes e qualidade dos dados. Métricas canônicas preservam o conceito observado entre versões compatíveis dos protocolos; a comparação entre coortes exige vínculo explícito com a mesma métrica e o mesmo mês de referência. Nomes de ondas não determinam comparabilidade.

Os resultados identificam o universo esperado, os envios, os valores válidos e as ausências. A leitura pareada inclui somente participações com valor válido nos dois momentos selecionados. Valores monetários preservam precisão decimal; zero continua diferente de informação ausente. As análises descrevem evidências e não atribuem automaticamente mudanças ao programa.

Analistas podem consultar a composição dos agregados, exportar CSV delimitado por ponto e vírgula e gerar relatórios imutáveis. Os arquivos preservam valores decimais sem formatação monetária, protegem contra fórmulas de planilhas e registram uma auditoria de escopo e quantidade. Os relatórios mantêm data de referência e origem; atualizações geram novos recortes. A versão para impressão permite salvar PDF pelo navegador.

Gestores podem publicar um relatório após conferir sua prévia protegida. A publicação conserva somente conteúdo agregado, sem registros individuais; grupos pequenos e células complementares são suprimidos. O mínimo padrão é de cinco registros, configurável entre três e vinte. A retirada da publicação encerra seu acesso público e preserva o histórico institucional. **/results** reúne apenas publicações vigentes.

## Identidade e descoberta

O perfil de inovação reúne apresentação, competências, interesses, formação e experiência declarada. A pessoa escolhe a visibilidade de cada seção e pode publicar ou retirar seu perfil sem apagar os dados. Projetos também mantêm uma identidade pública opcional, administrada por seus responsáveis.

A descoberta autenticada possui permissões próprias para pessoas e projetos. A relevância considera os temas visíveis e explica cada correspondência. Períodos de conexão autorizam conversas diretas; convites direcionados e solicitações de colaboração criam vínculos independentes com projetos. Discussões exigem acesso atual ao projeto. Notificações registram eventos reais, enquanto bloqueios e denúncias restringem o contato sem apagar o histórico. Esses recursos preservam os registros apresentados à avaliação e as regras de seleção institucional.

A camada social distingue seguir uma pessoa, estabelecer uma conexão profissional e colaborar em um projeto. Seguir acompanha publicações e não concede acesso a mensagens ou dados privados. Publicações, comentários e atividade respeitam a audiência escolhida, a publicação do perfil e os bloqueios em cada leitura e interação. O feed reúne conteúdo autorizado; a demonstração permanece um cenário curado separado do produto real.

### Social profile media

Professional profiles share an avatar and cover across their authorized identity contexts. Posts support up to four ordered images with optional alternative text. The relational database stores ownership, dimensions, lifecycle state and attachment metadata; image bytes live exclusively in private S3-compatible object storage.

`src/lib/storage` owns the provider interface and S3 adapter. Production configuration uses `OBJECT_STORAGE_REGION`, `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_ACCESS_KEY_ID` and `OBJECT_STORAGE_SECRET_ACCESS_KEY`; compatible providers can additionally set `OBJECT_STORAGE_ENDPOINT` and `OBJECT_STORAGE_FORCE_PATH_STYLE`. Keep the bucket private. Credentials are server-only. Public bucket URLs are not used for delivery: public visibility can be revoked, so every image request passes through `/api/media/[id]` and current profile/post authorization. Responses are private and non-cacheable. Browser images use generated responsive derivatives directly, avoiding a shared optimizer cache for protected content.

Uploads accept bounded JPEG, PNG and WebP files. The server validates signatures, decodes the image with pixel and concurrency limits, rejects animation, applies orientation and crop, and writes sanitized WebP derivatives. Raw originals, GPS and other EXIF metadata are discarded. Avatar, cover and post limits are 5, 8 and 10 MiB respectively. Files use generated immutable object keys; filenames and account contacts are never storage identifiers.

Media follows `PENDING → READY → DELETED`. Database attachment transactions recheck ownership, kind, readiness and active references. Replacing profile media or deleting a post revokes application access before object deletion. External storage failures cannot restore deleted content. The explicit media maintenance command retries physical deletion and rechecks abandoned pending or unattached ready assets under locks; no automatic schedule is assumed. Tests inject an in-memory storage adapter, while browser validation uses a private local S3-compatible service. Production has no in-memory upload fallback. Without storage configuration, profiles and text posts continue to work and image upload controls explain their unavailability.

A trajetória preserva os períodos de participação em equipes e projetos, inclusive quando uma pessoa sai e depois retorna. Participações verificadas derivam de candidaturas enviadas, resultados publicados e vínculos vigentes na data da submissão; não substituem as informações históricas usadas na avaliação.

Editais e oportunidades externas entram na descoberta somente após publicação explícita. Participantes podem filtrar e salvar oportunidades, consultar suas fontes oficiais e entender a relação com os temas de seu perfil ou projeto. A compatibilidade utiliza regras transparentes e não constitui uma confirmação de elegibilidade.
