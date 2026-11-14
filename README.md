# GraphQL Coverage Proxy

Локальная аналитика наблюдаемого использования полей GraphQL. Покрытие не доказывает корректность значений в тестах.

## Запуск

```bash
npm install
npm run dev
```

Приложение открывается по адресу Vite, обычно `http://localhost:5173`. Проверки: `npm run build`, `npm run lint`, `npm test`.

## Возможности

- Схема и покрытие: React Flow с портами отдельных полей, таблица, фильтры, детали типов и полей.
- Операции: группировка по идентификатору структуры, частота, ошибки, длительность, затронутые поля, безопасный GraphQL-код.
- Обращения: журнал с фильтрами HTTP, GraphQL, анализатора, операции и поля; подробности и код.
- История прогонов: выбор исторического прогона переключает общий snapshot и все показатели.
- Локальное создание сервиса и прогона, завершение прогона, импорт `.graphql`/`.gql` через GraphQL-парсер. Локальные записи сохраняются в `localStorage` этого браузера.

Данные примера содержат Customer API и Billing API, 3 snapshot, 5 прогонов и детерминированные обращения. Метрики, операции, журнал и покрытие вычисляются из одних записей. Отдельный контрольный набор Query/User/Order проверяет 5/9 и 6/9.

## Архитектура и интеграция

`src/analytics/model.ts` содержит типы и расчёты, `fixtures.ts` — связанные локальные данные, `sdl.ts` — импорт схем, `storage.ts` — локальное хранение. Граф использует `src/graph/transform.ts` и `TypeNode.tsx`.

В этой итерации приложение не обращается к backend. При `VITE_DATA_SOURCE=api` показывается сообщение о неподтверждённом контракте без подмены реальных данных mock-данными. Клиент будущего API находится в `src/data/source.ts`; его DTO и маршруты требуют отдельной сверки. Не храните секреты в `VITE_*`.

## Production, CI/CD и ответственность за деплой

- Запланированный адрес фронтенда: **https://graphql.rebyte.fun/coverage/**.
- API того же origin: **https://graphql.rebyte.fun/api/...** (без `/coverage` в API-путях).
- Vite использует `base: '/coverage/'` для production-сборки и `/` локально. Для React Router с `BrowserRouter` используйте `basename={import.meta.env.BASE_URL}`, чтобы оба режима работали.
- Для получения данных из frontend используйте относительные запросы вроде `fetch('/api/services')`. Локальный Vite dev-server проксирует `/api` на backend, поэтому отдельная CORS-настройка не требуется.
- Контракт API: [документация для фронтенда](https://github.com/QualiMeter/GraphQL-Coverage-Proxy-Beckend/blob/main/docs/frontend-api.md), [Swagger](https://graphql.rebyte.fun/docs).
- **Не** помещайте административный `X-Coverage-Api-Key` в клиентский JavaScript или переменные `VITE_*`.

GitHub Actions (`.github/workflows/frontend-ci.yml`) запускает для PR и `main`:
`npm ci`, `npm run lint`, `npm test`, `npm run build`; результат сборки сохраняется как artifact.

Автодеплой на VPS включается repository variable `FRONTEND_DEPLOY_ENABLED=true`
после настройки production environment и SSH. После успешных CI-проверок на
`main` workflow публикует стандартную сборку. Пока интеграция с API не готова,
это локальный демо-интерфейс с mock-данными. При подключении реального API
разработчик обновит клиентский код, а адрес и деплой останутся прежними.
Инструкции для DevOps: [deploy/VPS_SETUP.md](deploy/VPS_SETUP.md).

Выкладка на VPS, Nginx и SSH-ключи — зона ответственности backend/DevOps.
Фронтенд-разработчик поставляет код, тесты и работоспособную сборку через PR.
