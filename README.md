# Request Viewer

Pequeña aplicación web que captura las peticiones HTTP que llegan a uno o varios endpoints (por defecto `POST /test`) y las muestra en tiempo real en un panel web en `/info`, protegido con usuario y contraseña.

Para cada petición se muestra:

- Método, URL y query string
- Body (formateado si es JSON o formulario; en base64 si es binario)
- Origen: IP y puerto, `X-Forwarded-For`, `X-Real-IP`, `Host`, `Origin`, `Referer`, `User-Agent`
- Todas las cabeceras
- Fecha y hora

## Requisitos

- [Docker](https://docs.docker.com/get-docker/) con Docker Compose

## Despliegue con Docker Compose (recomendado)

1. Clona el repositorio:

   ```bash
   git clone https://github.com/alberto1705/request-viewer.git
   cd request-viewer
   ```

2. Crea el fichero de configuración a partir del ejemplo y edítalo (sobre todo `INFO_PASSWORD`):

   ```bash
   cp .env.example .env
   ```

   En Windows (PowerShell): `Copy-Item .env.example .env`

3. Arranca el contenedor:

   ```bash
   docker compose up -d --build
   ```

4. Abre el panel en http://localhost:8080/info e introduce el usuario y la contraseña configurados.

5. Envía una petición de prueba:

   ```bash
   curl -X POST http://localhost:8080/test -H "Content-Type: application/json" -d '{"hola":"mundo"}'
   ```

   PowerShell:

   ```powershell
   Invoke-RestMethod -Method Post -Uri http://localhost:8080/test -ContentType 'application/json' -Body '{"hola":"mundo"}'
   ```

### Comandos útiles

```bash
docker compose logs -f        # ver logs
docker compose restart        # reiniciar (p. ej. tras cambiar .env usa: docker compose up -d)
docker compose down           # parar y eliminar el contenedor
```

## Despliegue con Docker (sin Compose)

```bash
docker build -t request-viewer .
docker run -d --name request-viewer -p 8080:8080 --env-file .env request-viewer
```

O pasando las variables directamente:

```bash
docker run -d --name request-viewer -p 8080:8080 \
  -e CAPTURE_PATHS=/test \
  -e CAPTURE_METHODS=POST \
  -e INFO_USER=admin \
  -e INFO_PASSWORD=mi-contraseña \
  request-viewer
```

## Variables de entorno

| Variable          | Por defecto | Descripción |
|-------------------|-------------|-------------|
| `HOST_PORT`       | `8080`      | Puerto publicado en la máquina host (solo Docker Compose). |
| `PORT`            | `8080`      | Puerto en el que escucha la aplicación dentro del contenedor. |
| `CAPTURE_PATHS`   | `/test`     | Rutas a capturar, separadas por comas (ej. `/test,/webhook`). |
| `CAPTURE_METHODS` | `POST`      | Métodos a capturar, separados por comas, o `ALL`. |
| `RESPONSE_STATUS` | `200`       | Código HTTP devuelto a las peticiones capturadas. |
| `MAX_REQUESTS`    | `500`       | Número máximo de peticiones guardadas en memoria. |
| `MAX_BODY`        | `10mb`      | Tamaño máximo del body aceptado. |
| `INFO_USER`       | `admin`     | Usuario del panel `/info`. |
| `INFO_PASSWORD`   | *(vacío)*   | Contraseña del panel `/info`. Si está vacía, el panel queda **sin protección**. |

## Endpoints

| Ruta                       | Descripción |
|----------------------------|-------------|
| `CAPTURE_PATHS` (ej. `/test`) | Endpoints que capturan las peticiones. Responden `{"status":"received","id":N}`. |
| `GET /info`                | Panel web en tiempo real (requiere autenticación). |
| `GET /info/api/requests`   | Peticiones capturadas en JSON. |
| `DELETE /info/api/requests`| Borra las peticiones capturadas. |
| `GET /info/api/stream`     | Stream SSE con las nuevas peticiones. |

## Notas

- Las peticiones se guardan **solo en memoria**: se pierden al reiniciar el contenedor.
- La autenticación es HTTP Basic. Si expones el servicio fuera de tu red local, ponlo detrás de HTTPS (reverse proxy) para que la contraseña no viaje en claro.
- Con Docker Desktop (Windows/macOS), las peticiones enviadas desde tu propia máquina aparecen con la IP interna de Docker (p. ej. `172.17.0.1`). Si hay un proxy delante, la IP real del cliente aparece en `X-Forwarded-For`.
- Si el puerto 8080 está ocupado, cambia `HOST_PORT` en el `.env`.

## Ejecución sin Docker

```bash
npm install
INFO_PASSWORD=mi-contraseña npm start
```
