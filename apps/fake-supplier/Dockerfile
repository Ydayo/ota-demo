# 疑似サプライヤーのイメージ。Node 24 の型ストリップで TypeScript を直接実行する。
FROM node:24.21.0-slim
RUN npm install -g pnpm@12.6.0
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/fake-supplier/package.json apps/fake-supplier/
RUN pnpm install --frozen-lockfile --filter @ota/fake-supplier --prod
COPY apps/fake-supplier/src apps/fake-supplier/src
WORKDIR /repo/apps/fake-supplier
ENV NODE_ENV=production
EXPOSE 4010
CMD ["node", "src/server.ts"]
