FROM node:24-alpine

# 工作目录，统一放在 /app，避免用默认的 /root
WORKDIR /app

# 先复制 package 描述文件，利用 Docker 层缓存：
# 只有 package*.json 变化时才会重新安装依赖，改源码不会触发重装
COPY package*.json ./

# 用 lockfile 做可复现安装；--omit=dev 跳过 devDependencies（vitest / playwright 测试框架）
# 项目运行时只需要 dependencies 里的 @playwright/mcp，镜像体积可少 300MB+
RUN npm ci --omit=dev

# 再复制运行必需的源码，此时依赖已装好，后续改源码不影响 npm ci 那一层缓存
COPY src ./src
COPY public ./public
COPY data ./data

# 把 /app 的所有权交给 node 用户：
# 上面的 COPY 和 npm ci 都是 root 执行的，文件默认属于 root，
# 如果不 chown，切换到 node 用户后应用会因 EPERM 无法写 qa-records.json 等运行时文件
RUN chown -R node:node /app

# node:24-alpine 自带 node 用户（uid=1000），切换到非 root 用户运行
# 避免容器被攻破后拿到宿主机 root 权限
USER node

# 声明容器监听的端口，仅作文档用途，实际发布时用 -p 映射
EXPOSE 3000

# 启动命令，exec 形式（数组语法）能正确转发信号，让 Docker 能优雅停机
CMD ["npm", "start"]
