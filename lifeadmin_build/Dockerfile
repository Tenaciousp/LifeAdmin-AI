FROM node:22-bookworm-slim AS web
WORKDIR /app
COPY package.json ./
COPY artifacts/adminpilot-ai/package.json artifacts/adminpilot-ai/package.json
COPY artifacts/api-server/package.json artifacts/api-server/package.json
RUN npm install
COPY tsconfig.base.json tsconfig.json ./
COPY artifacts/adminpilot-ai artifacts/adminpilot-ai
RUN npm run build:web

FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY artifacts/api-server artifacts/api-server
COPY --from=web /app/artifacts/adminpilot-ai/dist/public artifacts/adminpilot-ai/dist/public
ENV PORT=8000
EXPOSE 8000
CMD ["python", "artifacts/api-server/app.py"]
