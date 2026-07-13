# Paper Vault

一个面向 arXiv 的本地优先论文整理桌面应用。macOS 和 Linux 使用同一套 Electron 代码，论文元数据、标签和 Markdown 笔记通过 GitHub 私有仓库同步。

## 已实现

- 粘贴 arXiv 编号、摘要页或 PDF 链接自动导入
- 自动获取标题、作者、摘要、分类和版本信息
- 可选下载 PDF，并用系统 PDF 阅读器打开
- 待读 / 阅读中 / 已读、收藏、标签、全文搜索和排序
- 每篇论文独立保存元数据与 Markdown 笔记，便于 Git 合并和回溯
- 默认连接 `git@github.com:kelo020304/paper_app.git` 的 `vault` 分支
- 修改后约 2 秒自动推送，另一台设备每 30 秒自动拉取，也可手动同步
- 可在设置中切换本地论文库目录

## 本地运行

需要 Node.js 22+、npm 和 Git。

```bash
cd paper-vault
npm install
npm start
```

运行测试：

```bash
npm test
```

## GitHub 同步设置

本项目默认使用同一个 GitHub 仓库的两个分支：

- `main` 保存应用源码。
- `vault` 保存论文元数据、笔记和可选 PDF。

1. 使用 SSH key，或先执行 `gh auth login` 让 Git 具备 GitHub 凭据。
2. 首次启动会自动初始化本地论文库，并连接 `vault` 分支。
3. 修改论文后约 2 秒自动提交并推送；其他设备每 30 秒拉取一次。
4. Linux 或另一台 Mac 安装应用后，使用同一 GitHub SSH 账号即可自动接入。

Git 同步属于近实时同步：本机写入后立即推送，另一端最长约 30 秒看到变化。若两台设备同时修改同一篇论文导致 Git 冲突，应用会停止自动合并、保留本地内容并显示错误，而不会静默覆盖。

> GitHub 官方建议 HTTPS 用户使用 GitHub CLI 或 Git Credential Manager 保存凭据。Paper Vault 不读取或保存 token，而是复用系统 Git 的安全凭据。

## 数据目录

默认目录是系统“文稿”下的 `PaperVault`：

```text
PaperVault/
├── vault.json
├── README.md
└── papers/
    └── 2406.12345/
        ├── metadata.json
        ├── notes.md
        └── paper.pdf
```

PDF 会明显增大 Git 仓库。论文较多时，建议导入时取消“同时下载 PDF”，只同步元数据和笔记；或者自行在仓库中启用 Git LFS。

## 打包

```bash
npm run dist:mac
npm run dist:linux
```

生成的安装包位于 `dist/`。Linux 的 AppImage 可以直接运行，macOS 会生成 DMG 和 ZIP。

## 隐私与安全

- 默认没有云数据库，数据只位于你选择的本地目录和你的 GitHub 仓库。
- GitHub 凭据由 SSH agent、GitHub CLI 或系统 credential helper 管理，应用不保存访问令牌。
- 渲染进程开启 context isolation 与 sandbox，并限制外部链接为 arXiv 域名。
