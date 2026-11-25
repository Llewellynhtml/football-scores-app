# MariaDB 11.8 local setup on Windows

Use an isolated local database. Never copy hosted or provider credentials into the test environment.

## Native Windows installation

1. Download the 64-bit Windows MSI for the MariaDB **11.8** series from the [official MariaDB downloads page](https://mariadb.com/downloads/). The hosted server is 11.8.9; use 11.8.9 if still offered, otherwise the latest 11.8 maintenance release and record the exact version.
2. Run the MSI as Administrator. Keep MariaDB Server and command-line client selected. Set a unique local root password. Installing as a Windows service is optional but convenient. Use port 3306 only if it is free.
3. Open the MariaDB command prompt installed by the MSI, or add its `bin` directory to `PATH`. Verify:

   ```powershell
   mariadb --version
   mariadb -u root -p -e "SELECT VERSION(), @@transaction_isolation;"
   ```

4. Create a disposable database and least-privilege test user from the MariaDB prompt, replacing the password locally:

   ```sql
   CREATE DATABASE football_scores_test_m1 CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
   CREATE USER 'football_m1'@'localhost' IDENTIFIED BY 'local-test-password';
   GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP
     ON football_scores_test_m1.* TO 'football_m1'@'localhost';
   FLUSH PRIVILEGES;
   ```

5. Install JavaScript dependencies from the repository (`mysql2` is already declared):

   ```powershell
   npm ci
   ```

6. Set test-only variables in the current PowerShell session. Do not write the password to tracked files:

   ```powershell
   $env:MARIADB_ISOLATED_DATABASE='true'
   $env:DATABASE_PROVIDER='mysql'
   $env:FOOTBALL_PERSISTENCE_ENABLED='true'
   $env:MYSQL_HOST='127.0.0.1'
   $env:MYSQL_PORT='3306'
   $env:MYSQL_DATABASE='football_scores_test_m1'
   $env:MYSQL_USER='football_m1'
   $env:MYSQL_PASSWORD='local-test-password'
   $env:API_FOOTBALL_BASE_URL='http://127.0.0.1:4310'
   $env:API_FOOTBALL_KEY='integration-test-only'
   ```

7. Apply and test:

   ```powershell
   npm run db:mariadb:migrate
   npm run test:mariadb:integration
   npm test
   npm run typecheck
   ```

The official [Windows MSI documentation](https://mariadb.com/docs/server/server-management/install-and-upgrade-mariadb/installing-mariadb/binary-packages/installing-mariadb-msi-packages-on-windows) explains installer components and PATH behavior.

## Docker alternative

Install Docker Desktop manually, then use the official 11.8 image. Pin a patch tag when one matching 11.8.9 is available; otherwise record the selected 11.8 patch.

```powershell
docker run --name football-mariadb-m1 -e MARIADB_ROOT_PASSWORD=local-root-password -e MARIADB_DATABASE=football_scores_test_m1 -e MARIADB_USER=football_m1 -e MARIADB_PASSWORD=local-test-password -p 127.0.0.1:3306:3306 -d mariadb:11.8-noble
docker exec football-mariadb-m1 mariadb-admin ping -uroot -plocal-root-password
```

The tag is maintained as a [Docker Official Image](https://hub.docker.com/_/mariadb/tags/?name=11.8-noble). Do not publish port 3306 beyond loopback. Remove the container only after confirming its exact name and that it contains no needed data.

## Optional tools

HeidiSQL may be installed for local browsing, but it is not required and must not replace scripted migrations/validation. The MariaDB CLI is required for reproducible SQL checks. Playwright is unrelated to database setup and is needed only for later browser flows.

## Teardown

After tests, verify the database name starts with `football_scores_test_` before dropping it. Remove the local user separately. Never run teardown against the hosted hostname.
