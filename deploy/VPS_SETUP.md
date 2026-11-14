# GraphQL Coverage frontend — подготовка VPS и GitHub Actions

Этот документ предназначен для DevOps. Фронтендер разрабатывает React/Vite;
развёртыванием на production VPS управляем мы.

## Архитектура

- Публичный frontend: https://graphql.rebyte.fun/coverage/
- Публичный REST API: https://graphql.rebyte.fun/api/…
- Swagger: https://graphql.rebyte.fun/docs
- Backend продолжает слушать только 127.0.0.1:5081 через Docker.
- Frontend — статический Vite build, без отдельной БД, Node-процесса или контейнера.
- Vite base: /coverage/ при сборке, / при локальной разработке (для dev proxy /api).
- Оба приложения имеют один HTTPS origin; production CORS не нужен.

Nginx на VPS уже обслуживает graphql.rebyte.fun. **Не** добавляйте новый
server block, не трогайте сертификат и не возвращайте API_ROOT_PATH=/coverage.

## 1. Безопасная учётная запись для деплоя

Команды на VPS под root (после проверки, что такой пользователь ещё не создан):

~~~bash
id coverage-frontend-deploy
adduser --disabled-password --gecos "" coverage-frontend-deploy
install -d -m 0755 -o coverage-frontend-deploy -g coverage-frontend-deploy /var/www/coverage-frontend
install -d -m 0755 -o coverage-frontend-deploy -g coverage-frontend-deploy /var/www/coverage-frontend/releases
install -d -m 0700 -o coverage-frontend-deploy -g coverage-frontend-deploy /home/coverage-frontend-deploy/.ssh
~~~

Если пользователь уже есть, команду adduser пропустите. Для загрузки
артефактов на сервер потребуется rsync:

~~~bash
command -v rsync
~~~

При отсутствии установите из официального репозитория Ubuntu. У этого
пользователя **не должно быть** sudo и доступа к Docker. Для Nginx достаточно
прав чтения статических файлов через 0755/0644.

## 2. Отдельный SSH-ключ

На доверенном ПК администратора создайте **отдельную** пару Ed25519
для frontend GitHub Actions, не переиспользуйте ключ backend-деплоя.
Публичную часть добавьте в:

~~~text
/home/coverage-frontend-deploy/.ssh/authorized_keys
~~~

Перед строкой публичного ключа можно поставить ограничения SSH:

~~~text
no-agent-forwarding,no-port-forwarding,no-pty,no-user-rc,no-X11-forwarding ssh-ed25519 AAAA... frontend-actions
~~~

После сохранения на VPS:

~~~bash
chown coverage-frontend-deploy:coverage-frontend-deploy /home/coverage-frontend-deploy/.ssh/authorized_keys
chmod 600 /home/coverage-frontend-deploy/.ssh/authorized_keys
~~~

Проверьте вход без пароля с доверенного ПК именно под
coverage-frontend-deploy. Приватный SSH-ключ не отправляйте в чат.

## 3. GitHub Secrets и Variables

В репозитории QualiMeter/GraphQL-Coverage-Proxy-Frontend:
Settings → Secrets and variables → Actions.

| Тип | Название | Значение |
| --- | --- | --- |
| Secret | FRONTEND_DEPLOY_SSH_KEY | Полный **приватный** ключ новой пары |
| Secret | FRONTEND_DEPLOY_KNOWN_HOSTS | Проверенная строка known_hosts для SSH-хоста |
| Variable | FRONTEND_DEPLOY_HOST | rebyte.fun |
| Variable | FRONTEND_DEPLOY_PORT | 22 |
| Variable | FRONTEND_DEPLOY_USER | coverage-frontend-deploy |
| Variable | FRONTEND_DEPLOY_ENABLED | **Не создавать** или оставить false до интеграции с API |

Для pinned known_hosts возьмите открытый SSH host key **с самого VPS**,
к которому уже есть доверенный доступ:

~~~bash
printf 'rebyte.fun '
awk '{print $1, $2}' /etc/ssh/ssh_host_ed25519_key.pub
~~~

Результат безопасно сохранить в FRONTEND_DEPLOY_KNOWN_HOSTS. Никогда не
используйте StrictHostKeyChecking=no и не доверяйте ключу, полученному
непроверенным ssh-keyscan только внутри CI.

Workflow .github/workflows/frontend-ci.yml всегда выполняет линтер, тесты и
production build для PR/main. Job деплоя запускается только на main после
успешных проверок **и только если** FRONTEND_DEPLOY_ENABLED=true.
Публикуемый build принудительно использует VITE_DATA_SOURCE=api.
Пока src/main.tsx содержит заглушку вместо API-интеграции, деплой
дополнительно отказывается публиковать приложение.

## 4. Подключение пути в Nginx — только после первого деплоя

После первой успешной передачи файлов workflow создаст:

~~~text
/var/www/coverage-frontend/releases/<commit-sha>/index.html
/var/www/coverage-frontend/current -> releases/<commit-sha>
~~~

Проверьте перед изменением Nginx:

~~~bash
test -s /var/www/coverage-frontend/current/index.html
ls -ld /var/www/coverage
~~~

Если /var/www/coverage отсутствует, под root создайте **только** этот
символический указатель (не заменяйте существующие файлы):

~~~bash
ln -s /var/www/coverage-frontend/current /var/www/coverage
~~~

Создайте резервную копию текущего
/etc/nginx/sites-available/graphql.rebyte.fun.
Затем **внутрь существующего HTTPS server block** для graphql.rebyte.fun
добавьте location-блоки из nginx-coverage-location.conf.

Блоки /api/, /graphql, /docs, /health, сертификат и ACME challenge
оставьте без изменений. Не публикуйте директории деплоя через root /.

~~~bash
nginx -t
systemctl reload nginx
curl -sS -o /dev/null -w '%{http_code}\n' https://graphql.rebyte.fun/coverage/
curl -sS -o /dev/null -w '%{http_code}\n' https://graphql.rebyte.fun/api/services
~~~

Оба ответа ожидаются 200. Также проверьте загрузку assets и SPA-маршрутов
в браузере. До первой сборки Nginx не меняйте: отсутствие index.html вызовет
неработающий /coverage/.

## 5. Включение и откат

После ревью настоящей API-интеграции, настройки SSH и первой
пробной сборки установите Repository variable FRONTEND_DEPLOY_ENABLED=true.
Запустите workflow вручную из ветки main (workflow_dispatch), проверьте
развёртывание; после этого каждый merge в main будет публиковать новую версию.

Releases хранятся отдельно, а current переключается атомарно. Для отката
к известному хорошему SHA без удаления файлов:

~~~bash
ln -sfn releases/<GOOD_SHA> /var/www/coverage-frontend/.rollback
mv -Tf /var/www/coverage-frontend/.rollback /var/www/coverage-frontend/current
~~~

Не удаляйте каталоги releases, пока не определили политику хранения
резервных версий. В CI команда rsync --delete ограничена только новой
директорией конкретного commit SHA.
